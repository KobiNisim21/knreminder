/**
 * loginSessionStore.js — ephemeral store for Telegram deep-link login sessions.
 *
 * FLOW
 *   1. The web client asks the server to start a login session. We mint a
 *      cryptographically-random sessionId and remember it as "pending".
 *   2. The client sends the user to  https://t.me/<bot>?start=auth_<sessionId>
 *      and begins polling the session's status.
 *   3. When the user taps "Start" in their Telegram app, the bot receives a
 *      "/start auth_<sessionId>" update. The webhook handler calls claim() with
 *      the sender's verified chat info — Telegram itself vouches for that id, so
 *      no HMAC dance is needed. We mint a signed session token and attach it.
 *   4. The client's next poll sees status "authenticated" and receives the token.
 *
 * WHY IN-MEMORY (not Mongo)
 *   These records live for at most a few minutes and carry no long-term value —
 *   they're a handshake, not user data. A Map with a periodic sweep is simpler,
 *   faster, and leaves nothing to clean up. The trade-off: sessions don't survive
 *   a server restart and aren't shared across multiple server instances. For a
 *   single-instance deployment that's fine; see NOTE at bottom if you scale out.
 *
 * SECURITY
 *   - sessionId is 16 random bytes (128 bits) — unguessable, so an attacker can't
 *     hijack someone else's pending login by racing to poll it. (Kept at 16 bytes
 *     so "auth_<id>" fits Telegram's 64-char start-parameter limit.)
 *   - Sessions are single-use: once the token is read by a successful poll, the
 *     session is deleted, so a leaked sessionId can't be replayed.
 *   - Sessions expire after TTL_MS whether or not they're ever claimed.
 */

'use strict';

const crypto = require('crypto');
const { issueToken } = require('./sessionToken');

// A pending login is only useful for a short window — the user is actively
// waiting on the web page. Five minutes is generous for switching apps.
const TTL_MS = 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

/** @type {Map<string, { status, createdAt, user?, token? }>} */
const sessions = new Map();

/**
 * Create a new pending login session. Returns its unguessable id.
 * 16 bytes → 32 hex chars = 128 bits of entropy. This is deliberately shorter
 * than a full 32-byte id because it must fit inside Telegram's `start` deep-link
 * parameter, which is capped at 64 chars ("auth_" prefix + 32 hex = 37).
 */
function createSession() {
  const sessionId = crypto.randomBytes(16).toString('hex');
  sessions.set(sessionId, { status: 'pending', createdAt: Date.now() });
  return sessionId;
}

function isExpired(entry) {
  return Date.now() - entry.createdAt > TTL_MS;
}

/**
 * Bind a verified Telegram user to a pending session and mint their token.
 * Called from the webhook handler when "/start auth_<sessionId>" arrives.
 * @returns {{ ok: boolean, reason?: string }}
 */
function claimSession(sessionId, tgUser) {
  const entry = sessions.get(sessionId);
  if (!entry) return { ok: false, reason: 'unknown session' };
  if (isExpired(entry)) {
    sessions.delete(sessionId);
    return { ok: false, reason: 'expired' };
  }
  if (entry.status === 'authenticated') {
    // Already claimed — ignore a duplicate /start (e.g. user tapped twice).
    return { ok: true };
  }
  if (!tgUser || tgUser.id === undefined || tgUser.id === null) {
    return { ok: false, reason: 'missing telegram user id' };
  }

  const user = {
    chatId: String(tgUser.id),
    firstName: tgUser.first_name || null,
    lastName: tgUser.last_name || null,
    username: tgUser.username || null,
  };
  entry.user = user;
  entry.token = issueToken(user);
  entry.status = 'authenticated';
  return { ok: true };
}

/**
 * Read a session's status for polling. When authenticated, the token+user are
 * returned exactly once and the session is then consumed (single-use).
 * @returns {{ status: 'pending'|'authenticated'|'expired', token?, user? }}
 */
function consumeIfReady(sessionId) {
  const entry = sessions.get(sessionId);
  if (!entry) return { status: 'expired' };
  if (isExpired(entry)) {
    sessions.delete(sessionId);
    return { status: 'expired' };
  }
  if (entry.status === 'authenticated') {
    sessions.delete(sessionId); // single-use: consume on first successful read
    return { status: 'authenticated', token: entry.token, user: entry.user };
  }
  return { status: 'pending' };
}

// Periodic sweep so abandoned sessions don't accumulate. unref() so this timer
// never keeps the process alive on its own.
const sweeper = setInterval(() => {
  for (const [id, entry] of sessions) {
    if (isExpired(entry)) sessions.delete(id);
  }
}, SWEEP_INTERVAL_MS);
if (typeof sweeper.unref === 'function') sweeper.unref();

module.exports = {
  createSession,
  claimSession,
  consumeIfReady,
  // Exposed for tests / diagnostics only.
  _sessions: sessions,
  _TTL_MS: TTL_MS,
};

// NOTE (scaling out): if you ever run more than one server instance behind a
// load balancer, move this Map to a shared store (Redis, or a short-TTL Mongo
// collection) so the instance that receives the webhook and the instance that
// serves the poll agree on session state.
