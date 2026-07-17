import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { remindersApi } from '../api/reminders';
import { parseDisplayTime, RECURRENCE_LABELS, isOverdue } from '../utils/dateHelpers';

/**
 * ReminderItem — A single reminder row with:
 *   • Bold 24-hour time (left-aligned, BZ Reminder style)
 *   • Recurrence (↻) and snooze (💤) icons
 *   • Reminder text
 *   • Swipe-left gesture to reveal Delete (red) + Complete (green) actions
 *   • Tap to expand (future edit flow hook)
 */
export default function ReminderItem({ reminder, onEdit }) {
  const queryClient = useQueryClient();
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const itemRef = useRef(null);

  const ACTION_THRESHOLD = 72; // px to reveal action buttons
  const MAX_SWIPE = 160;       // px max swipe distance

  // ── Mutations ──────────────────────────────────────────────────────────────
  const completeMutation = useMutation({
    mutationFn: () => remindersApi.complete(reminder._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['reminders', 'completed'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => remindersApi.delete(reminder._id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminders'] }),
  });

  // ── Touch handlers (swipe-left) ────────────────────────────────────────────
  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsSwiping(false);
  }

  function handleTouchMove(e) {
    if (touchStartX.current === null) return;

    const dx = touchStartX.current - e.touches[0].clientX;
    const dy = Math.abs(touchStartY.current - e.touches[0].clientY);

    // Ignore vertical scrolls
    if (!isSwiping && dy > 10 && dy > Math.abs(dx)) return;

    if (dx > 5) {
      setIsSwiping(true);
      e.preventDefault(); // prevent page scroll while swiping
      const clamped = Math.min(Math.max(dx, 0), MAX_SWIPE);
      setSwipeX(clamped);
    }
  }

  function handleTouchEnd() {
    if (swipeX > ACTION_THRESHOLD) {
      setSwipeX(ACTION_THRESHOLD); // snap open
    } else {
      setSwipeX(0); // snap closed
    }
    touchStartX.current = null;
    setIsSwiping(false);
  }

  function closeSwipe() {
    setSwipeX(0);
  }

  // ── Display data ───────────────────────────────────────────────────────────
  const { hours, minutes } = parseDisplayTime(reminder.reminderAt);
  const overdue = isOverdue(reminder);
  const isCompleting = completeMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  return (
    <div className="relative overflow-hidden border-b border-divider" ref={itemRef}>

      {/* ── Hidden action buttons (revealed by swipe) ─────────────────────── */}
      <div
        className="absolute inset-y-0 left-0 flex items-stretch"
        style={{ width: MAX_SWIPE }}
      >
        {/* Complete (green) */}
        <button
          className={`flex-1 flex flex-col items-center justify-center gap-1
                      bg-green-500 text-white text-xs font-medium
                      transition-opacity ${isCompleting ? 'opacity-60' : ''}`}
          onClick={() => { closeSwipe(); completeMutation.mutate(); }}
          disabled={isCompleting || isDeleting}
          aria-label="סמן כבוצע"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          בוצע
        </button>

        {/* Delete (red) */}
        <button
          className={`flex-1 flex flex-col items-center justify-center gap-1
                      bg-accent text-white text-xs font-medium
                      transition-opacity ${isDeleting ? 'opacity-60' : ''}`}
          onClick={() => { closeSwipe(); deleteMutation.mutate(); }}
          disabled={isCompleting || isDeleting}
          aria-label="מחק תזכורת"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
          מחק
        </button>
      </div>

      {/* ── Main row content (slides left on swipe) ───────────────────────── */}
      <div
        className={`reminder-row relative bg-surface
                    ${swipeX > 0 ? '' : 'transition-transform duration-200 ease-out'}
                    ${overdue ? 'border-r-[3px] border-r-accent' : ''}`}
        style={{
          transform: `translateX(-${swipeX}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (swipeX > 0) {
            closeSwipe();
          } else if (onEdit) {
            onEdit(reminder);
          }
        }}
      >
        {/* Time column */}
        <div className="min-w-[76px] text-right ml-3 flex-shrink-0">
          <div className={`time-display ${overdue ? 'text-accent' : 'text-textPrimary'}`}>
            {hours}:{minutes}
          </div>
        </div>

        {/* Status icons column */}
        <div className="flex flex-col items-center justify-center mx-2 gap-1 flex-shrink-0 min-w-[18px]">
          {reminder.isRecurring && (
            <RecurrenceIcon frequency={reminder.recurrence?.frequency} />
          )}
          {reminder.snoozeCount > 0 && (
            <SnoozeIcon count={reminder.snoozeCount} />
          )}
        </div>

        {/* Text column */}
        <div className="flex-1 min-w-0">
          <p className={`text-[15px] leading-snug
                        ${overdue ? 'text-accent font-medium' : 'text-textPrimary'}`}>
            {reminder.text}
          </p>
          {reminder.isRecurring && reminder.recurrence && (
            <span className="text-[11px] text-textSecondary">
              {RECURRENCE_LABELS[reminder.recurrence.frequency]}
            </span>
          )}
        </div>

        {/* Loading spinner overlay */}
        {(isCompleting || isDeleting) && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RecurrenceIcon({ frequency }) {
  const title = RECURRENCE_LABELS[frequency] || 'חוזרת';
  return (
    <span title={title} className="text-primary">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1 4 1 10 7 10"/>
        <polyline points="23 20 23 14 17 14"/>
        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
      </svg>
    </span>
  );
}

function SnoozeIcon({ count }) {
  return (
    <span title={`נדחתה ${count} פעמים`} className="text-amber-500">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
      </svg>
    </span>
  );
}
