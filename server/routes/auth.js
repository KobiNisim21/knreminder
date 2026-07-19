/**
 * routes/auth.js
 *
 * Telegram Login authentication.
 *
 *   POST /api/auth/telegram   — verify a Telegram Login Widget payload and,
 *                               on success, return the verified chatId + profile.
 *
 * The Telegram Login Widget hands the browser a signed payload:
 *   { id, first_name, last_name, username, photo_url, auth_date, hash }
 * We verify the `hash` server-side using the bot token (which only the server
 * knows), following Telegram's documented algorithm:
 *   secret_key      = SHA256(bot_token)
 *   data_check_str  = "key=value" for every field except `hash`, sorted, \n-joined
 *   expected_hash   = HMAC_SHA256(data_check_str, secret_key)
 * A matching hash proves the payload genuinely came from Telegram and was not
 * forged, so the `id` field is a trustworthy chat ID we can bind the session to.
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');

// Reject login payloads older than this — limits replay of a captured payload.
const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60; // 24h

/**
 * Verify a Telegram Login Widget payload.
 * @returns {{ ok: boolean, reason?: string }}
 */
function verifyTelegramLogin(payload, botToken) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, reason: 'empty payload' };
  }
  const { hash, ...fields } = payload;
  if (!hash) return { ok: false, reason: 'missing hash' };

  // Build the data-check string: every field except hash, sorted by key.
  const dataCheckString = Object.keys(fields)
    .filter((k) => fields[k] !== undefined && fields[k] !== null)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const expectedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // Constant-time comparison to avoid timing side channels.
  const a = Buffer.from(expectedHash, 'hex');
  const b = Buffer.from(String(hash), 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'hash mismatch' };
  }

  // Freshness check — reject stale payloads.
  const authDate = Number(fields.auth_date);
  if (Number.isFinite(authDate)) {
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
    if (ageSeconds > MAX_AUTH_AGE_SECONDS) {
      return { ok: false, reason: 'auth_date expired' };
    }
  }

  return { ok: true };
}

// ─── POST /api/auth/telegram ──────────────────────────────────────────────────
// Body: the raw object emitted by the Telegram Login Widget.
router.post(
  '/telegram',
  asyncHandler(async (req, res) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const payload = req.body || {};

    // ── Dev fallback ────────────────────────────────────────────────────────────
    // When no bot token is configured (pure local dev) OR the client explicitly
    // asks for dev login, trust a plainly-supplied chatId. NEVER in production.
    const isDevLogin =
      process.env.NODE_ENV !== 'production' &&
      (!botToken || payload.dev === true) &&
      payload.id;

    if (isDevLogin) {
      return res.json({
        success: true,
        dev: true,
        user: {
          chatId: String(payload.id),
          firstName: payload.first_name || 'מפתח',
          username: payload.username || null,
          photoUrl: payload.photo_url || null,
        },
      });
    }

    if (!botToken) {
      return res.status(503).json({
        success: false,
        message: 'TELEGRAM_BOT_TOKEN לא מוגדר בשרת',
      });
    }

    const result = verifyTelegramLogin(payload, botToken);
    if (!result.ok) {
      return res.status(401).json({
        success: false,
        message: 'אימות טלגרם נכשל',
        reason: result.reason,
      });
    }

    return res.json({
      success: true,
      user: {
        chatId: String(payload.id),
        firstName: payload.first_name || null,
        lastName: payload.last_name || null,
        username: payload.username || null,
        photoUrl: payload.photo_url || null,
      },
    });
  })
);

module.exports = router;
module.exports.verifyTelegramLogin = verifyTelegramLogin;
