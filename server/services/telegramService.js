/**
 * telegramService.js
 *
 * All Telegram Bot API interactions live here:
 *   - sendReminderNotification  → fires when an Agenda job triggers
 *   - handleTelegramUpdate      → shared update processor (used by both webhook & polling)
 *   - startPolling / stopPolling → long-polling for local dev (no public HTTPS needed)
 *   - registerWebhook / deleteWebhook → production webhook management
 *   - verifyBotToken            → health check for tests
 */

const axios = require('axios');
const Reminder = require('../models/Reminder');
const { scheduleReminder, cancelReminderJob } = require('./agendaService');

// ─── Constants ────────────────────────────────────────────────────────────────

const RECURRENCE_LABELS = {
  daily:   'כל יום',
  weekly:  'כל שבוע',
  monthly: 'כל חודש',
  yearly:  'כל שנה',
};

/** Returns the Telegram Bot API base URL. Built lazily so .env is loaded first. */
const apiBase = () =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// ─── Core API helpers ─────────────────────────────────────────────────────────

/** Send any message to a chat, with optional extra params (reply_markup, etc.) */
async function sendMessage(chatId, text, extra = {}) {
  const response = await axios.post(`${apiBase()}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    ...extra,
  });
  return response.data;
}

/** Dismiss the "loading" spinner on an inline button after the user taps it. */
async function answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
  await axios.post(`${apiBase()}/answerCallbackQuery`, {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}

/** Remove inline keyboard from a sent message (prevents double-taps). */
async function clearInlineKeyboard(chatId, messageId) {
  try {
    await axios.post(`${apiBase()}/editMessageReplyMarkup`, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    });
  } catch (err) {
    // Ignore "message not modified" errors (Telegram returns 400 if already cleared)
    if (!err.response?.data?.description?.includes('message is not modified')) {
      console.error('[Telegram] clearInlineKeyboard error:', err.message);
    }
  }
}

/** Verify the bot token is valid. Returns bot info or throws. */
async function verifyBotToken() {
  const response = await axios.get(`${apiBase()}/getMe`);
  return response.data.result;
}

// ─── Reminder notification ────────────────────────────────────────────────────

/**
 * Sends the main reminder notification with Hebrew inline action buttons.
 * Called by the Agenda.js 'send reminder' job.
 *
 * Keyboard layout:
 *   [ ⏰ סנוז 15 דק' ] [ ⏰ סנוז שעה ] [ ✅ בוצע ]
 *
 * callback_data format:
 *   snooze_<minutes>_<reminderId>   →  snooze action
 *   done_<reminderId>               →  mark complete
 */
async function sendReminderNotification(reminder) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId || !process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('[Telegram] BOT_TOKEN or CHAT_ID not configured — skipping notification.');
    return null;
  }

  const id = reminder._id.toString();

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
    `⏰ ${formatHebrewDate(reminder.reminderAt)}` +
    recurrenceLabel +
    snoozeInfo;

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

// ─── Shared update handler (webhook + polling both call this) ─────────────────

/**
 * Process a single Telegram update object.
 * Handles: callback_query (button taps) + message (/start command).
 *
 * This is the single source of truth — both the webhook route and the
 * polling loop delegate here so logic is never duplicated.
 *
 * @param {object} update - Raw Telegram update object
 */
async function handleTelegramUpdate(update) {
  if (!update) return;

  // ── Inline keyboard button tap ─────────────────────────────────────────────
  if (update.callback_query) {
    const { id: callbackQueryId, data, message } = update.callback_query;
    const chatId    = message?.chat?.id;
    const messageId = message?.message_id;

    if (!data) {
      await answerCallbackQuery(callbackQueryId, '');
      return;
    }

    // Parse callback_data:
    //   "snooze_15_<mongoId>"  → action=snooze, minutes=15
    //   "done_<mongoId>"       → action=done
    const parts   = data.split('_');
    const action  = parts[0];

    if (action === 'snooze') {
      await handleSnooze({
        callbackQueryId,
        chatId,
        messageId,
        minutes:    parseInt(parts[1], 10),
        reminderId: parts.slice(2).join('_'),
      });

    } else if (action === 'done') {
      await handleDone({
        callbackQueryId,
        chatId,
        messageId,
        reminderId: parts.slice(1).join('_'),
      });

    } else {
      await answerCallbackQuery(callbackQueryId, '');
    }
  }

  // ── /start or /chatid command ──────────────────────────────────────────────
  if (update.message) {
    const { text, chat } = update.message;
    const chatId = chat?.id;
    if (!chatId) return;

    if (text === '/start' || text === '/chatid') {
      await sendMessage(
        chatId,
        `👋 *שלום!*\n\nאני בוט התזכורות שלך.\nאני אשלח לך תזכורות בזמן שתקבע באפליקציה.\n\n` +
        `📋 *ה-Chat ID שלך:*\n\`${chatId}\`\n\n` +
        `העתק את המספר הזה לתוך \`TELEGRAM_CHAT_ID\` ב-\`.env\` של השרת.`
      );
    }
  }
}

// ─── Action handlers ──────────────────────────────────────────────────────────

