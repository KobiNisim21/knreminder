import { buildMonthCells, toDateKey } from '../hooks/useCalendarData';
import DayCell, { DAY_HEADERS } from './DayCell';

// Full Hebrew month names
const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

/**
 * MonthGrid — The core calendar component.
 *
 * Renders a full month grid with:
 *   • Month navigation (prev / next)
 *   • Hebrew RTL day-of-week headers (Sunday = rightmost column)
 *   • DayCell for each day with reminder dots
 *   • Today highlighted in blue; selected day in light blue
 *
 * Props:
 *   year           {number}
 *   month          {number}        — 0-indexed
 *   selectedDate   {Date|null}     — currently selected day
 *   remindersByDate {object}       — { 'YYYY-MM-DD': [reminder, ...] }
 *   onMonthChange  {fn(year, month)}
 *   onDaySelect    {fn(Date)}
 */
export default function MonthGrid({
  year,
  month,
  selectedDate,
  remindersByDate,
  holidays,
  onMonthChange,
  onDaySelect,
}) {
  const today      = new Date();
  const todayKey   = toDateKey(today);
  const selectedKey = selectedDate ? toDateKey(selectedDate) : null;
  const cells      = buildMonthCells(year, month);

  function goToPrev() {
    if (month === 0) onMonthChange(year - 1, 11);
    else             onMonthChange(year, month - 1);
  }

  function goToNext() {
    if (month === 11) onMonthChange(year + 1, 0);
    else              onMonthChange(year, month + 1);
  }

  function goToToday() {
    onMonthChange(today.getFullYear(), today.getMonth());
    onDaySelect(today);
  }

  const isCurrentMonthView =
    year === today.getFullYear() && month === today.getMonth();

  return (
    <div className="bg-surface border-b border-divider select-none">

      {/* ── Month navigation header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* Next month (left arrow in RTL = forward) */}
        <button
          onClick={goToNext}
          className="w-8 h-8 flex items-center justify-center rounded-full
                     text-textSecondary hover:bg-gray-100 active:bg-gray-200
                     transition-colors"
          aria-label="חודש הבא"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        {/* Month + year title — tap to jump to today */}
        <button
          onClick={goToToday}
          className={`text-[17px] font-semibold transition-colors
                      ${isCurrentMonthView ? 'text-primary' : 'text-textPrimary'}`}
          aria-label="חזור להיום"
        >
          {MONTH_NAMES[month]} {year}
        </button>

        {/* Prev month (right arrow in RTL = backward) */}
        <button
          onClick={goToPrev}
          className="w-8 h-8 flex items-center justify-center rounded-full
                     text-textSecondary hover:bg-gray-100 active:bg-gray-200
                     transition-colors"
          aria-label="חודש קודם"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
      </div>

      {/* ── Day-of-week headers ──────────────────────────────────────────────── */}
      {/* RTL: first header (ראשון / א') appears on the RIGHT (Sunday position) */}
      <div className="grid grid-cols-7 px-2 pb-1" dir="rtl">
        {DAY_HEADERS.map((label, i) => (
          <div
            key={i}
            className={`text-center text-[11px] font-semibold py-1
                        ${i === 6 ? 'text-accent' : 'text-textSecondary'}`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* ── Day cells grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-y-0.5 px-2 pb-3" dir="rtl">
        {cells.map((date, idx) => {
          if (!date) {
            return <div key={`empty-${idx}`} className="h-14" aria-hidden="true" />;
          }
          const key          = toDateKey(date);
          const reminders    = remindersByDate[key] ?? [];
          const isToday      = key === todayKey;
          const isSelected   = key === selectedKey;
          const isCurrentMon = date.getMonth() === month;
          const holidaySubject = holidays?.[key];

          return (
            <DayCell
              key={key}
              date={date}
              reminders={reminders}
              holidaySubject={holidaySubject}
              isToday={isToday}
              isSelected={isSelected}
              isCurrentMonth={isCurrentMon}
              onClick={onDaySelect}
            />
          );
        })}
      </div>
    </div>
  );
}
