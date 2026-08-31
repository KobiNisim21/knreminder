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

function localDateParts(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter(({ type }) => ['year', 'month', 'day', 'hour', 'minute'].includes(type))
      .map(({ type, value }) => [type, Number(value)])
  );
}

function comparableLocalTime(date, timezone) {
  const parts = localDateParts(date, timezone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

/**
 * Returns true once the latest configured weekly slot has passed and no backup
 * has been delivered for it. Local calendar arithmetic avoids DST gaps while
 * still supporting the stored IANA timezone.
 */
function isWeeklyBackupDue(preference, now = new Date()) {
  const weeklyBackup = preference?.weeklyBackup;
  if (!weeklyBackup?.enabled) return false;

  const timezone = weeklyBackup.timezone || 'Asia/Jerusalem';
  const dayOfWeek = Number.isInteger(weeklyBackup.dayOfWeek)
    ? weeklyBackup.dayOfWeek
    : 4;
  const [targetHour, targetMinute] = String(weeklyBackup.time || '10:00')
    .split(':')
    .map(Number);
  const nowParts = localDateParts(now, timezone);
  const localDay = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day));
  let daysSinceTarget = (localDay.getUTCDay() - dayOfWeek + 7) % 7;
  const nowMinutes = nowParts.hour * 60 + nowParts.minute;
  const targetMinutes = targetHour * 60 + targetMinute;

  if (daysSinceTarget === 0 && nowMinutes < targetMinutes) {
    daysSinceTarget = 7;
  }

  localDay.setUTCDate(localDay.getUTCDate() - daysSinceTarget);
  const scheduledComparable = Date.UTC(
    localDay.getUTCFullYear(),
    localDay.getUTCMonth(),
    localDay.getUTCDate(),
    targetHour,
    targetMinute
  );
  const referenceAt = weeklyBackup.lastSentAt || preference.createdAt || preference.updatedAt;

  return !referenceAt || comparableLocalTime(new Date(referenceAt), timezone) < scheduledComparable;
}

async function sendDueWeeklyBackups(now = new Date()) {
  const preferences = await UserPreference.find({
    'weeklyBackup.enabled': true,
  }).lean();
  const due = preferences.filter((preference) => isWeeklyBackupDue(preference, now));
  const results = [];

  for (const preference of due) {
    try {
      const result = await sendWeeklyBackup(preference.chatId);
      results.push({ chatId: preference.chatId, sent: true, count: result.backup.count });
    } catch (error) {
      console.error(`[Weekly Backup] Catch-up failed for ${preference.chatId}:`, error.message);
      results.push({ chatId: preference.chatId, sent: false, error: error.message });
    }
  }

  return results;
}

module.exports = { sendWeeklyBackup, isWeeklyBackupDue, sendDueWeeklyBackups };
