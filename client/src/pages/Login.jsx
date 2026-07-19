import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/reminders';

/**
 * Login — iOS-style authentication gate.
 *
 * Primary path: Telegram DEEP-LINK login. We ask the server for a one-time
 * session id, send the user to https://t.me/<bot>?start=auth_<id>, and poll the
 * session's status. When the user taps "Start" in their native Telegram app the
 * bot webhook claims the session and mints a signed token, which our next poll
 * receives. This completely bypasses the oauth.telegram.org login widget — no
 * iframe, no cross-site cookies, no dependence on Telegram delivering a
 * confirmation message to a browser popup.
 *
 * Dev fallback: on localhost only, a manual chatId entry field (the server also
 * rejects that path when NODE_ENV === 'production').
 */

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || '';

// Hard environment gate for the manual Chat ID fallback — localhost only, so it
// can never surface on the live site even if the bot username env var is unset.
const IS_LOCALHOST = window.location.hostname === 'localhost';

// How often to poll the login-session status, and for how long before giving up.
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // matches the server-side session TTL

export default function Login() {
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [devChatId, setDevChatId] = useState('');

  // 'idle' → nothing started; 'waiting' → deep link opened, polling for the tap.
  const [phase, setPhase] = useState('idle');

  // Keep the latest `login` in a ref so the polling loop can call it without
  // being a dependency (the loop is set up once and must not be torn down by a
  // re-render mid-poll).
  const loginRef = useRef(login);
  loginRef.current = login;

  // Handles to the active poll so we can always clean them up.
  const pollTimer = useRef(null);
  const pollDeadline = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  // Poll one session id until it authenticates, expires, or we time out.
  const pollStatus = useCallback(
    (sessionId) => {
      const tick = async () => {
        if (Date.now() > pollDeadline.current) {
          stopPolling();
          setPhase('idle');
          setError('קישור ההתחברות פג תוקף. נסה שוב.');
          return;
        }
        try {
          const res = await authApi.getDeepLinkStatus(sessionId);
          if (res?.status === 'authenticated' && res.token && res.user?.chatId) {
            stopPolling();
            loginRef.current({ token: res.token, user: res.user });
            return;
          }
          if (res?.status === 'expired') {
            stopPolling();
            setPhase('idle');
            setError('קישור ההתחברות פג תוקף. נסה שוב.');
            return;
          }
        } catch {
          // Transient network error — keep polling until the deadline.
        }
        pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
      };
      tick();
    },
    [stopPolling]
  );

  // Clean up any in-flight poll if the component unmounts.
  useEffect(() => stopPolling, [stopPolling]);

  const handleConnect = useCallback(async () => {
    setError('');
    try {
      const res = await authApi.startDeepLink();
      if (!res?.success || !res.sessionId || !res.deepLink) {
        setError('לא ניתן להתחיל התחברות כעת. נסה שוב.');
        return;
      }
      // Open the bot in Telegram. On mobile this hands off to the native app; on
      // desktop it opens Telegram Web/Desktop. A new tab keeps our poller alive.
      window.open(res.deepLink, '_blank', 'noopener');
      pollDeadline.current = Date.now() + POLL_TIMEOUT_MS;
      setPhase('waiting');
      stopPolling();
      pollStatus(res.sessionId);
    } catch (err) {
      setError(err.message || 'לא ניתן להתחיל התחברות כעת. נסה שוב.');
    }
  }, [pollStatus, stopPolling]);

  // ── Dev fallback submit (localhost only) ────────────────────────────────────
  async function handleDevLogin(e) {
    e.preventDefault();
    const id = devChatId.trim();
    if (!id) return;
    setError('');
    try {
      const res = await authApi.loginWithTelegram({ id, dev: true });
      if (res?.success && res.token && res.user?.chatId) {
        login({ token: res.token, user: res.user });
      } else {
        setError('התחברות נכשלה');
      }
    } catch (err) {
      setError(err.message || 'התחברות נכשלה');
    }
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-background flex flex-col items-center justify-center px-6"
    >
      <div className="w-full max-w-sm text-center">
        {/* Brand mark */}
        <div className="mx-auto mb-6 w-20 h-20 rounded-3xl bg-accent/10 flex items-center justify-center">
          <span className="text-4xl">🔔</span>
        </div>

        <h1 className="text-2xl font-bold text-textPrimary mb-2">KN Reminder</h1>
        <p className="text-[15px] text-textSecondary mb-8 leading-relaxed">
          התחבר עם טלגרם כדי לגשת לתזכורות שלך.
          <br />
          הנתונים שלך פרטיים ומשויכים לחשבון הטלגרם שלך בלבד.
        </p>

        {/* Primary: deep-link login via the native Telegram app. */}
        {BOT_USERNAME && (
          <div>
            <button
              onClick={handleConnect}
              className="w-full rounded-xl bg-[#229ED9] text-white font-semibold py-3.5
                         text-[16px] flex items-center justify-center gap-2
                         active:opacity-80 transition-opacity"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71l-4.14-3.05-1.99 1.93c-.23.23-.42.42-.83.42z"/>
              </svg>
              {phase === 'waiting' ? 'ממתין לאישור בטלגרם…' : 'התחבר דרך אפליקציית טלגרם'}
            </button>

            {phase === 'waiting' && (
              <div className="mt-4 text-[14px] text-textSecondary leading-relaxed" role="status">
                <p>נפתחה טלגרם בחלון חדש. לחץ <b>Start</b> אצל הבוט,</p>
                <p>ואז חזור לכאן — נתחבר אוטומטית.</p>
                <button
                  onClick={handleConnect}
                  className="mt-3 text-[14px] text-accent underline underline-offset-2"
                >
                  לא נפתח? פתח שוב
                </button>
              </div>
            )}
          </div>
        )}

        {/* Dev fallback: manual chatId entry. localhost only. */}
        {IS_LOCALHOST && !BOT_USERNAME && (
          <form onSubmit={handleDevLogin} className="text-right">
            <label className="block text-[13px] text-textSecondary mb-1.5 px-1">
              Chat ID (מצב פיתוח)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={devChatId}
              onChange={(e) => setDevChatId(e.target.value)}
              placeholder="לדוגמה: 123456789"
              className="w-full rounded-xl border border-divider bg-surface px-4 py-3
                         text-[16px] text-textPrimary outline-none focus:border-accent
                         mb-3"
            />
            <button
              type="submit"
              disabled={!devChatId.trim()}
              className="w-full rounded-xl bg-accent text-white font-semibold py-3
                         text-[16px] active:opacity-80 disabled:opacity-40"
            >
              התחבר
            </button>
            <p className="text-xs text-textDisabled mt-3 leading-relaxed">
              שלח <code>/start</code> לבוט בטלגרם כדי לקבל את ה-Chat ID שלך.
            </p>
          </form>
        )}

        {/* Safety net: production build with no bot configured. */}
        {!BOT_USERNAME && !IS_LOCALHOST && (
          <p className="text-[15px] text-textSecondary" role="alert">
            ההתחברות אינה זמינה כרגע. נסה שוב מאוחר יותר.
          </p>
        )}

        {error && (
          <p className="text-red-500 text-sm mt-4" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