async function handleSnooze({ callbackQueryId, chatId, messageId, minutes, reminderId }) {
  if (!minutes || isNaN(minutes) || minutes <= 0) {
    await answerCallbackQuery(callbackQueryId, '⚠️ ערך זמן לא תקין', true);
    return;
  }

  const reminder = await Reminder.findById(reminderId);
  if (!reminder || reminder.status === 'completed') {
    await answerCallbackQuery(callbackQueryId, '⚠️ תזכורת זו כבר לא פעילה', true);
    return;
  }

  const newTime          = new Date(Date.now() + minutes * 60 * 1000);
  reminder.reminderAt    = newTime;
  reminder.snoozeCount  += 1;
  reminder.status        = 'active';
  reminder.notified      = false;
  await reminder.save();

  await scheduleReminder(reminder);

  const label = minutes === 60 ? 'שעה' : minutes === 15 ? '15 דקות' : `${minutes} דקות`;
  await answerCallbackQuery(callbackQueryId, `⏰ יזכיר אותך בעוד ${label}`, false);
  await clearInlineKeyboard(chatId, messageId);

  console.log(`[Telegram] 💤 Snoozed reminder "${reminder.text}" by ${minutes}min → ${newTime.toISOString()}`);
}

async function handleDone({ callbackQueryId, chatId, messageId, reminderId }) {
  const reminder = await Reminder.findById(reminderId);
  if (!reminder) {
    await answerCallbackQuery(callbackQueryId, '⚠️ תזכורת לא נמצאה', true);
    return;
  }
  if (reminder.status === 'completed') {
    await answerCallbackQuery(callbackQueryId, '✅ כבר סומנה כבוצע');
    await clearInlineKeyboard(chatId, messageId);
    return;
  }

  await cancelReminderJob(reminderId);
  reminder.status      = 'completed';
  reminder.completedAt = new Date();
  await reminder.save(); // pre-save hook sets expiresAt = completedAt + 90 days

  await answerCallbackQuery(callbackQueryId, '✅ תזכורת סומנה כבוצע!', false);
  await clearInlineKeyboard(chatId, messageId);

  console.log(`[Telegram] ✅ Marked "${reminder.text}" as completed via Telegram`);
}

// ─── Local dev: long-polling ──────────────────────────────────────────────────

let pollingActive = false;
let pollingOffset = 0;

/**
 * Start long-polling mode for local development.
 * Uses getUpdates instead of a webhook — no public HTTPS URL needed.
 * Automatically stops when the process exits.
 *
 * IMPORTANT: You must call `deleteWebhook()` first if a webhook is registered,
 * otherwise Telegram will ignore getUpdates calls.
 */
async function startPolling() {
  if (pollingActive) {
    console.log('[Telegram Polling] Already running.');
    return;
  }
  pollingActive = true;
  console.log('[Telegram Polling] 🔄 Starting long-polling (local dev mode)...');

  // eslint-disable-next-line no-constant-condition
  while (pollingActive) {
    try {
      const response = await axios.get(`${apiBase()}/getUpdates`, {
        params: {
          offset:           pollingOffset,
          timeout:          30,
          allowed_updates:  ['callback_query', 'message'],
        },
        timeout: 35_000, // slightly longer than the Telegram long-poll timeout
      });

      const updates = response.data?.result ?? [];
      for (const update of updates) {
        pollingOffset = update.update_id + 1; // advance offset BEFORE processing
        try {
          await handleTelegramUpdate(update);
        } catch (err) {
          console.error('[Telegram Polling] Update handling error:', err.message);
        }
      }
    } catch (err) {
      if (pollingActive) {
        console.error('[Telegram Polling] Fetch error:', err.message);
        await sleep(5000); // wait 5s before retrying on network error
      }
    }
  }

  console.log('[Telegram Polling] Stopped.');
}

function stopPolling() {
  pollingActive = false;
}

// ─── Webhook management ───────────────────────────────────────────────────────

/**
 * Register the production webhook URL with Telegram.
 * @param {string} serverUrl - Public HTTPS base URL, e.g. "https://my-app.railway.app"
 */
async function registerWebhook(serverUrl) {
  const webhookUrl = `${serverUrl}/api/telegram/webhook`;
  const response   = await axios.post(`${apiBase()}/setWebhook`, {
    url:                 webhookUrl,
    allowed_updates:     ['callback_query', 'message'],
    drop_pending_updates: true,
  });
  console.log(`[Telegram] ✅ Webhook registered → ${webhookUrl}`);
  return response.data;
}

/** Remove webhook (allows getUpdates polling). */
async function deleteWebhook() {
  const response = await axios.post(`${apiBase()}/deleteWebhook`, {
    drop_pending_updates: true,
  });
  console.log('[Telegram] Webhook deleted — polling mode available.');
  return response.data;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatHebrewDate(date) {
  return new Intl.DateTimeFormat('he-IL', {
    weekday:  'long',
    day:      'numeric',
    month:    'long',
    year:     'numeric',
    hour:     '2-digit',
    minute:   '2-digit',
    timeZone: process.env.TZ || 'Asia/Jerusalem',
  }).format(new Date(date));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Core
  sendMessage,
  answerCallbackQuery,
  clearInlineKeyboard,
  verifyBotToken,
  // Notification
  sendReminderNotification,
  // Shared update processor
  handleTelegramUpdate,
  // Long-polling (dev)
  startPolling,
  stopPolling,
  // Webhook (prod)
  registerWebhook,
  deleteWebhook,
  // Constants
  RECURRENCE_LABELS,
};
