const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Reminder = require('../models/Reminder');
const { scheduleReminder, cancelReminderJob } = require('../services/agendaService');
const asyncHandler = require('../middleware/asyncHandler');
const resolveUser = require('../middleware/resolveUser');

// Every reminder route is per-user. resolveUser sets req.chatId (or 401s), and
// all queries below scope by it so users can only ever touch their own data.
router.use(resolveUser);

// ─── GET /api/reminders ───────────────────────────────────────────────────────
// Returns all active (and snoozed) reminders, sorted ascending by reminderAt.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const reminders = await Reminder.find({
      chatId: req.chatId,
      status: { $in: ['active', 'snoozed'] },
      // Birthdays live in their own dedicated feed — keep them out of the
      // main reminders timeline. { $ne: 'birthday' } also matches legacy docs
      // where `type` is undefined.
      type: { $ne: 'birthday' },
    }).sort({ reminderAt: 1 });

    res.json({ success: true, count: reminders.length, data: reminders });
  })
);

// ─── GET /api/reminders/birthdays ─────────────────────────────────────────────
// Returns all birthday items, sorted by their next upcoming occurrence.
router.get(
  '/birthdays',
  asyncHandler(async (req, res) => {
    const birthdays = await Reminder.find({
      chatId: req.chatId,
      type: 'birthday',
      status: { $in: ['active', 'snoozed'] },
    }).sort({ reminderAt: 1 });

    res.json({ success: true, count: birthdays.length, data: birthdays });
  })
);

// ─── GET /api/reminders/completed ─────────────────────────────────────────────
// Returns completed reminders still within the 90-day retention window,
// sorted by most-recently-completed first.
router.get(
  '/completed',
  asyncHandler(async (req, res) => {
    const reminders = await Reminder.find({
      chatId: req.chatId,
      status: 'completed',
    }).sort({ completedAt: -1 });

    res.json({ success: true, count: reminders.length, data: reminders });
  })
);

// ─── GET /api/reminders/export ────────────────────────────────────────────────
// Full data dump for backup: every reminder + birthday (all statuses).
// The client serializes this into a downloadable `.knr` file.
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const items = await Reminder.find({ chatId: req.chatId })
      .sort({ reminderAt: 1 })
      .lean();
    res.json({
      success: true,
      backup: {
        format: 'knr-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        count: items.length,
        items,
      },
    });
  })
);

// ─── POST /api/reminders/import ───────────────────────────────────────────────
// Bulk restore from a backup payload. Upserts each item by _id (so re-importing
// the same backup is idempotent) and reschedules active/snoozed jobs.
//
// Body: { items: [ …reminder docs… ] }  — as produced by GET /export.
router.post(
  '/import',
  asyncHandler(async (req, res) => {
    const items = req.body?.items ?? req.body?.backup?.items;

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'קובץ גיבוי לא תקין — לא נמצאו פריטים',
      });
    }

    const ALLOWED = [
      'text', 'type', 'personName', 'birthYear', 'reminderAt',
      'isRecurring', 'recurrence', 'status', 'completedAt',
      'snoozeCount', 'originalReminderAt', 'notified', 'expiresAt',
    ];

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (const raw of items) {
      // Minimal structural validation — every item must have text + reminderAt.
      if (!raw || typeof raw.text !== 'string' || !raw.reminderAt) {
        skipped += 1;
        continue;
      }

      // Whitelist fields so a malicious/mangled backup can't set arbitrary keys.
      // Note chatId is deliberately NOT in ALLOWED — we stamp the caller's own
      // chatId below, so a backup file can never plant data under another user.
      const doc = {};
      for (const key of ALLOWED) {
        if (raw[key] !== undefined) doc[key] = raw[key];
      }
      doc.chatId = req.chatId;

      try {
        let saved;
        // Upsert by _id when a valid one is supplied; otherwise create fresh.
        // The filter includes chatId so a user can only ever update THEIR OWN
        // document — supplying someone else's _id simply inserts a new doc under
        // the caller (matched: none) rather than clobbering the other user's.
        if (raw._id && mongoose.Types.ObjectId.isValid(raw._id)) {
          saved = await Reminder.findOneAndUpdate(
            { _id: raw._id, chatId: req.chatId },
            doc,
            {
              new: true,
              upsert: true,
              setDefaultsOnInsert: true,
              runValidators: true,
            }
          );
        } else {
          saved = await Reminder.create(doc);
        }

        // Reschedule notifications for items that are still pending in the future.
        if (
          saved &&
          ['active', 'snoozed'].includes(saved.status) &&
          new Date(saved.reminderAt) > new Date()
        ) {
          await scheduleReminder(saved);
        }
        imported += 1;
      } catch (err) {
        skipped += 1;
        errors.push({ text: raw.text, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `שוחזרו ${imported} פריטים`,
      imported,
      skipped,
      ...(errors.length ? { errors } : {}),
    });
  })
);

// ─── GET /api/reminders/:id ───────────────────────────────────────────────────
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const reminder = await Reminder.findOne({ _id: req.params.id, chatId: req.chatId });
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'תזכורת לא נמצאה' });
    }
    res.json({ success: true, data: reminder });
  })
);

