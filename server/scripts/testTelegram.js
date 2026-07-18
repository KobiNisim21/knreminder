/**
 * testTelegram.js — Standalone E2E test script for Telegram integration.
 *
 * Run from the server/ directory:
 *   node scripts/testTelegram.js
 *
 * Or as an npm script (add to server/package.json):
 *   "test:telegram": "node scripts/testTelegram.js"
 *
 * What it tests:
 *   1. .env loading and required variable presence
 *   2. Bot token validity (getMe)
 *   3. Sending a plain message to your chat
 *   4. Sending a full reminder notification with inline keyboard buttons
 *
 * Expected output: 4 green checkmarks in the terminal.
 * If any step fails, the error message tells you exactly what to fix.
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

// ─── Colors ───────────────────────────────────────────────────────────────────
const GREEN  = (s) => `\x1b[32m${s}\x1b[0m`;
const RED    = (s) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;
const BOLD   = (s) => `\x1b[1m${s}\x1b[0m`;

const pass = (label) => console.log(GREEN(`  ✅  ${label}`));
const fail = (label, err) => {
  console.log(RED(`  ❌  ${label}`));
  if (err) console.log(RED(`       → ${err}`));
};

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
const apiBase   = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log(BOLD('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(BOLD('  KN Reminder — Telegram Integration Test'));
  console.log(BOLD('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('');

  let allPassed = true;

  // ── Step 1: Check env variables ──────────────────────────────────────────────
  console.log(BOLD('Step 1 — Environment Variables'));
  const missing = [];
  if (!BOT_TOKEN || BOT_TOKEN === 'your_bot_token_here') missing.push('TELEGRAM_BOT_TOKEN');
  if (!CHAT_ID   || CHAT_ID   === 'your_chat_id_here')   missing.push('TELEGRAM_CHAT_ID');

  if (missing.length > 0) {
    missing.forEach((v) => fail(v, `not set or still has placeholder value`));
    console.log('');
    console.log(YELLOW('  → Open server/.env and fill in your real credentials.'));
    console.log(YELLOW('  → To get your CHAT_ID: message the bot /start and check the server logs.'));
    console.log('');
    process.exit(1);
  }
  pass(`TELEGRAM_BOT_TOKEN is set (${BOT_TOKEN.slice(0, 10)}…)`);
  pass(`TELEGRAM_CHAT_ID is set (${CHAT_ID})`);
  console.log('');

  // ── Step 2: Verify bot token (getMe) ────────────────────────────────────────
  console.log(BOLD('Step 2 — Bot Token Validation (getMe)'));
  let botUsername;
  try {
    const res = await axios.get(`${apiBase}/getMe`, { timeout: 8000 });
    const bot = res.data.result;
    botUsername = bot.username;
    pass(`Bot is valid: @${bot.username} (id: ${bot.id})`);
  } catch (err) {
    allPassed = false;
    const errMsg = err.response?.data?.description || err.message;
    fail('getMe failed', errMsg);
    console.log(YELLOW('\n  → Your TELEGRAM_BOT_TOKEN is wrong. Generate a new token with @BotFather.'));
    console.log('');
    process.exit(1);
  }
  console.log('');

  // ── Step 3: Send a plain message ────────────────────────────────────────────
  console.log(BOLD('Step 3 — Send Plain Text Message'));
  try {
    await axios.post(`${apiBase}/sendMessage`, {
      chat_id:    CHAT_ID,
      text:       `🧪 *בדיקת חיבור — KN Reminder*\n\nהשרת מחובר לבוט @${botUsername} בהצלחה!\nזמן בדיקה: ${new Date().toLocaleTimeString('he-IL')}`,
      parse_mode: 'Markdown',
    }, { timeout: 8000 });
    pass(`Plain message sent to chat_id ${CHAT_ID}`);
  } catch (err) {
    allPassed = false;
    const errMsg = err.response?.data?.description || err.message;
    fail('sendMessage failed', errMsg);

    if (errMsg?.includes('chat not found')) {
      console.log(YELLOW('\n  → Your TELEGRAM_CHAT_ID is wrong.'));
      console.log(YELLOW('  → Fix: message the bot /chatid and copy the number shown in your chat.'));
    } else if (errMsg?.includes('Forbidden')) {
      console.log(YELLOW('\n  → The bot cannot message this chat.'));
      console.log(YELLOW('  → Fix: Open Telegram, find your bot, and send it /start first.'));
    }
    console.log('');
  }
  console.log('');

  // ── Step 4: Send a full reminder notification with inline keyboard ──────────
  console.log(BOLD('Step 4 — Send Reminder Notification with Inline Keyboard'));
  const fakeReminder = {
    _id:         { toString: () => 'TEST000000000000000000' },
    text:        '📋 קפה עם דני',
    reminderAt:  new Date(Date.now() + 30 * 60 * 1000), // 30 min from now
    isRecurring: false,
    snoozeCount: 0,
  };

  const inlineKeyboard = {
    inline_keyboard: [[
      { text: "⏰ סנוז 15 דק'", callback_data: `snooze_15_TEST000000000000000000` },
      { text: '⏰ סנוז שעה',    callback_data: `snooze_60_TEST000000000000000000` },
      { text: '✅ בוצע',         callback_data: `done_TEST000000000000000000`     },
    ]],
  };

  const reminderText =
    `🔔 *תזכורת*\n\n` +
    `📝 ${fakeReminder.text}\n` +
    `⏰ ${new Intl.DateTimeFormat('he-IL', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Jerusalem',
    }).format(fakeReminder.reminderAt)}\n\n` +
    `_הכפתורים למטה יעבדו רק כשמחובר לשרת פעיל_`;

  try {
    await axios.post(`${apiBase}/sendMessage`, {
      chat_id:      CHAT_ID,
      text:         reminderText,
      parse_mode:   'Markdown',
      reply_markup: inlineKeyboard,
    }, { timeout: 8000 });
    pass('Reminder message with inline keyboard sent!');
    pass(`Tap the buttons in Telegram to test the webhook/polling handler`);
  } catch (err) {
    allPassed = false;
    const errMsg = err.response?.data?.description || err.message;
    fail('Reminder notification failed', errMsg);
  }
  console.log('');

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(BOLD('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  if (allPassed) {
    console.log(GREEN(BOLD('  ✅  All tests passed!')));
    console.log('');
    console.log('  Next steps:');
    console.log('  1. Run: cd server && npm run dev');
    console.log('  2. Check the terminal for "🤖 Telegram long-polling started"');
    console.log('  3. Tap the "סנוז" / "בוצע" buttons in Telegram');
    console.log('  4. Watch the server logs for [Telegram] ✅ / 💤 messages');
  } else {
    console.log(RED(BOLD('  ❌  Some tests failed — see errors above.')));
  }
  console.log(BOLD('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('');
}

main().catch((err) => {
  console.error(RED('Fatal error:'), err.message);
  process.exit(1);
});
