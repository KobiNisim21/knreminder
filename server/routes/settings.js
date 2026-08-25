const express = require('express');

const UserPreference = require('../models/UserPreference');
const asyncHandler = require('../middleware/asyncHandler');
const resolveUser = require('../middleware/resolveUser');
const {
  scheduleWeeklyBackup,
  cancelWeeklyBackup,
} = require('../services/agendaService');
const { sendWeeklyBackup } = require('../services/weeklyBackupService');

const router = express.Router();
router.use(resolveUser);

router.get('/weekly-backup', asyncHandler(async (req, res) => {
  const preference = await UserPreference.findOne({ chatId: req.chatId }).lean();
  res.json({
    success: true,
    weeklyBackup: {
      enabled: preference?.weeklyBackup?.enabled ?? false,
      dayOfWeek: preference?.weeklyBackup?.dayOfWeek ?? 4,
      time: preference?.weeklyBackup?.time ?? '10:00',
      timezone: preference?.weeklyBackup?.timezone ?? 'Asia/Jerusalem',
      lastSentAt: preference?.weeklyBackup?.lastSentAt ?? null,
    },
  });
}));

router.patch('/weekly-backup', asyncHandler(async (req, res) => {
  if (typeof req.body?.enabled !== 'boolean') {
    return res.status(400).json({ success: false, message: 'יש לשלוח ערך enabled תקין' });
  }

  const enabled = req.body.enabled;
  const preference = await UserPreference.findOneAndUpdate(
    { chatId: req.chatId },
    {
      $set: {
        'weeklyBackup.enabled': enabled,
        'weeklyBackup.dayOfWeek': 4,
        'weeklyBackup.time': '10:00',
        'weeklyBackup.timezone': 'Asia/Jerusalem',
      },
      $setOnInsert: { chatId: req.chatId },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  if (enabled) await scheduleWeeklyBackup(req.chatId);
  else await cancelWeeklyBackup(req.chatId);

  res.json({ success: true, weeklyBackup: preference.weeklyBackup });
}));

router.post('/weekly-backup/send-now', asyncHandler(async (req, res) => {
  const { backup, sentAt } = await sendWeeklyBackup(req.chatId);
  res.json({
    success: true,
    message: 'קובץ הגיבוי נשלח לטלגרם',
    count: backup.count,
    sentAt,
  });
}));

module.exports = router;
