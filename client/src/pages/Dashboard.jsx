import { useReminders } from '../hooks/useReminders';
import { groupRemindersByDay, parseDisplayTime, RECURRENCE_LABELS, isOverdue } from '../utils/dateHelpers';

/**
 * Dashboard — Phase 2 scaffold.
 *
 * Renders the active reminders list grouped by day.
 * Full BZ Reminder UI (ReminderItem, AddModal, BottomNav, swipe gestures)
 * will be layered on in Phase 3 & 4.
 */
export default function Dashboard() {
  const { data: reminders, isLoading, isError, error, refetch } = useReminders();

  const groups = reminders ? groupRemindersByDay(reminders) : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── App Header ──────────────────────────────────────────────────── */}
      <header className="bg-surface border-b border-divider px-4 py-3 pt-safe sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <button className="text-textSecondary p-1">
            {/* Menu icon placeholder */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect y="4" width="24" height="2" rx="1"/><rect y="11" width="24" height="2" rx="1"/><rect y="18" width="24" height="2" rx="1"/>
            </svg>
          </button>
          <h1 className="text-lg font-medium text-textPrimary">תזכורות</h1>
          <button className="text-textSecondary p-1">
            {/* Search icon placeholder */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 scroll-container">
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-textSecondary">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full ml-2" />
            טוען תזכורות…
          </div>
        )}

        {isError && (
          <div className="p-6 text-center">
            <p className="text-accent font-medium mb-2">שגיאה בטעינת התזכורות</p>
            <p className="text-textSecondary text-sm mb-4">{error?.message}</p>
            <button
              onClick={refetch}
              className="text-primary text-sm font-medium underline"
            >
              נסה שנית
            </button>
          </div>
        )}

        {!isLoading && !isError && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-textSecondary gap-3">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <p className="text-base">אין תזכורות פעילות</p>
            <p className="text-sm">לחץ על + כדי להוסיף תזכורת חדשה</p>
          </div>
        )}

        {groups.map((group) => (
          <section key={group.key}>
            {/* Section header */}
            <div className="section-header">
              <span>{group.label}</span>
              <button className="text-primary text-xl leading-none font-light">+</button>
            </div>

            {/* Reminder rows */}
            {group.reminders.map((reminder) => {
              const { hours, minutes } = parseDisplayTime(reminder.reminderAt);
              const overdue = isOverdue(reminder);

              return (
                <div
                  key={reminder._id}
                  className={`reminder-row ${overdue ? 'border-r-2 border-r-accent' : ''}`}
                >
                  {/* Time */}
                  <div className="min-w-[80px] text-right ml-4">
                    <span className={`time-display ${overdue ? 'text-accent' : ''}`}>
                      {hours}:{minutes}
                    </span>
                  </div>

                  {/* Icons (recurrence, snooze) */}
                  <div className="flex flex-col items-center mx-2 gap-0.5 text-textSecondary">
                    {reminder.isRecurring && (
                      <span title={RECURRENCE_LABELS[reminder.recurrence?.frequency]}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                          <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
                          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                        </svg>
                      </span>
                    )}
                    {reminder.snoozeCount > 0 && (
                      <span className="text-amber-500">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
                        </svg>
                      </span>
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1">
                    <p className={`text-base ${overdue ? 'text-accent font-medium' : 'text-textPrimary'}`}>
                      {reminder.text}
                    </p>
                    {reminder.snoozeCount > 0 && (
                      <span className="snooze-badge">
                        נדחתה {reminder.snoozeCount}×
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </main>

      {/* ── FAB (Add button) — Phase 4 will hook this to AddReminderModal ── */}
      <button className="fab" aria-label="הוסף תזכורת">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {/* ── Bottom Navigation ─────────────────────────────────────────────── */}
      <nav className="bottom-nav">
        <button className="bottom-nav-tab">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
          <span>יותר</span>
        </button>

        <button className="bottom-nav-tab">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 3h-1V1h-2v2H7V1H5v2H4C2.9 3 2 3.9 2 5v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13z"/>
          </svg>
          <span>לוח שנה</span>
        </button>

        {/* Center FAB slot (empty — FAB is absolutely positioned) */}
        <div className="flex-1" />

        <button className="bottom-nav-tab">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
          </svg>
          <span>ימי הולדת</span>
        </button>

        <button className="bottom-nav-tab active">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
          </svg>
          <span>תזכורות</span>
        </button>
      </nav>
    </div>
  );
}
