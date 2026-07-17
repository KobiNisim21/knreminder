import { groupRemindersByDay, formatDateLabel } from '../utils/dateHelpers';
import ReminderItem from './ReminderItem';

/**
 * ReminderList — Groups reminders into sticky-header sections:
 *   ⚠️ עבר הזמן (Overdue)
 *   היום (Today)
 *   מחר (Tomorrow)
 *   [Full date] (Upcoming days)
 *
 * Each section header has a blue "+" quick-add button.
 */
export default function ReminderList({ reminders, onEdit, onQuickAdd }) {
  const groups = groupRemindersByDay(reminders);

  if (groups.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex-1">
      {groups.map((group) => (
        <section key={group.key}>
          {/* ── Sticky section header ─────────────────────────────────────── */}
          <div className="section-header">
            <span className={group.key === '__overdue__' ? 'text-accent' : 'text-primary'}>
              {group.label}
            </span>
            <button
              onClick={() => onQuickAdd?.(group.key)}
              className="text-primary text-2xl leading-none font-light w-8 h-8
                         flex items-center justify-center rounded-full
                         hover:bg-primary/10 active:bg-primary/20 transition-colors"
              aria-label={`הוסף תזכורת ל${group.label}`}
            >
              +
            </button>
          </div>

          {/* ── Reminder rows ─────────────────────────────────────────────── */}
          {group.reminders.map((reminder) => (
            <ReminderItem
              key={reminder._id}
              reminder={reminder}
              onEdit={onEdit}
            />
          ))}
        </section>
      ))}

      {/* Bottom padding so last item isn't hidden behind FAB/nav */}
      <div className="h-4" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-8 text-center gap-4 animate-fade-in">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-2">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#BDBDBD" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>
      <p className="text-base font-medium text-textPrimary">אין תזכורות פעילות</p>
      <p className="text-sm text-textSecondary leading-relaxed">
        לחץ על כפתור ה-<span className="text-accent font-bold">+</span> כדי להוסיף את התזכורת הראשונה שלך
      </p>
    </div>
  );
}
