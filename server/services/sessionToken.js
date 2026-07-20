/**
 * sessionToken.js — self-contained signed session tokens (no external deps).
 *
 * WHY THIS EXISTS
 *   Chat IDs are not secret, so an attacker could forge the `x-user-chat-id`
 *   header and impersonate another user. To get hard per-request guarantees we
 *   stop trusting a raw chatId and instead issue a *signed* token at login. The
 *   token embeds the chatId and is HMAC-signed with a server-only secret, so the
 *   server can cryptographically verify — on every request — that the caller
 *   truly authenticated and hasn't tampered with their identity.
 *
 * FORMAT
 *   A compact JWT-style string: base64url(header).base64url(payload).base64url(sig)
 *   - header  = { alg: "HS256", typ: "JWT" }
 *   - payload = { sub: <chatId>, name, username, iat, exp }
 *   - sig     = HMAC_SHA256( "header.payload", SESSION_SECRET )
 *   We hand-roll it with Node's built-in crypto to avoid adding a dependency
 *   (jsonwebtoken) that would require an npm install on the production host.
 *
 * SECRET
 *   Signing uses SESSION_SECRET. If unset, we derive a stable fallback from
 *   TELEGRAM_BOT_TOKEN (also server-only) so the feature works out of the box,
 *   but production should set an explicit, high-entropy SESSION_SECRET.
 */

'use strict';

const crypto = require('crypto');

// Tokens are valid for 30 days; the client re-authenticates after expiry.
const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Resolve the signing secret. Never returns empty. */
function getSecret() {
  const explicit = process.env.SESSION_SECRET;
  if (explicit && explicit.trim()) return explicit.trim();

  // Fallback: derive from the bot token so dev/single-config deploys still work.
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken && botToken.trim()) {
    return crypto.createHash('sha256').update(`knr-session:${botToken}`).digest('hex');
  }

  // Last resort for pure local dev with nothing configured. NOT for production.
  return 'knr-insecure-dev-secret-do-not-use-in-production';
}

/** True when a real secret is configured (i.e. not the last-resort dev value). */
function hasStrongSecret() {
  return Boolean(
    (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim()) ||
      (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN.trim())
  );
}

function base64urlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(input) {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64').toString('utf8');
}

function sign(data, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Issue a signed session token for a verified user.
 * @param {{ chatId: string|number, firstName?, username? }} user
 * @param {{ ttlSeconds?: number }} [opts]
 * @returns {string} the compact token
 */
function issueToken(user, opts = {}) {
  if (!user || (user.chatId === undefined || user.chatId === null)) {
    throw new Error('issueToken requires a user with a chatId');
  }
  const ttl = Number.isFinite(opts.ttlSeconds) ? opts.ttlSeconds : DEFAULT_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: String(user.chatId),
    name: user.firstName || null,
    username: user.username || null,
    iat: now,
    exp: now + ttl,
  };

  const encHeader = base64urlEncode(JSON.stringify(header));
  const encPayload = base64urlEncode(JSON.stringify(payload));
  const signature = sign(`${encHeader}.${encPayload}`, getSecret());
  return `${encHeader}.${encPayload}.${signature}`;
}

/**
 * Verify a signed session token.
 * @param {string} token
 * @returns {{ ok: boolean, payload?: object, reason?: string }}
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'missing token' };
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, reason: 'malformed token' };
  }
  const [encHeader, encPayload, signature] = parts;

  // Recompute the signature and compare in constant time.
  const expected = sign(`${encHeader}.${encPayload}`, getSecret());
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad signature' };
  }

  let payload;
  try {
    payload = JSON.parse(base64urlDecode(encPayload));
  } catch {
    return { ok: false, reason: 'unparseable payload' };
  }

  if (!payload || !payload.sub) {
    return { ok: false, reason: 'no subject' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Number.isFinite(payload.exp) && now > payload.exp) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, payload };
}

module.exports = {
  issueToken,
  verifyToken,
  hasStrongSecret,
  DEFAULT_TTL_SECONDS,
};
