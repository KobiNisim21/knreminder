/**
 * resolveUser — Authentication middleware for multi-user data isolation.
 *
 * Establishes `req.chatId`: the Telegram chat ID of the caller. Every reminder
 * route downstream scopes its database queries by this value, so a user can only
 * ever touch their own documents.
 *
 * Resolution order:
 *   1. `x-user-chat-id` header  (attached by the client's axios interceptor)
 *   2. `Authorization` header    ("Bearer <chatId>" or a bare chatId)
 *   3. TELEGRAM_CHAT_ID env var  — LOCAL DEV FALLBACK ONLY (see below)
 *
 * Security model:
 *   The client only ever attaches a chatId that the server itself minted via the
 *   HMAC-verified /api/auth/telegram endpoint (Telegram Login Widget). A caller
 *   *could* forge the header with someone else's numeric ID — Telegram chat IDs
 *   are not secret — so the header alone is NOT proof of ownership. That is an
 *   accepted limitation of a lightweight, session-less design; the verification
 *   gate lives at login time. If stronger guarantees are ever needed, swap the
 *   raw chatId for a signed session token and verify the signature here.
 *
 *   The TELEGRAM_CHAT_ID env fallback is deliberately restricted to
 *   non-production so a misconfigured prod deploy can never silently collapse
 *   back into a global single-user bucket.
 */

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Extract a chatId from the request headers, or null if none present.
 * Kept pure/synchronous so it's trivial to unit-test.
 */
function chatIdFromHeaders(req) {
  const direct = req.get('x-user-chat-id');
  if (direct && String(direct).trim()) return String(direct).trim();

  const auth = req.get('authorization');
  if (auth && auth.trim()) {
    // Accept "Bearer <chatId>" or a bare "<chatId>".
    const value = auth.replace(/^Bearer\s+/i, '').trim();
    if (value) return value;
  }

  return null;
}

function resolveUser(req, res, next) {
  let chatId = chatIdFromHeaders(req);

  // Local-dev convenience: fall back to the single-user env var, but never in
  // production — a prod request with no identity must be rejected.
  if (!chatId && !isProduction() && process.env.TELEGRAM_CHAT_ID) {
    chatId = String(process.env.TELEGRAM_CHAT_ID).trim();
  }

  if (!chatId) {
    return res.status(401).json({
      success: false,
      message: 'לא מזוהה — נא להתחבר מחדש',
      code: 'NO_CHAT_ID',
    });
  }

  req.chatId = chatId;
  next();
}

module.exports = resolveUser;
module.exports.chatIdFromHeaders = chatIdFromHeaders;
