import { useCompletedReminders } from '../hooks/useReminders';
import { useReminderMutations } from '../hooks/useReminderMutations';
import { formatRelativeTime, formatFullHebrew, parseDisplayTime } from '../utils/dateHelpers';

/**
 * CompletedList — Scrollable list of completed reminders.
 *
 * Each item shows:
 *   • Completion time (relative: "לפני שעתיים")
 *   • Reminder text (struck through)
 *   • ⟳ Restore button (re-activates as a new reminder for now+5min)
 *   • 🗑 Hard delete button
 *   • Days remaining before auto-deletion (90-day TTL countdown)
 *
 * Used both inside the Completed page AND as a slide-in panel.
 */
export default function CompletedList() {
  const { data: completed, isLoading, isError, error, refetch } = useCompletedReminders();
  const { deleteMutation } = useReminderMutations();

  if (isLoading) return <CompletedSkeleton />;

  if (isError) {
    return (
      <div className="flex flex-col items-center py-16 px-6 text-center gap-3 animate-fade-in">
        <p className="text-accent font-medium">שגיאה בטעינת ההיסטוריה</p>
        <p className="text-sm text-textSecondary">{error?.message}</p>
        <button onClick={refetch} className="text-primary text-sm underline">
          נסה שנית
        </button>
      </div>
    );
  }

  if (!completed || completed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-8 text-center gap-4 animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="1.5" strokeLinecap="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <p className="text-base font-medium text-textPrimary">אין תזכורות שהושלמו</p>
        <p className="text-sm text-textSecondary">תזכורות שסומנו כבוצע יישמרו כאן למשך 90 יום</p>
      </div>
    );
  }

  return (
    <div className="flex-1">
      {/* Stats bar */}
      <div className="px-4 py-2 bg-green-50 border-b border-green-100 text-xs text-green-700 text-right">
        {completed.length} תזכורות הושלמו — נשמרות ל-90 יום
      </div>

      {completed.map((reminder) => (
        <CompletedItem
          key={reminder._id}
          reminder={reminder}
          onDelete={() => deleteMutation.mutate(reminder._id)}
          isDeleting={deleteMutation.isPending && deleteMutation.variables === reminder._id}
        />
      ))}

      <div className="h-4" />
    </div>
  );
}

// ─── Single completed item row ─────────────────────────────────────────────────

function CompletedItem({ reminder, onDelete, isDeleting }) {
  const daysLeft = getDaysLeft(reminder.expiresAt);
  const { hours, minutes } = parseDisplayTime(reminder.reminderAt);

  return (
    <div className={`border-b border-divider bg-white px-4 py-3.5
                     transition-opacity ${isDeleting ? 'opacity-40' : ''}`}>
      <div className="flex items-start gap-3">

        {/* Checkmark */}
        <div className="mt-0.5 flex-shrink-0">
          <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Text (struck through) */}
          <p className="text-[15px] text-textSecondary line-through leading-snug">
            {reminder.text}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {/* Original time */}
            <span className="text-xs text-textDisabled">
              🕐 {hours}:{minutes} · {formatRelativeTime(reminder.completedAt)}
            </span>

            {/* TTL countdown badge */}
            {daysLeft !== null && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium
                               ${daysLeft <= 7
                                 ? 'bg-red-50 text-red-500'
                                 : 'bg-gray-100 text-textSecondary'}`}>
                {daysLeft > 0 ? `נמחק בעוד ${daysLeft} יום` : 'נמחק היום'}
              </span>
            )}
          </div>
        </div>

        {/* Delete button */}
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="flex-shrink-0 p-1.5 text-textDisabled hover:text-accent
                     active:scale-90 transition-all rounded-full hover:bg-red-50"
          aria-label="מחק לצמיתות"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CompletedSkeleton() {
  return (
    <div className="animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-4 border-b border-divider">
          <div className="w-5 h-5 rounded-full bg-gray-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-gray-100 rounded w-4/5" />
            <div className="h-2.5 bg-gray-100 rounded w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysLeft(expiresAt) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
