import { useNavigate } from 'react-router-dom';

/**
 * Shared iOS-style grouped-list primitives for the settings screens.
 * Keeps Settings.jsx / BirthdaySettings.jsx focused on content, not chrome.
 */

// ─── Page scaffold ──────────────────────────────────────────────────────────

export function SettingsPage({ title, children, backTo = -1 }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-surface border-b border-divider px-2 sticky top-0 z-20 pt-safe">
        <div className="flex items-center h-14">
          <button
            onClick={() => navigate(backTo)}
            className="w-11 h-11 flex items-center justify-center text-accent active:opacity-50"
            aria-label="חזרה"
          >
            {/* RTL back chevron points right (toward where we came from) */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold text-textPrimary pr-11">
            {title}
          </h1>
        </div>
      </header>

      <main className="flex-1 scroll-container momentum-scroll scrollbar-hide pt-4 pb-8">
        {children}
      </main>
    </div>
  );
}

// ─── Grouped section (optional uppercase caption) ─────────────────────────────

export function Section({ caption, children, footer }) {
  return (
    <section className="mb-6">
      {caption && (
        <p className="px-5 pb-1.5 text-xs font-medium text-textSecondary uppercase tracking-wide">
          {caption}
        </p>
      )}
      <div className="bg-surface border-y border-divider">{children}</div>
      {footer && (
        <p className="px-5 pt-1.5 text-xs text-textSecondary leading-relaxed">{footer}</p>
      )}
    </section>
  );
}

// ─── A tappable row: label on the right (RTL start), value + chevron trailing ──

export function Row({ label, value, onClick, first, danger, hideChevron, children }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={`w-full flex items-center justify-between px-5 py-3.5 text-right
                  ${onClick ? 'active:bg-gray-50 transition-colors' : ''}
                  ${first ? '' : 'border-t border-divider'}`}
    >
      <span className={`text-[16px] ${danger ? 'text-accent' : 'text-textPrimary'}`}>
        {label}
      </span>
      <span className="flex items-center gap-1.5">
        {value != null && <span className="text-[16px] text-textSecondary">{value}</span>}
        {children}
        {onClick && !hideChevron && <Chevron />}
      </span>
    </Comp>
  );
}

export function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {/* RTL disclosure chevron points left */}
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

// ─── Bottom-sheet picker ──────────────────────────────────────────────────────
// A lightweight modal list of choices. `options` = [{ value, label }].

export function PickerSheet({ open, title, options, selected, onSelect, onClose }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed left-0 right-0 bottom-0 z-50 bg-surface rounded-t-2xl shadow-2xl
                   animate-slide-up max-h-[70vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        role="dialog"
        aria-label={title}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-divider">
          <span className="text-[15px] font-semibold text-textPrimary">{title}</span>
          <button onClick={onClose} className="text-accent text-[15px] font-medium active:opacity-60">
            סגור
          </button>
        </div>
        <div className="overflow-y-auto momentum-scroll">
          {options.map((opt, idx) => {
            const isSel = String(opt.value) === String(selected);
            return (
              <button
                key={opt.value}
                onClick={() => { onSelect(opt.value); onClose(); }}
                className={`w-full flex items-center justify-between px-5 py-3.5 text-right
                            active:bg-gray-50 transition-colors
                            ${idx > 0 ? 'border-t border-divider' : ''}`}
              >
                <span className="text-[16px] text-textPrimary">{opt.label}</span>
                {isSel && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
