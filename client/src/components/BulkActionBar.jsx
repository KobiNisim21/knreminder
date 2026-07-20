import { useState, useEffect } from 'react';
import DateTimePicker from './DateTimePicker';

const SNOOZE_CHOICES = [
  { minutes: 15, label: "15 דק'" },
  { minutes: 60, label: 'שעה' },
  { minutes: 180, label: '3 שעות' },
  { minutes: 1440, label: 'מחר' },
];

function defaultCustomDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

/**
 * BulkActionBar — action bar shown while in multi-select mode.
 *
 * Slides up from the bottom and applies one action to every checked reminder:
 *   ✓ Complete all   → onBulk('complete')
 *   🕐 Snooze all     → preset choices or custom date → onBulk('snooze', {...})
 *   🗑 Delete all     → onBulk('delete')
 *
 * Props:
 *   count      {number}   — how many rows are checked (bar hidden when 0)
 *   busy       {boolean}  — a bulk mutation is in flight
 *   onBulk     {fn(action, { minutes?, until? })}
 *   onSelectAll{fn}       — check every visible reminder
 *   onClear    {fn}       — exit select mode / clear checks
 */
export default function BulkActionBar({ count, busy, onBulk, onSelectAll, onClear }) {
  const [view, setView] = useState('actions');
  const [customDate, setCustomDate] = useState(defaultCustomDate);

  // Collapse back to the action row whenever the selection is emptied.
  useEffect(() => {
    if (count === 0) setView('actions');
  }, [count]);

  // Note: unlike the single-item ActionBar, this stays mounted with count===0 so
  // the "select all" / "cancel" controls remain reachable before anything is
  // checked. The per-action buttons are disabled until at least one row is picked.
  const noneChecked = count === 0;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClear} aria-hidden="true" />

      <div
        className="fixed left-0 right-0 z-50 bg-surface border-t border-divider
                   shadow-2xl animate-slide-up"
        style={{ bottom: 0, paddingBottom: 'env(safe-area-inset-bottom)' }}
        role="toolbar"
        aria-label="פעולות על תזכורות נבחרות"
      >
        {/* Header: count + select-all / cancel */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="text-sm font-medium text-textPrimary">
            {noneChecked ? 'בחר תזכורות' : `${count} נבחרו`}
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={onSelectAll}
              className="text-primary text-sm font-medium active:opacity-60"
            >
              בחר הכל
            </button>
            <button
              onClick={onClear}
              className="text-textSecondary text-sm font-medium active:opacity-60"
            >
              ביטול
            </button>
          </div>
        </div>

        {view === 'snooze' ? (
          <div className="px-3 py-3">
            <div className="flex items-center justify-between px-2 pb-2">
              <span className="text-sm text-textSecondary">דחה את הנבחרות ל…</span>
              <button
                onClick={() => setView('actions')}
                className="text-primary text-sm font-medium active:opacity-60"
              >
                חזרה
              </button>
            </div>
            <div className="flex gap-2">
              {SNOOZE_CHOICES.map((c) => (
                <button
                  key={c.minutes}
                  disabled={busy}
                  onClick={() => onBulk('snooze', { minutes: c.minutes })}
                  className="flex-1 py-2.5 rounded-ios bg-gray-100 text-textPrimary
                             text-sm font-medium active:bg-gray-200 transition-colors
                             disabled:opacity-50"
                >
                  {c.label}
                </button>
              ))}
              <button
                disabled={busy}
                onClick={() => { setCustomDate(defaultCustomDate()); setView('custom'); }}
                className="flex-1 py-2.5 rounded-ios bg-primary/10 text-primary
                           text-sm font-medium active:bg-primary/20 transition-colors
                           disabled:opacity-50"
              >
                מועד אחר
              </button>
            </div>
          </div>
        ) : view === 'custom' ? (
          <div className="px-3 py-3">
            <div className="flex items-center justify-between px-2 pb-2">
              <span className="text-sm text-textSecondary">בחר מועד</span>
              <button
                onClick={() => setView('snooze')}
                className="text-primary text-sm font-medium active:opacity-60"
              >
                חזרה
              </button>
            </div>
            <DateTimePicker value={customDate} onChange={setCustomDate} />
            <button
              disabled={busy}
              onClick={() => onBulk('snooze', { until: customDate.toISOString() })}
              className="mt-3 w-full py-2.5 rounded-ios bg-primary text-white
                         text-sm font-semibold active:opacity-80 transition-opacity
                         disabled:opacity-50"
            >
              דחה למועד זה
            </button>
          </div>
        ) : (
          <div className="flex items-stretch justify-around px-1 py-2">
            <BulkButton label="בוצע" color="text-green-600" disabled={busy || noneChecked}
              onClick={() => onBulk('complete')}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </BulkButton>

            <BulkButton label="דחה" color="text-amber-500" disabled={busy || noneChecked}
              onClick={() => setView('snooze')}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
              </svg>
            </BulkButton>

            <BulkButton label="מחק" color="text-accent" disabled={busy || noneChecked}
              onClick={() => onBulk('delete')}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
            </BulkButton>
          </div>
        )}
      </div>
    </>
  );
}

function BulkButton({ label, color, onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1 flex-1 py-1.5
                  ${color} active:opacity-60 transition-opacity disabled:opacity-40`}
      aria-label={label}
    >
      {children}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
