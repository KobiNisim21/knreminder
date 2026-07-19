import { useState } from 'react';

const SNOOZE_CHOICES = [
  { minutes: 15, label: "15 דק'" },
  { minutes: 60, label: 'שעה' },
  { minutes: 180, label: '3 שעות' },
  { minutes: 1440, label: 'מחר' },
];

/**
 * ActionBar — Contextual bottom action bar shown when a reminder row is selected.
 *
 * Slides up from the bottom of the viewport (above the BottomNav) and offers:
 *   ✓ Complete   → completeMutation
 *   🕐 Snooze    → opens quick-snooze choices, then snoozeMutation
 *   ✏️ Edit      → opens EditReminderModal (via onEdit)
 *   🗑 Remove    → deleteMutation
 *   ↗ Send       → share sheet placeholder
 *
 * Props:
 *   reminder   {object|null}  — selected reminder (null = hidden)
 *   onClose    {fn}           — clear the selection
 *   onEdit     {fn(reminder)} — open the edit modal
 *   onComplete {fn(id)}
 *   onSnooze   {fn(id, minutes)}
 *   onRemove   {fn(id)}
 */
export default function ActionBar({
  reminder,
  onClose,
  onEdit,
  onComplete,
  onSnooze,
  onRemove,
}) {
  const [showSnooze, setShowSnooze] = useState(false);
  const isOpen = !!reminder;

  if (!isOpen) return null;

  function handleSend() {
    const shareText = reminder.text;
    if (navigator.share) {
      navigator.share({ title: 'תזכורת', text: shareText }).catch(() => {});
    } else {
      window.alert('שיתוף — בקרוב');
    }
    onClose();
  }

  return (
    <>
      {/* Tap-away layer so tapping outside closes the bar */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="fixed left-0 right-0 z-50 bg-surface border-t border-divider
                   shadow-2xl animate-slide-up"
        style={{
          bottom: 0,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        role="toolbar"
        aria-label="פעולות על תזכורת"
      >
        {showSnooze ? (
          <div className="px-3 py-3">
            <div className="flex items-center justify-between px-2 pb-2">
              <span className="text-sm text-textSecondary">דחה ל…</span>
              <button
                onClick={() => setShowSnooze(false)}
                className="text-primary text-sm font-medium active:opacity-60"
              >
                חזרה
              </button>
            </div>
            <div className="flex gap-2">
              {SNOOZE_CHOICES.map((c) => (
                <button
                  key={c.minutes}
                  onClick={() => { onSnooze(reminder._id, c.minutes); onClose(); }}
                  className="flex-1 py-2.5 rounded-ios bg-gray-100 text-textPrimary
                             text-sm font-medium active:bg-gray-200 transition-colors"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-stretch justify-around px-1 py-2">
            <ActionButton
              label="בוצע"
              color="text-green-600"
              onClick={() => { onComplete(reminder._id); onClose(); }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </ActionButton>

            <ActionButton
              label="דחה"
              color="text-amber-500"
              onClick={() => setShowSnooze(true)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
              </svg>
            </ActionButton>

            <ActionButton
              label="ערוך"
              color="text-primary"
              onClick={() => { onEdit(reminder); onClose(); }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </ActionButton>

            <ActionButton
              label="מחק"
              color="text-accent"
              onClick={() => { onRemove(reminder._id); onClose(); }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
            </ActionButton>

            <ActionButton
              label="שלח"
              color="text-accent"
              onClick={handleSend}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </ActionButton>
          </div>
        )}
      </div>
    </>
  );
}

function ActionButton({ label, color, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 flex-1 py-1.5
                  ${color} active:opacity-60 transition-opacity`}
      aria-label={label}
    >
      {children}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