// ─── POST /api/reminders ──────────────────────────────────────────────────────
// Create a new reminder and immediately schedule its Agenda.js job.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { text, reminderAt, isRecurring, recurrence, type, personName, birthYear } =
      req.body;

    const isBirthday = type === 'birthday';

    // Validate that the reminder time is in the future
    if (new Date(reminderAt) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'מועד התזכורת חייב להיות בעתיד',
      });
    }

    // Birthday-specific validation
    if (isBirthday && !personName?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'נא להזין שם עבור יום ההולדת',
      });
    }

    // For standard reminders, validate recurrence payload when isRecurring is true.
    // Birthdays are always yearly-recurring regardless of the isRecurring flag.
    if (!isBirthday && isRecurring && (!recurrence || !recurrence.frequency)) {
      return res.status(400).json({
        success: false,
        message: 'נא לבחור תדירות חזרה',
      });
    }

    const reminder = await Reminder.create(
      isBirthday
        ? {
            chatId: req.chatId,
            text,
            type: 'birthday',
            personName: personName.trim(),
            birthYear: birthYear ?? null,
            reminderAt: new Date(reminderAt),
            isRecurring: true,
            recurrence: { frequency: 'yearly' },
          }
        : {
            chatId: req.chatId,
            text,
            type: 'reminder',
            reminderAt: new Date(reminderAt),
            isRecurring: isRecurring || false,
            recurrence: isRecurring ? recurrence : null,
          }
    );

    // Schedule the notification job in Agenda
    await scheduleReminder(reminder);

    res.status(201).json({ success: true, data: reminder });
  })
);

// ─── PATCH /api/reminders/:id ─────────────────────────────────────────────────
// Update reminder text or time. Reschedules the Agenda job if reminderAt changed.
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const reminder = await Reminder.findOne({ _id: req.params.id, chatId: req.chatId });
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'תזכורת לא נמצאה' });
    }
    if (reminder.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'לא ניתן לערוך תזכורת שהושלמה',
      });
    }

    const { text, reminderAt, isRecurring, recurrence, personName, birthYear } =
      req.body;

    const isBirthday = reminder.type === 'birthday';

    let timeChanged = false;
    if (text !== undefined) reminder.text = text;
    if (personName !== undefined) reminder.personName = personName;
    if (birthYear !== undefined) reminder.birthYear = birthYear;
    if (reminderAt !== undefined) {
      const newTime = new Date(reminderAt);
      if (newTime <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'מועד התזכורת חייב להיות בעתיד',
        });
      }
      timeChanged = reminder.reminderAt.getTime() !== newTime.getTime();
      reminder.reminderAt = newTime;
      reminder.notified = false;
    }
    // Birthdays stay yearly-recurring; only standard reminders can toggle recurrence.
    if (!isBirthday && isRecurring !== undefined) {
      reminder.isRecurring = isRecurring;
      reminder.recurrence = isRecurring ? recurrence : null;
    }

    await reminder.save();

    // Reschedule only if time or recurrence changed
    if (timeChanged || isRecurring !== undefined) {
      await scheduleReminder(reminder);
    }

    res.json({ success: true, data: reminder });
  })
);

// ─── PATCH /api/reminders/:id/complete ───────────────────────────────────────
// Mark a reminder as completed. The pre-save hook auto-sets expiresAt for TTL.
router.patch(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    const reminder = await Reminder.findOne({ _id: req.params.id, chatId: req.chatId });
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'תזכורת לא נמצאה' });
    }
    if (reminder.status === 'completed') {
      return res.status(400).json({ success: false, message: 'תזכורת כבר הושלמה' });
    }

    // Cancel the pending Agenda job
    await cancelReminderJob(reminder._id.toString());

    // Update status — pre-save hook will set completedAt and expiresAt
    reminder.status = 'completed';
    reminder.completedAt = new Date();
    await reminder.save();

    res.json({ success: true, data: reminder });
  })
);

// ─── PATCH /api/reminders/:id/snooze ─────────────────────────────────────────
// Snooze a reminder by N minutes. Reschedules the Agenda job.
router.patch(
  '/:id/snooze',
  asyncHandler(async (req, res) => {
    const { minutes } = req.body;
    if (!minutes || typeof minutes !== 'number' || minutes <= 0) {
      return res.status(400).json({
        success: false,
        message: 'נא לספק מספר דקות חיובי לדחייה',
      });
    }

    const reminder = await Reminder.findOne({ _id: req.params.id, chatId: req.chatId });
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'תזכורת לא נמצאה' });
    }

    const newTime = new Date(Date.now() + minutes * 60 * 1000);
    reminder.reminderAt = newTime;
    reminder.snoozeCount += 1;
    reminder.status = 'active';
    reminder.notified = false;
    await reminder.save(); // pre-save hook preserves originalReminderAt on first snooze

    await scheduleReminder(reminder);

    res.json({ success: true, data: reminder });
  })
);

// ─── DELETE /api/reminders/:id ────────────────────────────────────────────────
// Hard-delete a reminder. Cancels Agenda job.
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const reminder = await Reminder.findOne({ _id: req.params.id, chatId: req.chatId });
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'תזכורת לא נמצאה' });
    }

    await cancelReminderJob(reminder._id.toString());
    await reminder.deleteOne();

    res.json({ success: true, message: 'תזכורת נמחקה בהצלחה' });
  })
);

module.exports = router;
