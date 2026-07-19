import { useState } from 'react';
import { useBirthdays } from '../hooks/useReminders';
import BottomNav from '../components/BottomNav';
import AddBirthdayModal from '../components/AddBirthdayModal';
import { useSettings, BIRTHDAY_COLORS } from '../context/SettingsContext';
import {
  parseDisplayTime,
  formatBirthdayLabel,
  formatBirthdayDateHeader,
} from '../utils/dateHelpers';

/** Resolves the user's default birthday color key to a display hex. */
function birthdayColorHex(key) {
  const c = BIRTHDAY_COLORS.find((x) => x.key === key);
  // White reads as invisible on a white row — fall back to the neutral gray.
  if (!c || c.key === 'white') return '#8E8E93';
  return c.hex;
}

/**
 * Birthdays — Upcoming birthday feed, grouped chronologically by date.
 *
 * Each row shows:
 *   • The occurrence time (e.g. 10:00) in red, BZ-Reminder style
 *   • The label "y/o 57 ,אמא" (age the person turns + name)
 *   • A cake icon on the trailing side
 *
 * Birthdays are yearly-recurring reminders (type:'birthday'); the recurrence
 * engine advances reminderAt to next year after each notification fires.
 */
export default function Birthdays() {
  const { data: birthdays, isLoading, isError, error, refetch, isFetching } = useBirthdays();
  const { settings } = useSettings();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="bg-surface border-b border-divider px-4 sticky top-0 z-20 pt-safe">
        <div className="flex items-center justify-between h-14">
          {/* Address-book icon (left in RTL) */}
          <button
            className="text-primary p-1 rounded-full active:bg-gray-100 transition-colors"
            aria-label="אנשי קשר"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </button>

          <h1 className="text-lg font-semibold text-textPrimary">ימי הולדת</h1>

          {/* Add button (right in RTL) */}
          <button
            onClick={() => setModalOpen(true)}
            className="text-primary p-1 rounded-full active:bg-gray-100 transition-colors"
            aria-label="הוסף יום הולדת"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {isFetching && !isLoading && (
          <div className="h-0.5 bg-primary/20 -mx-4 relative overflow-hidden">
            <div className="absolute inset-y-0 bg-primary animate-pulse w-1/3 rounded-full" />
          </div>
        )}
      </header>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 scroll-container momentum-scroll scrollbar-hide">
        {isLoading && <BirthdaySkeleton />}

        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-4 animate-fade-in">
            <p className="font-medium text-textPrimary">שגיאה בטעינת ימי ההולדת</p>
            <p className="text-sm text-textSecondary">{error?.message}</p>
            <button
              onClick={refetch}
              className="mt-1 px-5 py-2 bg-primary text-white rounded-ios text-sm font-medium active:scale-95 transition-transform"
            >
              נסה שנית
            </button>
          </div>
        )}

        {!isLoading && !isError && (
          <BirthdayFeed
            birthdays={birthdays ?? []}
            onAdd={() => setModalOpen(true)}
            accentColor={birthdayColorHex(settings.birthdays.color)}
          />
        )}
      </main>

      {/* ── Modal + Nav ─────────────────────────────────────────────────────── */}
      <AddBirthdayModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      <BottomNav onAddPress={() => setModalOpen(true)} anyModalOpen={modalOpen} />
    </div>
  );
}

// ─── Feed ───────────────────────────────────────────────────────────────────────

function BirthdayFeed({ birthdays, onAdd, accentColor }) {
  if (birthdays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-8 text-center gap-4 animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-2">
          <CakeIcon size={40} className="text-textDisabled" />
        </div>
        <p className="text-base font-medium text-textPrimary">אין ימי הולדת</p>
        <p className="text-sm text-textSecondary leading-relaxed">
          לחץ על <span className="text-primary font-bold">+</span> כדי להוסיף יום הולדת ראשון
        </p>
        <button
          onClick={onAdd}
          className="mt-2 px-6 py-2.5 bg-primary text-white rounded-ios text-sm font-medium active:scale-95 transition-transform"
        >
          הוסף יום הולדת
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1">
      {birthdays.map((b) => (
        <section key={b._id}>
          {/* Date header (uppercase, gray) */}
          <div className="section-header !text-textSecondary uppercase text-xs tracking-wide">
            {formatBirthdayDateHeader(b.reminderAt)}
          </div>

          {/* Birthday row */}
          <BirthdayRow birthday={b} accentColor={accentColor} />
        </section>
      ))}
      <div className="h-4" />
    </div>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────────────

function BirthdayRow({ birthday, accentColor }) {
  const { hours, minutes } = parseDisplayTime(birthday.reminderAt);
  const label = formatBirthdayLabel(birthday);

  return (
    <div className="reminder-row bg-surface">
      {/* Time column — tinted with the user's default birthday color */}
      <div className="min-w-[76px] text-right ml-3 flex-shrink-0">
        <div className="time-display" style={{ color: accentColor }}>
          {hours}:{minutes}
        </div>
      </div>

      {/* Label column */}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] leading-snug text-textPrimary truncate" dir="rtl">
          {label}
        </p>
      </div>

      {/* Cake icon (trailing) — tinted with the default birthday color */}
      <div className="flex-shrink-0 ml-1" style={{ color: accentColor }}>
        <CakeIcon size={22} />
      </div>
    </div>
  );
}

// ─── Icons & skeleton ─────────────────────────────────────────────────────────

function CakeIcon({ size = 22, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
      <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" />
      <path d="M2 21h20" />
      <path d="M7 8v2M12 8v2M17 8v2" />
      <path d="M7 4h.01M12 3h.01M17 4h.01" />
    </svg>
  );
}

function BirthdaySkeleton() {
  return (
    <div className="animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <div className="h-9 bg-gray-100 border-y border-divider px-4 flex items-center">
            <div className="h-3 w-24 bg-gray-200 rounded" />
          </div>
          <div className="flex items-center px-4 py-4 border-b border-divider bg-white gap-4">
            <div className="w-16 h-8 bg-gray-100 rounded" />
            <div className="flex-1 h-4 bg-gray-100 rounded" />
            <div className="w-6 h-6 bg-gray-100 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
