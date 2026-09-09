const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Reminder = require('../models/Reminder');
const {
  scheduleReminder,
  cancelReminderJob,
  getNextOccurrence,
} = require('../services/agendaService');
const asyncHandler = require('../middleware/asyncHandler');
const resolveUser = require('../middleware/resolveUser');
const { createBackup } = require('../services/backupService');

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
    }).sort({ reminderAt: 1 });

    res.json({ success: true, count: reminders.length, data: reminders });
  })
);

// ─── GET /api/reminders/birthdays ─────────────────────────────────────────────
// Returns birthdays and special events, sorted by their next occurrence.
router.get(
  '/birthdays',
  asyncHandler(async (req, res) => {
    const birthdays = await Reminder.find({
      chatId: req.chatId,
      type: { $in: ['birthday', 'special'] },
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
// Full data dump for backup: every reminder and yearly event (all statuses).
// The client serializes this into a downloadable `.knr` file.
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      backup: await createBackup(req.chatId),
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
      'isRecurring', 'recurrence', 'isImportant', 'status', 'completedAt',
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
    const { text, reminderAt, isRecurring, recurrence, isImportant, type, personName, birthYear } =
      req.body;

    if (type !== undefined && !['reminder', 'birthday', 'special'].includes(type)) {
      return res.status(400).json({ success: false, message: 'סוג האירוע אינו תקין' });
    }

    const parsedReminderAt = new Date(reminderAt);
    if (!reminderAt || Number.isNaN(parsedReminderAt.getTime())) {
      return res.status(400).json({ success: false, message: 'מועד התזכורת אינו תקין' });
    }

    const isBirthday = type === 'birthday';
    const isCelebration = isBirthday || type === 'special';

    // Birthday-specific validation
    if (isCelebration && !personName?.trim()) {
      return res.status(400).json({
        success: false,
        message: isBirthday ? 'נא להזין שם עבור יום ההולדת' : 'נא להזין שם לאירוע',
      });
    }

    // For standard reminders, validate recurrence payload when isRecurring is true.
    // Birthdays are always yearly-recurring regardless of the isRecurring flag.
    if (!isCelebration && isRecurring && (!recurrence || !recurrence.frequency)) {
      return res.status(400).json({
        success: false,
        message: 'נא לבחור תדירות חזרה',
      });
    }

    const reminder = await Reminder.create(
      isCelebration
        ? {
            chatId: req.chatId,
            text,
            type,
            personName: personName.trim(),
            birthYear: isBirthday ? (birthYear ?? null) : null,
            reminderAt: parsedReminderAt,
            isRecurring: true,
            recurrence: { frequency: 'yearly' },
            isImportant: isImportant || false,
          }
        : {
            chatId: req.chatId,
            text,
            type: 'reminder',
            reminderAt: parsedReminderAt,
            isRecurring: isRecurring || false,
            recurrence: isRecurring ? recurrence : null,
            isImportant: isImportant || false,
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

    const { text, reminderAt, isRecurring, recurrence, isImportant, type, personName, birthYear } =
      req.body;

    if (type !== undefined && !['reminder', 'birthday', 'special'].includes(type)) {
      return res.status(400).json({ success: false, message: 'סוג האירוע אינו תקין' });
    }

    const nextType = type ?? reminder.type;
    const isBirthday = nextType === 'birthday';
    const isCelebration = isBirthday || nextType === 'special';
    const nextName = personName !== undefined ? personName : reminder.personName;
    if (isCelebration && !nextName?.trim()) {
      return res.status(400).json({
        success: false,
        message: isBirthday ? 'נא להזין שם עבור יום ההולדת' : 'נא להזין שם לאירוע',
      });
    }

    let timeChanged = false;
    let scheduleChanged = false;
    if (text !== undefined) reminder.text = text;
    if (isImportant !== undefined) reminder.isImportant = isImportant;
    if (type !== undefined && type !== reminder.type) {
      reminder.type = type;
      reminder.notified = false;
      scheduleChanged = true;
    }
    if (personName !== undefined) reminder.personName = personName.trim();
    if (isBirthday && birthYear !== undefined) reminder.birthYear = birthYear;
    if (nextType === 'special') reminder.birthYear = null;
    if (reminderAt !== undefined) {
      const newTime = new Date(reminderAt);
      if (Number.isNaN(newTime.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'מועד התזכורת אינו תקין',
        });
      }
      timeChanged = reminder.reminderAt.getTime() !== newTime.getTime();
      reminder.reminderAt = newTime;
      reminder.notified = false;
    }
    // Birthdays and special events are always yearly-recurring.
    if (isCelebration) {
      if (!reminder.isRecurring || reminder.recurrence?.frequency !== 'yearly') {
        scheduleChanged = true;
      }
      reminder.isRecurring = true;
      reminder.recurrence = { frequency: 'yearly' };
    } else if (isRecurring !== undefined) {
      reminder.isRecurring = isRecurring;
      reminder.recurrence = isRecurring ? recurrence : null;
      scheduleChanged = true;
    }

    await reminder.save();

    // Reschedule only if time or recurrence changed
    if (timeChanged || scheduleChanged) {
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

// ─── PATCH /api/reminders/:id/restore ────────────────────────────────────────
// Restore a completed reminder and schedule it again. Future reminders retain
// their original time; overdue recurring reminders advance to their next
// occurrence; overdue one-time reminders are restored for five minutes from now.
router.patch(
  '/:id/restore',
  asyncHandler(async (req, res) => {
    const reminder = await Reminder.findOne({ _id: req.params.id, chatId: req.chatId });
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'תזכורת לא נמצאה' });
    }
    if (reminder.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'רק תזכורת שהושלמה ניתנת לשחזור' });
    }

    const now = new Date();
    let restoredAt = new Date(reminder.reminderAt);
    if (restoredAt <= now) {
      if (reminder.isRecurring && reminder.recurrence?.frequency) {
        do {
          restoredAt = getNextOccurrence(restoredAt, reminder.recurrence.frequency);
        } while (restoredAt <= now);
      } else {
        restoredAt = new Date(now.getTime() + 5 * 60 * 1000);
      }
    }

    reminder.status = 'active';
    reminder.completedAt = null;
    reminder.expiresAt = null;
    reminder.reminderAt = restoredAt;
    reminder.notified = false;
    await reminder.save();
    await scheduleReminder(reminder);

    res.json({ success: true, data: reminder });
  })
);

// ─── PATCH /api/reminders/:id/snooze ─────────────────────────────────────────
// Snooze a reminder. Two mutually-exclusive modes:
//   { minutes: N }        → snooze N minutes from now (quick presets)
//   { until: <ISO date> } → snooze to a specific absolute datetime (custom date)
// Reschedules the Agenda job.
router.patch(
  '/:id/snooze',
  asyncHandler(async (req, res) => {
    const { minutes, until } = req.body;

    // Resolve the target time from whichever mode was supplied.
    let newTime;
    if (until !== undefined) {
      const target = new Date(until);
      if (isNaN(target.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'תאריך היעד לדחייה אינו תקין',
        });
      }
      if (target <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'מועד הדחייה חייב להיות בעתיד',
        });
      }
      newTime = target;
    } else {
      if (!minutes || typeof minutes !== 'number' || minutes <= 0) {
        return res.status(400).json({
          success: false,
          message: 'נא לספק מספר דקות חיובי לדחייה',
        });
      }
      newTime = new Date(Date.now() + minutes * 60 * 1000);
    }

    const reminder = await Reminder.findOne({ _id: req.params.id, chatId: req.chatId });
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'תזכורת לא נמצאה' });
    }

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
