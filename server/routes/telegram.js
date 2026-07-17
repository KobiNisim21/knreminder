const express = require('express');
const router = express.Router();

const Reminder = require('../models/Reminder');
const { scheduleReminder, cancelReminderJob } = require('../services/agendaService');
const {
  answerCallbackQuery,
  clearInlineKeyboard,
  registerWebhook,
  deleteWebhook,
} = require('../services/telegramService');
const asyncHandler = require('../middleware/asyncHandler');

// ─── POST /api/telegram/webhook ───────────────────────────────────────────────
// Telegram sends all updates (callback_query, message) to this endpoint.
// This route MUST always return HTTP 200 — Telegram will retry failed deliveries
// for up to 24 hours.
router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    // Acknowledge immediately so Telegram doesn't retry
    res.json({ ok: true });

    const update = req.body;
    if (!update) return;

    // ── Handle inline keyboard button taps ──────────────────────────────────────
    if (update.callback_query) {
      const { id: callbackQueryId, data, message } = update.callback_query;
      const chatId = message?.chat?.id;
      const messageId = message?.message_id;

      try {
        await handleCallbackQuery({ callbackQueryId, data, chatId, messageId });
      } catch (err) {
        console.error('[Telegram Webhook] Callback query error:', err.message);
      }
    }

    // ── Handle /start command (useful for first-time setup) ─────────────────────
    if (update.message?.text === '/start') {
      const chatId = update.message.chat.id;
      const { sendMessage } = require('../services/telegramService');
      await sendMessage(
        chatId,
        `👋 *שלום!*\n\nאני בוט התזכורות שלך.\nאני אשלח לך תזכורות בזמן שתקבע באפליקציה.\n\n_Chat ID שלך: ${chatId}_`
      );
    }
  })
);

// ─── Callback query handler ───────────────────────────────────────────────────

async function handleCallbackQuery({ callbackQueryId, data, chatId, messageId }) {
  if (!data) return;

  // Parse callback_data format:
  //   snooze_<minutes>_<reminderId>  →  ['snooze', '15', '<id>']
  //   done_<reminderId>              →  ['done', '<id>']
  const parts = data.split('_');
  const action = parts[0];

  if (action === 'snooze') {
    const minutes = parseInt(parts[1], 10);
    const reminderId = parts.slice(2).join('_');

    const reminder = await Reminder.findById(reminderId);
    if (!reminder || reminder.status === 'completed') {
      await answerCallbackQuery(callbackQueryId, '⚠️ תזכורת זו כבר לא פעילה', true);
      return;
    }

    const newTime = new Date(Date.now() + minutes * 60 * 1000);
    reminder.reminderAt = newTime;
    reminder.snoozeCount += 1;
    reminder.status = 'active';
    reminder.notified = false;
    await reminder.save();

    await scheduleReminder(reminder);
    await answerCallbackQuery(
      callbackQueryId,
      `⏰ יזכיר אותך בעוד ${minutes === 60 ? 'שעה' : `${minutes} דקות`}`,
      false
    );
    await clearInlineKeyboard(chatId, messageId);

    console.log(`[Telegram] Snoozed reminder ${reminderId} by ${minutes} minutes`);

  } else if (action === 'done') {
    const reminderId = parts.slice(1).join('_');

    const reminder = await Reminder.findById(reminderId);
    if (!reminder) {
      await answerCallbackQuery(callbackQueryId, '⚠️ תזכורת לא נמצאה', true);
      return;
    }
    if (reminder.status === 'completed') {
      await answerCallbackQuery(callbackQueryId, '✅ תזכורת כבר הושלמה');
      await clearInlineKeyboard(chatId, messageId);
      return;
    }

    await cancelReminderJob(reminderId);
    reminder.status = 'completed';
    reminder.completedAt = new Date();
    await reminder.save(); // pre-save hook sets expiresAt

    await answerCallbackQuery(callbackQueryId, '✅ תזכורת סומנה כבוצע!', false);
    await clearInlineKeyboard(chatId, messageId);

    console.log(`[Telegram] Marked reminder ${reminderId} as completed via Telegram`);
  } else {
    // Unknown action — acknowledge silently
    await answerCallbackQuery(callbackQueryId, '');
  }
}

// ─── POST /api/telegram/setup-webhook ────────────────────────────────────────
// Call this once after deploying to production to register the webhook URL.
// Body: { "url": "https://your-railway-app.railway.app" }
router.post(
  '/setup-webhook',
  asyncHandler(async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, message: 'נא לספק URL' });
    }
    const result = await registerWebhook(url);
    res.json({ success: true, result });
  })
);

// ─── POST /api/telegram/delete-webhook ───────────────────────────────────────
// Removes the webhook (use for local dev / testing with getUpdates polling).
router.post(
  '/delete-webhook',
  asyncHandler(async (req, res) => {
    const result = await deleteWebhook();
    res.json({ success: true, result });
  })
);

module.exports = router;
