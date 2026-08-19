const path = require('path');
const crypto = require('crypto');
const webpush = require('web-push');

const PushSubscription = require('../models/PushSubscription');
const Reminder = require('../models/Reminder');

const DEFAULT_TIMEZONE = 'Asia/Jerusalem';
const MAX_RECENT_KEYS = 60;

let calendarData;
let vapidConfigured = false;
let activePublicKey = null;

function toBase64Url(buffer) {
  return buffer.toString('base64url');
}

function deriveVapidKeys(secret) {
  // VAPID uses a P-256 key pair. Deriving it from an existing server-only
  // secret keeps the key stable across deploys without exposing that secret.
  for (let counter = 0; counter < 10; counter += 1) {
    const privateKey = crypto
      .createHmac('sha256', secret)
      .update(`kn-reminder-vapid:${counter}`)
      .digest();
    const ecdh = crypto.createECDH('prime256v1');
    try {
      ecdh.setPrivateKey(privateKey);
      return {
        publicKey: toBase64Url(ecdh.getPublicKey()),
        privateKey: toBase64Url(privateKey),
      };
    } catch {
      // Extremely unlikely invalid P-256 scalar; try the next counter.
    }
  }
  throw new Error('Could not derive a valid VAPID key pair');
}

function configureVapid() {
  if (vapidConfigured) return true;

  let publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  let privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) {
    const fallbackSecret =
      process.env.SESSION_SECRET?.trim() || process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!fallbackSecret) return false;
    ({ publicKey, privateKey } = deriveVapidKeys(fallbackSecret));
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@knreminder.app',
    publicKey,
    privateKey
  );
  activePublicKey = publicKey;
  vapidConfigured = true;
  return true;
}

function getPublicKey() {
  return configureVapid() ? activePublicKey : null;
}

function loadCalendarData() {
  if (calendarData) return calendarData;

  // Use the same calendar dataset rendered by the client so the app and push
  // copy cannot disagree about a holiday or Shabbat entry.
  const dataRoot = path.resolve(__dirname, '../../client/src/data');
  calendarData = {
    holidays: require(path.join(dataRoot, 'holidays.json')),
    shabbat: require(path.join(dataRoot, 'shabbat.json')),
  };
  return calendarData;
}

function asWebPushSubscription(doc) {
  return {
    endpoint: doc.endpoint,
    keys: { p256dh: doc.keys.p256dh, auth: doc.keys.auth },
  };
}

async function sendToSubscription(doc, payload) {
  if (!configureVapid()) return { sent: false, reason: 'vapid-not-configured' };

  try {
    await webpush.sendNotification(asWebPushSubscription(doc), JSON.stringify(payload), {
      TTL: 60 * 60 * 24,
      urgency: payload.urgency || 'normal',
    });
    return { sent: true };
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      await PushSubscription.deleteOne({ _id: doc._id });
      return { sent: false, reason: 'expired-subscription' };
    }
    console.error(`[Push] Send failed for ${doc._id}:`, error.message);
    return { sent: false, reason: error.message };
  }
}

async function sendReminderPush(reminder) {
  if (reminder.type === 'birthday') {
    return { attempted: 0, sent: 0 };
  }

  const reminderPreference = reminder.isImportant
    ? {
        $or: [
          { 'preferences.allReminders': true },
          { 'preferences.importantReminders': true },
        ],
      }
    : { 'preferences.allReminders': true };
  const subscriptions = await PushSubscription.find({
    chatId: reminder.chatId,
    'preferences.enabled': true,
    ...reminderPreference,
  });
  const results = await Promise.all(
    subscriptions.map((subscription) =>
      sendToSubscription(subscription, {
        title: reminder.isImportant ? '⭐ תזכורת חשובה' : '🔔 תזכורת',
        body: reminder.text,
        url: `/?reminder=${reminder._id}`,
        tag: `reminder-${reminder._id}`,
        urgency: 'high',
      })
    )
  );

  return {
    attempted: subscriptions.length,
    sent: results.filter((result) => result.sent).length,
  };
}

function zonedParts(date, timezone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function dateKeyFromParts(parts) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return date.toISOString().slice(0, 10);
}

function isFriday(dateKey) {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay() === 5;
}

