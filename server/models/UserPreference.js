const mongoose = require('mongoose');

const WeeklyBackupSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    dayOfWeek: { type: Number, min: 0, max: 6, default: 4 },
    time: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, default: '10:00' },
    timezone: { type: String, default: 'Asia/Jerusalem' },
    lastSentAt: { type: Date, default: null },
  },
  { _id: false }
);

const UserPreferenceSchema = new mongoose.Schema(
  {
    chatId: { type: String, required: true, unique: true, trim: true, index: true },
    weeklyBackup: { type: WeeklyBackupSchema, default: () => ({}) },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserPreference', UserPreferenceSchema);
