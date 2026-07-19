import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/reminders';

// The six fields Telegram signs. Both the JS-callback flow and the redirect flow
// deliver exactly these; the server verifies the hash over them identically.
const TG_FIELDS = ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash'];

/**
 * Login — iOS-style authentication gate.
 *
 * Primary path: the official Telegram Login Widget in REDIRECT mode
 * (`data-auth-url`). On success Telegram navigates back to this page with the
 * signed fields as query params, which we POST to /api/auth/telegram for
 * server-side HMAC verification. Only the verified identity is stored. Redirect
 * mode is used instead of the JS `data-onauth` callback because it survives
 * React re-renders/remounts (the result is a fresh page load, not an in-page
 * postMessage) and works when the browser blocks the widget iframe's cross-site
 * cookies (Safari ITP, incognito) — the case that stalled the callback flow.
 *
 * Dev fallback: when VITE_TELEGRAM_BOT_USERNAME is not configured (pure local
 * dev), we can't render the widget, so we show a plain chatId entry field. This
 * input is gated strictly to hostname === 'localhost' so it can never surface on
 * the live site, even if the bot username env var is missing in production. The
 * server also only honors this path when NODE_ENV !== 'production'.
 */

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || '';

// Hard environment gate for the manual Chat ID fallback. This input exists only
// so a developer can sign in on their machine without the Telegram widget; it
// must NEVER render on the live site. We key it strictly off the hostname, so
// even a misconfigured production build (missing VITE_TELEGRAM_BOT_USERNAME)
// can't expose it. The server independently rejects dev logins when
// NODE_ENV === 'production', so this is defense-in-depth, not the only guard.
const IS_LOCALHOST = window.location.hostname === 'localhost';

export default function Login() {
  const { login } = useAuth();
  const widgetRef = useRef(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [devChatId, setDevChatId] = useState('');

  // Keep the latest `login` in a ref so the widget-injection effect can call it
  // WITHOUT listing it as a dependency. This is the key to being re-render-proof:
  // the effect below runs exactly once (empty deps), so a re-render can never
  // tear down and re-inject the Telegram iframe mid-handshake.
  const loginRef = useRef(login);
  loginRef.current = login;

  // Shared handler for a verified Telegram payload (used by both flows).
  const finishLogin = async (tgUser) => {
    setBusy(true);
    setError('');
    try {
      const res = await authApi.loginWithTelegram(tgUser);
      if (res?.success && res.token && res.user?.chatId) {
        loginRef.current({ token: res.token, user: res.user });
      } else {
        setError('אימות נכשל — נסה שוב');
      }
    } catch (err) {
      setError(err.message || 'אימות נכשל');
    } finally {
      setBusy(false);
    }
  };
  const finishLoginRef = useRef(finishLogin);
  finishLoginRef.current = finishLogin;

  // ── Handle the redirect-flow return ─────────────────────────────────────────
  // The redirect fallback sends the user to oauth.telegram.org and back to this
  // page with the signed fields as query params (?id=…&hash=…). Detect that on
  // mount, verify server-side, then strip the params from the URL. This path is
  // a first-party full-page navigation, so it is NOT subject to the third-party-
  // cookie blocking that stalls the iframe widget in Safari / incognito.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('id') || !params.get('hash')) return;

    const tgUser = {};
    for (const f of TG_FIELDS) {
      const v = params.get(f);
      if (v !== null) tgUser[f] = f === 'id' || f === 'auth_date' ? Number(v) : v;
    }
    // Clean the URL so a refresh doesn't replay a stale (and time-limited) payload.
    window.history.replaceState({}, document.title, window.location.pathname);
    finishLoginRef.current(tgUser);
  }, []);

  // ── Telegram widget wiring ──────────────────────────────────────────────────
  // Empty deps → runs once per mount. In production there is no StrictMode
  // double-invoke; locally the injection guard below prevents a duplicate script.
  //
  // We use Telegram's REDIRECT flow (`data-auth-url`) rather than the JS callback
  // (`data-onauth`). On success Telegram does a top-level navigation back to this
  // page with the signed fields as query params — there is no in-page postMessage
  // handshake that a React re-render / remount could orphan. That makes the flow
  // inherently re-render-proof and also avoids the callback getting lost when the
  // browser restricts the widget iframe (Safari ITP, incognito third-party-cookie
  // blocking). The return is handled by the mount effect above.
  useEffect(() => {
    const container = widgetRef.current;
    if (!BOT_USERNAME || !container) return;

    // Inject the widget script exactly once. The guard makes re-invocation
    // (e.g. React 18 StrictMode's dev double-mount) a no-op instead of a
    // second iframe that would fight the first for the OAuth handshake.
    if (!container.querySelector('script[data-telegram-login]')) {
      const returnUrl = `${window.location.origin}${window.location.pathname}`;
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.async = true;
      script.setAttribute('data-telegram-login', BOT_USERNAME);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-radius', '12');
      script.setAttribute('data-auth-url', returnUrl);
      script.setAttribute('data-request-access', 'write');
      container.appendChild(script);
    }
  }, []);

  // ── Dev fallback submit ───────────────────────────────────────────────────────
  async function handleDevLogin(e) {
    e.preventDefault();
    const id = devChatId.trim();
    if (!id) return;
    setBusy(true);
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
    } finally {
      setBusy(false);
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

        {/* Primary: Telegram Login Widget — the only auth path in production.
            The container renders unconditionally (never gated by state) so its
            ref stays stable and the injected iframe is never remounted. */}
        {BOT_USERNAME && (
          <>
            <div
              className={`flex justify-center min-h-[48px] transition-opacity ${busy ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : 'opacity-100'}`}
              ref={widgetRef}
            />
            {busy && (
              <p className="text-[15px] text-textSecondary" role="status">
                מתחבר…
              </p>
            )}
          </>
        )}

        {/* Dev fallback: manual chatId entry. Rendered ONLY on localhost so it
            can never appear on the live site, regardless of env config. */}
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
              disabled={busy || !devChatId.trim()}
              className="w-full rounded-xl bg-accent text-white font-semibold py-3
                         text-[16px] active:opacity-80 disabled:opacity-40"
            >
              {busy ? 'מתחבר…' : 'התחבר'}
            </button>
            <p className="text-xs text-textDisabled mt-3 leading-relaxed">
              שלח <code>/start</code> לבוט בטלגרם כדי לקבל את ה-Chat ID שלך.
            </p>
          </form>
        )}

        {/* Safety net: production build with no widget configured. Rather than
            leak the dev input, tell the user auth isn't available. */}
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
