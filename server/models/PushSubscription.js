const mongoose = require('mongoose');

const PushPreferencesSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    importantReminders: { type: Boolean, default: true },
    birthdays: { type: Boolean, default: true },
    holidays: { type: Boolean, default: false },
    shabbat: { type: Boolean, default: false },
    birthdayDaysBefore: { type: Number, min: 0, max: 30, default: 3 },
    birthdayNotificationTime: {
      type: String,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
      default: '10:00',
    },
    calendarNotificationTime: {
      type: String,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
      default: '10:00',
    },
    timezone: { type: String, default: 'Asia/Jerusalem' },
  },
  { _id: false }
);

const PushSubscriptionSchema = new mongoose.Schema(
  {
    chatId: { type: String, required: true, trim: true, index: true },
    endpoint: { type: String, required: true, unique: true, maxlength: 2048 },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    preferences: { type: PushPreferencesSchema, default: () => ({}) },
    userAgent: { type: String, maxlength: 500, default: '' },
    recentNotificationKeys: { type: [String], default: [] },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

PushSubscriptionSchema.index({ chatId: 1, 'preferences.enabled': 1 });

module.exports = mongoose.model('PushSubscription', PushSubscriptionSchema);
