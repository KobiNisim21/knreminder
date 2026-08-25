const Reminder = require('../models/Reminder');

async function createBackup(chatId) {
  const items = await Reminder.find({ chatId: String(chatId) })
    .sort({ reminderAt: 1 })
    .lean();

  return {
    format: 'knr-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    count: items.length,
    items,
  };
}

function serializeBackup(backup) {
  return JSON.stringify(backup, null, 2);
}

module.exports = { createBackup, serializeBackup };
