/**
 * routes/telegram.js
 *
 * Telegram-facing endpoints:
 *   POST /api/telegram/webhook          — receives all Telegram updates (production)
 *   POST /api/telegram/setup-webhook    — registers the webhook URL with Telegram
 *   POST /api/telegram/delete-webhook   — removes webhook (enables local polling)
 *   GET  /api/telegram/status           — bot health check + current webhook info
 *   POST /api/telegram/test-notification— sends a test message immediately (dev/staging)
 *   POST /api/telegram/fire/:id         — manually fires a specific reminder NOW (dev only)
 */

const express = require('express');
const router  = express.Router();

const Reminder       = require('../models/Reminder');
const { scheduleReminder } = require('../services/agendaService');
const {
  handleTelegramUpdate,
  sendReminderNotification,
  sendMessage,
  registerWebhook,
  deleteWebhook,
  verifyBotToken,
} = require('../services/telegramService');
const asyncHandler = require('../middleware/asyncHandler');

// ─── POST /api/telegram/webhook ───────────────────────────────────────────────
// Telegram sends ALL updates (callback_query, message) here.
// RULE: Must ALWAYS return HTTP 200 immediately, even on errors.
//       Telegram retries failed deliveries for up to 24 hours.
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    // Acknowledge first — before any async work
    res.status(200).json({ ok: true });

    // Delegate to the shared update handler (also used by polling)
    try {
      await handleTelegramUpdate(req.body);
    } catch (err) {
      // Log but never throw — Telegram already got its 200
      console.error('[Telegram Webhook] Unhandled error:', err.message);
    }
  })
);

// ─── GET /api/telegram/status ─────────────────────────────────────────────────
// Returns bot identity + webhook info. Use this to verify credentials work.
// Example: curl http://localhost:5000/api/telegram/status
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    const missingVars = [];
    if (!process.env.TELEGRAM_BOT_TOKEN) missingVars.push('TELEGRAM_BOT_TOKEN');
    if (!process.env.TELEGRAM_CHAT_ID)   missingVars.push('TELEGRAM_CHAT_ID');

    if (missingVars.length > 0) {
      return res.status(503).json({
        ok:      false,
        message: `חסרות משתני סביבה: ${missingVars.join(', ')}`,
        missing: missingVars,
      });
    }

    // Call Telegram API to verify the token is valid
    const botInfo = await verifyBotToken();

    res.json({
      ok:       true,
      bot:      botInfo,
      chat_id:  process.env.TELEGRAM_CHAT_ID,
      env:      process.env.NODE_ENV,
      message:  '✅ Bot token is valid and credentials are configured.',
    });
  })
);

// ─── POST /api/telegram/test-notification ────────────────────────────────────
// Sends a real Telegram message immediately to verify the full pipeline.
// Use this to confirm your TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are correct.
// Example: curl -X POST http://localhost:5000/api/telegram/test-notification
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/test-notification',
  asyncHandler(async (req, res) => {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!process.env.TELEGRAM_BOT_TOKEN || !chatId) {
      return res.status(503).json({
        ok:      false,
        message: 'TELEGRAM_BOT_TOKEN ו-TELEGRAM_CHAT_ID חייבים להיות מוגדרים ב-.env',
      });
    }

    // Build a fake reminder-like object for the test
    const fakeReminder = {
      _id:         { toString: () => 'TEST000000000000000000' },
      text:        req.body?.text || '🧪 זוהי תזכורת בדיקה מ-KN Reminder',
      reminderAt:  new Date(),
      isRecurring: false,
      snoozeCount: 0,
    };

    await sendReminderNotification(fakeReminder);

    res.json({
      ok:      true,
      message: `✅ הודעת בדיקה נשלחה ל-chat_id ${chatId}. בדוק את טלגרם שלך!`,
    });
  })
);

// ─── POST /api/telegram/fire/:id ─────────────────────────────────────────────
// Immediately sends the Telegram notification for an existing reminder.
// Useful for testing the full Agenda → Telegram → inline-buttons pipeline.
// Example: curl -X POST http://localhost:5000/api/telegram/fire/6abc123...
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/fire/:id',
  asyncHandler(async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        ok:      false,
        message: 'נקודת קצה זו זמינה בסביבת פיתוח בלבד',
      });
    }

    const reminder = await Reminder.findById(req.params.id);
    if (!reminder) {
      return res.status(404).json({ ok: false, message: 'תזכורת לא נמצאה' });
    }
    if (reminder.status !== 'active') {
      return res.status(400).json({
        ok:      false,
        message: `תזכורת במצב "${reminder.status}" — לא ניתן לשגר`,
      });
    }

    await sendReminderNotification(reminder);

    res.json({
      ok:       true,
      message:  `✅ הודעה נשלחה עבור: "${reminder.text}"`,
      reminder: { id: reminder._id, text: reminder.text, reminderAt: reminder.reminderAt },
    });
  })
);

// ─── POST /api/telegram/setup-webhook ────────────────────────────────────────
// Registers the webhook URL with Telegram (call once after production deploy).
// Body: { "url": "https://your-railway-app.railway.app" }
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/setup-webhook',
  asyncHandler(async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ ok: false, message: 'נא לספק שדה "url" בגוף הבקשה' });
    }
    const result = await registerWebhook(url);
    res.json({ ok: true, result });
  })
);

// ─── POST /api/telegram/delete-webhook ───────────────────────────────────────
// Removes the webhook (switches back to long-polling mode for local dev).
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/delete-webhook',
  asyncHandler(async (req, res) => {
    const result = await deleteWebhook();
    res.json({ ok: true, result });
  })
);

module.exports = router;
