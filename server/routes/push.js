const express = require('express');

const PushSubscription = require('../models/PushSubscription');
const asyncHandler = require('../middleware/asyncHandler');
const resolveUser = require('../middleware/resolveUser');
const { getPublicKey, sendToSubscription } = require('../services/pushService');

const router = express.Router();
router.use(resolveUser);

const ALLOWED_PREFERENCES = [
  'enabled', 'importantReminders', 'birthdays', 'holidays', 'shabbat',
  'birthdayDaysBefore', 'birthdayNotificationTime', 'calendarNotificationTime', 'timezone',
];

function cleanPreferences(raw = {}) {
  return Object.fromEntries(
    ALLOWED_PREFERENCES.filter((key) => raw[key] !== undefined).map((key) => [key, raw[key]])
  );
}

router.get('/vapid-public-key', (req, res) => {
  const publicKey = getPublicKey();
  if (!publicKey) {
    return res.status(503).json({
      success: false,
      message: 'שירות ההתראות טרם הוגדר בשרת',
      code: 'VAPID_NOT_CONFIGURED',
    });
  }
  res.json({ success: true, publicKey });
});

router.post('/subscriptions', asyncHandler(async (req, res) => {
  const { subscription, preferences } = req.body || {};
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ success: false, message: 'מנוי ההתראות אינו תקין' });
  }

  const pushSubscription = await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      $set: {
        chatId: req.chatId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        preferences: cleanPreferences(preferences),
        userAgent: req.get('user-agent') || '',
        lastSeenAt: new Date(),
      },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  res.status(201).json({
    success: true,
    subscription: { id: pushSubscription._id, preferences: pushSubscription.preferences },
  });
}));

router.delete('/subscriptions', asyncHandler(async (req, res) => {
  const endpoint = req.body?.endpoint;
  if (!endpoint) {
    return res.status(400).json({ success: false, message: 'חסרה כתובת מנוי' });
  }
  await PushSubscription.deleteOne({ endpoint, chatId: req.chatId });
  res.json({ success: true });
}));

router.post('/test', asyncHandler(async (req, res) => {
  const endpoint = req.body?.endpoint;
  const subscription = await PushSubscription.findOne({ endpoint, chatId: req.chatId });
  if (!subscription) {
    return res.status(404).json({ success: false, message: 'לא נמצא מנוי פעיל במכשיר' });
  }

  const result = await sendToSubscription(subscription, {
    title: '🔔 ההתראות פועלות',
    body: 'KN Reminder מחובר למכשיר הזה בהצלחה.',
    url: '/settings',
    tag: 'push-test',
    urgency: 'high',
  });
  if (!result.sent) {
    return res.status(502).json({ success: false, message: 'שליחת התראת הבדיקה נכשלה' });
  }
  res.json({ success: true });
}));

module.exports = router;
