import { toDateKey } from '../hooks/useCalendarData';

// Abbreviated Hebrew day names — Sunday first (Israeli convention)
// Displayed RTL: right = ראשון (א'), left = שבת (ש')
const DAY_HEADERS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];
const DAY_FULL    = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// Max dots to show per cell (capped for visual cleanliness)
const MAX_DOTS = 3;

/**
 * DayCell — A single cell in the calendar month grid.
 *
 * Props:
 *   date           {Date|null}   — the date this cell represents (null = empty padding cell)
 *   reminders      {Array}       — reminders that fall on this date
 *   isToday        {boolean}
 *   isSelected     {boolean}
 *   isCurrentMonth {boolean}     — false for padding cells from prev/next month
 *   onClick        {fn(date)}
 */
export default function DayCell({
  date,
  reminders = [],
  isToday,
  isSelected,
  isCurrentMonth,
  onClick,
}) {
  // Empty padding cell
  if (!date) {
    return <div className="h-14" aria-hidden="true" />;
  }

  const count      = reminders.length;
  const dotCount   = Math.min(count, MAX_DOTS);
  const hasOverdue = reminders.some((r) => r.status === 'active' && new Date(r.reminderAt) < new Date());
  const dateKey    = toDateKey(date);

  return (
    <button
      className={`relative flex flex-col items-center justify-start pt-1 pb-1.5
                  h-14 w-full rounded-xl transition-all duration-150 select-none
                  focus:outline-none active:scale-95
                  ${isSelected  ? 'bg-primary/10'    : 'hover:bg-gray-50'}
                  ${!isCurrentMonth ? 'opacity-30'   : ''}`}
      onClick={() => onClick(date)}
      aria-label={`${DAY_FULL[date.getDay()]} ${date.getDate()}, ${count > 0 ? `${count} תזכורות` : ''}`}
      aria-pressed={isSelected}
      data-date={dateKey}
    >
      {/* Day number — today gets a filled blue circle */}
      <div
        className={`w-8 h-8 flex items-center justify-center rounded-full text-[15px] font-medium
                    transition-colors duration-150
                    ${isToday
                      ? 'bg-primary text-white font-bold'
                      : isSelected
                        ? 'text-primary font-semibold'
                        : 'text-textPrimary'}`}
      >
        {date.getDate()}
      </div>

      {/* Reminder dot indicators */}
      {count > 0 && (
        <div className="flex gap-[3px] mt-0.5" aria-hidden="true">
          {Array.from({ length: dotCount }).map((_, i) => (
            <span
              key={i}
              className={`block w-1.5 h-1.5 rounded-full transition-colors
                          ${i === 0 && hasOverdue ? 'bg-accent' : 'bg-primary'}`}
            />
          ))}
          {/* "+" label when more than MAX_DOTS */}
          {count > MAX_DOTS && (
            <span className="text-[8px] text-primary font-bold leading-none mt-px">+</span>
          )}
        </div>
      )}
    </button>
  );
}

// Re-export day headers for MonthGrid
export { DAY_HEADERS };