async function markDelivered(subscription, key) {
  await PushSubscription.updateOne(
    { _id: subscription._id },
    { $push: { recentNotificationKeys: { $each: [key], $slice: -MAX_RECENT_KEYS } } }
  );
  subscription.recentNotificationKeys.push(key);
}

async function sendCalendarEvent(subscription, key, payload) {
  if (subscription.recentNotificationKeys.includes(key)) return false;
  const result = await sendToSubscription(subscription, payload);
  if (result.sent) await markDelivered(subscription, key);
  return result.sent;
}

async function dispatchBirthdayNotifications(subscription, todayKey) {
  const preferences = subscription.preferences;
  if (!preferences.birthdays) return 0;

  const targetKey = addDays(todayKey, preferences.birthdayDaysBefore || 0);
  const birthdays = await Reminder.find({
    chatId: subscription.chatId,
    type: 'birthday',
    status: { $in: ['active', 'snoozed'] },
  }).lean();

  let sent = 0;
  for (const birthday of birthdays) {
    const birthdayKey = dateKeyFromParts(
      zonedParts(new Date(birthday.reminderAt), preferences.timezone)
    );
    if (birthdayKey !== targetKey) continue;

    const days = preferences.birthdayDaysBefore || 0;
    const timing = days === 0 ? 'היום' : days === 1 ? 'מחר' : `בעוד ${days} ימים`;
    const delivered = await sendCalendarEvent(
      subscription,
      `birthday:${birthday._id}:${targetKey}`,
      {
        title: '🎂 יום הולדת מתקרב',
        body: `${birthday.personName || birthday.text} — ${timing}`,
        url: '/birthdays',
        tag: `birthday-${birthday._id}-${targetKey}`,
      }
    );
    if (delivered) sent += 1;
  }
  return sent;
}

async function dispatchCalendarNotifications(now = new Date()) {
  if (!configureVapid()) return { subscriptions: 0, sent: 0 };

  const subscriptions = await PushSubscription.find({
    'preferences.enabled': true,
    $or: [
      { 'preferences.birthdays': true },
      { 'preferences.holidays': true },
      { 'preferences.shabbat': true },
    ],
  });
  const { holidays, shabbat } = loadCalendarData();
  let sent = 0;

  for (const subscription of subscriptions) {
    const preferences = subscription.preferences;
    const parts = zonedParts(now, preferences.timezone || DEFAULT_TIMEZONE);
    const todayKey = dateKeyFromParts(parts);
    const [birthdayHour] = (
      preferences.birthdayNotificationTime || preferences.notificationTime || '10:00'
    ).split(':');
    const [calendarHour] = (preferences.calendarNotificationTime || '10:00').split(':');

    // Agenda checks every 15 minutes. Matching the hour plus a delivery key is
    // tolerant of restarts while guaranteeing one delivery per event/device.
    if (parts.hour === birthdayHour) {
      sent += await dispatchBirthdayNotifications(subscription, todayKey);
    }

    if (preferences.holidays && parts.hour === calendarHour) {
      const holidayKey = addDays(todayKey, 1);
      const holiday = holidays[holidayKey];
      if (holiday) {
        const delivered = await sendCalendarEvent(subscription, `holiday:${holidayKey}`, {
          title: '🗓️ חג קרוב',
          body: `מחר: ${holiday}`,
          url: `/calendar?date=${holidayKey}`,
          tag: `holiday-${holidayKey}`,
        });
        if (delivered) sent += 1;
      }
    }

    if (preferences.shabbat && parts.hour === calendarHour && isFriday(todayKey)) {
      const friday = shabbat[todayKey];
      const saturdayKey = addDays(todayKey, 1);
      const saturday = shabbat[saturdayKey];
      if (friday || saturday) {
        const body = [friday?.displayText, saturday?.displayText].filter(Boolean).join('\n');
        const delivered = await sendCalendarEvent(subscription, `shabbat:${todayKey}`, {
          title: '🕯️ זמני שבת',
          body,
          url: `/calendar?date=${todayKey}`,
          tag: `shabbat-${todayKey}`,
        });
        if (delivered) sent += 1;
      }
    }
  }

  return { subscriptions: subscriptions.length, sent };
}

module.exports = {
  getPublicKey,
  sendToSubscription,
  sendReminderPush,
  dispatchCalendarNotifications,
};
