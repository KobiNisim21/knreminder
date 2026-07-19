import { useState, useRef } from 'react';
import { useReminderMutations } from '../hooks/useReminderMutations';
import { parseDisplayTime, RECURRENCE_LABELS, isOverdue } from '../utils/dateHelpers';

// Quick snooze applied when a row is swiped past the threshold (in minutes).
const SWIPE_SNOOZE_MINUTES = 60;

/**
 * ReminderItem — A single reminder row.
 *
 * Interactions:
 *   • Tap                → toggles the row's selected state (parent shows the
 *                          contextual ActionBar). Does NOT open the edit modal
 *                          directly anymore.
 *   • Swipe →  (right)   → reveals Snooze (gray). Release past threshold snoozes.
 *   • Swipe ←  (left)    → reveals Complete (red). Release past threshold completes.
 *
 * Props:
 *   reminder    {object}
 *   isSelected  {boolean}
 *   onSelect    {fn(reminder)}  — toggle selection
 */
export default function ReminderItem({ reminder, isSelected, onSelect }) {
  const { completeMutation, snoozeMutation } = useReminderMutations();

  const [swipeX, setSwipeX] = useState(0); // signed: +right / -left
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const movedRef = useRef(false);

  const ACTION_THRESHOLD = 80; // px past which the action fires on release
  const MAX_SWIPE = 130;

  // ── Touch handlers ──────────────────────────────────────────────────────────
  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    movedRef.current = false;
    setIsSwiping(false);
  }

  function handleTouchMove(e) {
    if (touchStartX.current === null) return;

    // Positive dx = finger moved right; negative = moved left.
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);

    // Ignore predominantly-vertical gestures (page scroll).
    if (!isSwiping && dy > 10 && dy > Math.abs(dx)) return;

    if (Math.abs(dx) > 5) {
      setIsSwiping(true);
      movedRef.current = true;
      e.preventDefault(); // stop page scroll mid-swipe
      const clamped = Math.max(Math.min(dx, MAX_SWIPE), -MAX_SWIPE);
      setSwipeX(clamped);
    }
  }

  function handleTouchEnd() {
    const dx = swipeX;
    touchStartX.current = null;
    setIsSwiping(false);

    if (dx >= ACTION_THRESHOLD) {
      // Swiped right past threshold → Snooze, fire instantly.
      animateAndReset(() =>
        snoozeMutation.mutate({ id: reminder._id, minutes: SWIPE_SNOOZE_MINUTES })
      );
    } else if (dx <= -ACTION_THRESHOLD) {
      // Swiped left past threshold → Complete, fire instantly.
      animateAndReset(() => completeMutation.mutate(reminder._id));
    } else {
      // Not far enough → snap back.
      setSwipeX(0);
    }
  }

  function animateAndReset(fireMutation) {
    fireMutation();
    // Snap the row closed; the list will refetch and drop/update it.
    setSwipeX(0);
  }

  // ── Display data ─────────────────────────────────────────────────────────────
  const { hours, minutes } = parseDisplayTime(reminder.reminderAt);
  const overdue = isOverdue(reminder);
  const isBusy = completeMutation.isPending || snoozeMutation.isPending;

  // Which background is being revealed (based on swipe direction).
  const revealing = swipeX > 0 ? 'snooze' : swipeX < 0 ? 'complete' : null;
  const passedThreshold = Math.abs(swipeX) >= ACTION_THRESHOLD;

  return (
    <div className="relative overflow-hidden border-b border-divider">

      {/* ── Swipe-reveal background ─────────────────────────────────────────── */}
      {revealing && (
        <div
          className={`absolute inset-0 flex items-center
                      ${revealing === 'snooze'
                        ? 'bg-gray-400 justify-start'
                        : 'bg-accent justify-end'}`}
        >
          <div className={`flex flex-col items-center gap-0.5 text-white px-6
                           transition-transform ${passedThreshold ? 'scale-110' : 'scale-100'}`}>
            {revealing === 'snooze' ? (
              <>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
                </svg>
                <span className="text-xs font-medium">דחה</span>
              </>
            ) : (
              <>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-xs font-medium">בוצע</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Main row content (slides with swipe) ────────────────────────────── */}
      <div
        className={`reminder-row relative
                    ${isSelected ? 'bg-blue-50' : 'bg-surface'}
                    ${swipeX !== 0 ? '' : 'transition-transform duration-200 ease-out'}
                    ${overdue ? 'border-r-[3px] border-r-accent' : ''}`}
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          // Suppress the click that follows a swipe gesture.
          if (movedRef.current) {
            movedRef.current = false;
            return;
          }
          onSelect?.(reminder);
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

        {/* Selected check indicator */}
        {isSelected && (
          <div className="flex-shrink-0 ml-1 text-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}

        {/* Loading spinner overlay */}
        {isBusy && (
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
        <polyline points="1 4 1 10 7 10" />
        <polyline points="23 20 23 14 17 14" />
        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
      </svg>
    </span>
  );
}

function SnoozeIcon({ count }) {
  return (
    <span title={`נדחתה ${count} פעמים`} className="text-amber-500">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
      </svg>
    </span>
  );
}
