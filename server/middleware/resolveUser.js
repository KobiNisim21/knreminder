/**
 * resolveUser — Authentication middleware for multi-user data isolation.
 *
 * Establishes `req.chatId`: the Telegram chat ID of the caller. Every reminder
 * route downstream scopes its database queries by this value, so a user can only
 * ever touch their own documents.
 *
 * SECURITY MODEL — signed session tokens
 *   Identity is proven by a signed session token, NOT a raw chat ID. At login,
 *   /api/auth/telegram HMAC-verifies the Telegram payload and mints a token that
 *   embeds the chatId and is signed with a server-only secret (see
 *   services/sessionToken.js). On every request we recompute the signature and
 *   reject anything we didn't sign. Because the chatId lives *inside* the signed
 *   token, a caller cannot forge it — flipping the chatId invalidates the
 *   signature. This closes the header-spoofing gap of the earlier design.
 *
 * Resolution order:
 *   1. `Authorization: Bearer <token>`  — signed session token (authoritative)
 *   2. `x-user-chat-id` header          — DEV ONLY: raw chatId, non-production
 *   3. TELEGRAM_CHAT_ID env var          — DEV ONLY: single-user local fallback
 *
 *   Paths 2 and 3 are hard-disabled in production, so a prod request must carry
 *   a valid signed token or it is rejected with 401.
 */

const { verifyToken } = require('../services/sessionToken');

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Pull a bearer token out of the Authorization header, if present.
 * Returns the token string or null. Kept pure for easy unit testing.
 */
function bearerFromHeaders(req) {
  const auth = req.get('authorization');
  if (!auth || !auth.trim()) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m && m[1].trim()) return m[1].trim();
  return null;
}

/**
 * DEV-ONLY: extract a raw chatId from headers. In production this always returns
 * null so a forged x-user-chat-id can never establish identity.
 */
function devChatIdFromHeaders(req) {
  if (isProduction()) return null;
  const direct = req.get('x-user-chat-id');
  if (direct && String(direct).trim()) return String(direct).trim();
  return null;
}

function resolveUser(req, res, next) {
  // 1) Signed session token — the authoritative, tamper-proof path.
  const token = bearerFromHeaders(req);
  if (token) {
    const result = verifyToken(token);
    if (result.ok) {
      req.chatId = String(result.payload.sub);
      req.session = result.payload; // downstream can read name/username/exp
      return next();
    }
    // A token was supplied but failed verification: do NOT silently fall back to
    // weaker paths — that would defeat the point. Reject explicitly.
    return res.status(401).json({
      success: false,
      message: 'תוקף ההתחברות פג — נא להתחבר מחדש',
      code: 'BAD_TOKEN',
      reason: result.reason,
    });
  }

  // 2) DEV-ONLY: raw chatId header (never in production).
  let chatId = devChatIdFromHeaders(req);

  // 3) DEV-ONLY: single-user env fallback (never in production).
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
module.exports.bearerFromHeaders = bearerFromHeaders;
module.exports.devChatIdFromHeaders = devChatIdFromHeaders;
