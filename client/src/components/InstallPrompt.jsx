import { useState, useEffect } from 'react';

const DISMISSED_KEY = 'kn-install-prompt-dismissed';
const DISMISSED_UNTIL_KEY = 'kn-install-prompt-dismissed-until';

/**
 * InstallPrompt — iOS-specific "Add to Home Screen" instruction banner.
 *
 * Detection logic (all must be true to show):
 *   1. User agent is iOS/iPadOS (iPhone, iPad, iPod)
 *   2. Browser is Safari (NOT an in-app browser or Chrome for iOS)
 *   3. App is NOT already running in standalone mode (window.navigator.standalone !== true)
 *   4. User has not permanently dismissed it (localStorage)
 *   5. User has not snoozed it (dismissed for 3 days)
 *
 * UX:
 *   • Slides up from below the content, above the BottomNav
 *   • Shows the Safari Share icon (↑) with an animated bounce arrow
 *   • Hebrew step-by-step instructions
 *   • "Remind me later" → snoozes for 3 days
 *   • "×" → permanently dismissed
 */
export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);

  useEffect(() => {
    // Only show after a short delay so it doesn't block first render
    const timer = setTimeout(() => {
      if (shouldShow()) setVisible(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  function dismiss(permanent = false) {
    setAnimateOut(true);
    setTimeout(() => setVisible(false), 350);

    if (permanent) {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } else {
      // Snooze for 3 days
      const snoozeUntil = Date.now() + 3 * 24 * 60 * 60 * 1000;
      localStorage.setItem(DISMISSED_UNTIL_KEY, String(snoozeUntil));
    }
  }

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50
                  transition-transform duration-350 ease-out
                  ${animateOut ? 'translate-y-full' : 'translate-y-0 animate-slide-up'}`}
      style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
      role="dialog"
      aria-label="הוסף לדף הבית"
    >
      {/* Card */}
      <div className="mx-3 mb-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">

        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-primary to-accent" />

        <div className="p-4">
          {/* Header row */}
          <div className="flex items-start justify-between mb-3">
            <button
              onClick={() => dismiss(true)}
              className="text-textDisabled hover:text-textSecondary transition-colors
                         w-7 h-7 flex items-center justify-center rounded-full
                         hover:bg-gray-100 active:bg-gray-200 text-lg leading-none"
              aria-label="סגור לצמיתות"
            >
              ×
            </button>

            <div className="flex items-center gap-2.5">
              <div>
                <p className="text-[15px] font-semibold text-textPrimary text-right leading-tight">
                  הוסף לדף הבית
                </p>
                <p className="text-xs text-textSecondary text-right mt-0.5">
                  לחוויית אפליקציה מלאה ללא דפדפן
                </p>
              </div>
              {/* App icon */}
              <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 shadow-ios-card">
                <img
                  src="/icons/apple-touch-icon.png"
                  alt="KN תזכורות"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-2.5 mb-4">
            <Step number={1} icon={<ShareIcon />}>
              לחץ על כפתור <strong className="font-semibold">השיתוף</strong>{' '}
              <ShareIcon inline /> בתחתית Safari
            </Step>
            <Step number={2} icon={<PlusSquareIcon />}>
              גלול מטה ובחר{' '}
              <strong className="font-semibold">"הוסף למסך הבית"</strong>
            </Step>
            <Step number={3} icon={<CheckIcon />}>
              לחץ <strong className="font-semibold">הוסף</strong> בפינה הימנית
              העליונה
            </Step>
          </div>

          {/* Animated arrow hinting at the share button location */}
          <div className="flex justify-center mb-3">
            <div className="flex flex-col items-center gap-1 text-primary animate-bounce">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"/>
              </svg>
              <span className="text-[10px] font-medium text-textSecondary tracking-wide">
                כפתור השיתוף נמצא כאן
              </span>
            </div>
          </div>

          {/* Snooze button */}
          <button
            onClick={() => dismiss(false)}
            className="w-full py-2 text-sm text-textSecondary text-center
                       hover:text-primary transition-colors"
          >
            הזכר לי מאוחר יותר
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step sub-component ────────────────────────────────────────────────────────

function Step({ number, children }) {
  return (
    <div className="flex items-center gap-3 text-right">
      {/* Content (RTL: content left, number badge right) */}
      <p className="flex-1 text-sm text-textPrimary leading-snug">{children}</p>
      {/* Step number badge */}
      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center
                      flex-shrink-0 text-white text-xs font-bold">
        {number}
      </div>
    </div>
  );
}

// ─── Icon components ───────────────────────────────────────────────────────────

function ShareIcon({ inline = false }) {
  const cls = inline
    ? 'inline-block align-middle mb-0.5 mx-0.5'
    : 'inline-block';
  return (
    <svg
      className={cls}
      width={inline ? 14 : 18}
      height={inline ? 14 : 18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2196F3"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function PlusSquareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="#2196F3" strokeWidth="2" strokeLinecap="round"
      className="inline-block align-middle mb-0.5 mx-0.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="#4CAF50" strokeWidth="2.5" strokeLinecap="round"
      className="inline-block align-middle mb-0.5 mx-0.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─── Detection helpers ─────────────────────────────────────────────────────────

function shouldShow() {
  // Must be iOS (iPhone / iPad / iPod)
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!isIOS) return false;

  // Must be Safari — exclude Chrome for iOS (CriOS), Firefox (FxiOS), and other in-app browsers.
  // The cleanest signal: Safari on iOS sets standalone capability; Chrome/Firefox don't.
  const isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios|opios|chrome/i.test(navigator.userAgent);
  if (!isSafari) return false;

  // Must NOT already be in standalone mode
  if (window.navigator.standalone === true) return false;

  // Permanently dismissed?
  if (localStorage.getItem(DISMISSED_KEY) === 'true') return false;

  // Snoozed?
  const snoozeUntil = localStorage.getItem(DISMISSED_UNTIL_KEY);
  if (snoozeUntil && Date.now() < Number(snoozeUntil)) return false;

  return true;
}
