import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/reminders';

/**
 * Login — iOS-style authentication gate.
 *
 * Primary path: the official Telegram Login Widget. Telegram injects a button;
 * when the user authorizes, it invokes our global callback with a signed payload
 * that we POST to /api/auth/telegram for server-side HMAC verification. Only the
 * verified identity is stored.
 *
 * Dev fallback: when VITE_TELEGRAM_BOT_USERNAME is not configured (pure local
 * dev), we can't render the widget, so we show a plain chatId entry field. The
 * server only honors this path when NODE_ENV !== 'production'.
 */

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || '';

export default function Login() {
  const { login } = useAuth();
  const widgetRef = useRef(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [devChatId, setDevChatId] = useState('');

  // ── Telegram widget wiring ──────────────────────────────────────────────────
  useEffect(() => {
    if (!BOT_USERNAME || !widgetRef.current) return;

    // Global callback the Telegram widget invokes on successful authorization.
    window.onTelegramAuth = async (tgUser) => {
      setBusy(true);
      setError('');
      try {
        const res = await authApi.loginWithTelegram(tgUser);
        if (res?.success && res.token && res.user?.chatId) {
          login({ token: res.token, user: res.user });
        } else {
          setError('אימות נכשל — נסה שוב');
        }
      } catch (err) {
        setError(err.message || 'אימות נכשל');
      } finally {
        setBusy(false);
      }
    };

    // Inject the Telegram widget script (idempotent — guard against re-adds).
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    widgetRef.current.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
    };
  }, [login]);

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

        {/* Primary: Telegram Login Widget */}
        {BOT_USERNAME ? (
          <div className="flex justify-center min-h-[48px]" ref={widgetRef} />
        ) : (
          // Dev fallback: manual chatId entry (server rejects this in production)
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

        {error && (
          <p className="text-red-500 text-sm mt-4" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
