const axios = require('axios');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the base URL for Telegram Bot API calls.
 * Built lazily so process.env is always loaded before use.
 */
const apiBase = () =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

/**
 * Formats a Date object into a Hebrew-locale string in Israel timezone.
 * Example output: "יום ה׳, 17 ביולי 2026, 18:00"
 */
function formatHebrewDate(date) {
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: process.env.TZ || 'Asia/Jerusalem',
  }).format(new Date(date));
}

// ─── Core Telegram API helpers ────────────────────────────────────────────────

/**
 * Send any message to a Telegram chat.
 */
async function sendMessage(chatId, text, extra = {}) {
  const response = await axios.post(`${apiBase()}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    ...extra,
  });
  return response.data;
}

/**
 * Answer a callback_query (required to dismiss the "loading" state on inline buttons).
 */
async function answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
  await axios.post(`${apiBase()}/answerCallbackQuery`, {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}

/**
 * Remove all inline keyboard buttons from an already-sent message
 * (called after the user taps Snooze or Done, to prevent double-taps).
 */
async function clearInlineKeyboard(chatId, messageId) {
  await axios.post(`${apiBase()}/editMessageReplyMarkup`, {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  });
}

// ─── Reminder notification ────────────────────────────────────────────────────

/**
 * Sends the main reminder notification with Hebrew inline action buttons.
 *
 * Inline keyboard layout:
 *   [ ⏰ סנוז 15 דק' ]  [ ⏰ סנוז שעה ]  [ ✅ בוצע ]
 *
 * callback_data format:
 *   snooze_<minutes>_<reminderId>   →  snooze action
 *   done_<reminderId>               →  mark complete action
 */
async function sendReminderNotification(reminder) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId || !process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('[Telegram] BOT_TOKEN or CHAT_ID not configured. Skipping notification.');
    return;
  }

  const id = reminder._id.toString();
  const formattedTime = formatHebrewDate(reminder.reminderAt);

  // Build the message text
  const isRecurring = reminder.isRecurring && reminder.recurrence;
  const recurrenceLabel = isRecurring
    ? `\n🔁 *חוזרת:* ${RECURRENCE_LABELS[reminder.recurrence.frequency]}`
    : '';
  const snoozeInfo =
    reminder.snoozeCount > 0
      ? `\n💤 *נדחתה:* ${reminder.snoozeCount} פעמים`
      : '';

  const text =
    `🔔 *תזכורת*\n\n` +
    `📝 ${reminder.text}\n` +
    `⏰ ${formattedTime}` +
    recurrenceLabel +
    snoozeInfo;

  // Inline keyboard — Hebrew buttons with emoji
  const reply_markup = {
    inline_keyboard: [
      [
        { text: "⏰ סנוז 15 דק'", callback_data: `snooze_15_${id}` },
        { text: '⏰ סנוז שעה',    callback_data: `snooze_60_${id}` },
        { text: '✅ בוצע',         callback_data: `done_${id}` },
      ],
    ],
  };

  return sendMessage(chatId, text, { reply_markup });
}

// ─── Webhook setup ────────────────────────────────────────────────────────────

/**
 * Registers the Telegram webhook URL with Bot API.
 * Call this once after deploying to production.
 *
 * @param {string} serverUrl - The publicly accessible base URL of your server.
 *   Example: "https://kn-reminder.railway.app"
 */
async function registerWebhook(serverUrl) {
  const webhookUrl = `${serverUrl}/api/telegram/webhook`;
  const response = await axios.post(`${apiBase()}/setWebhook`, {
    url: webhookUrl,
    allowed_updates: ['callback_query', 'message'],
    drop_pending_updates: true,
  });
  console.log(`[Telegram] Webhook registered → ${webhookUrl}`);
  return response.data;
}

/**
 * Removes the webhook (switches bot back to long-polling mode for local dev).
 */
async function deleteWebhook() {
  const response = await axios.post(`${apiBase()}/deleteWebhook`, {
    drop_pending_updates: true,
  });
  return response.data;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RECURRENCE_LABELS = {
  daily: 'כל יום',
  weekly: 'כל שבוע',
  monthly: 'כל חודש',
  yearly: 'כל שנה',
};

module.exports = {
  sendMessage,
  answerCallbackQuery,
  clearInlineKeyboard,
  sendReminderNotification,
  registerWebhook,
  deleteWebhook,
  RECURRENCE_LABELS,
};
