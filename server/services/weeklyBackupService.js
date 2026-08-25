const UserPreference = require('../models/UserPreference');
const { createBackup } = require('./backupService');
const { sendBackupDocument } = require('./telegramService');

async function sendWeeklyBackup(chatId) {
  const backup = await createBackup(chatId);
  await sendBackupDocument(chatId, backup);
  const sentAt = new Date();
  await UserPreference.updateOne(
    { chatId: String(chatId) },
    {
      $set: { 'weeklyBackup.lastSentAt': sentAt },
      $setOnInsert: { chatId: String(chatId) },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  return { backup, sentAt };
}

module.exports = { sendWeeklyBackup };
