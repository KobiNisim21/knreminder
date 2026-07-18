import { useMemo } from 'react';
import { useReminders } from './useReminders';

/**
 * useCalendarData — Aggregates active reminders into a date-keyed map.
 *
 * Returns:
 *   remindersByDate: { 'YYYY-MM-DD': [reminder, ...], ... }
 *
 * Used by the calendar grid to draw dots under each date cell.
 */
export function useCalendarData() {
  const { data: reminders = [], isLoading, isError, error, refetch } = useReminders();

  const remindersByDate = useMemo(() => {
    const map = {};
    for (const r of reminders) {
      // Use local date (not UTC) so dots appear on the correct calendar cell
      const d    = new Date(r.reminderAt);
      const key  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [reminders]);

  return { remindersByDate, isLoading, isError, error, refetch };
}

/**
 * Builds the flat cell array for a calendar month grid.
 *
 * In Israel, weeks start on Sunday (getDay() === 0).
 * The array always has a multiple-of-7 length, with leading nulls
 * for the offset and trailing nulls to complete the last row.
 *
 * @param {number} year
 * @param {number} month - 0-indexed (0 = January)
 * @returns {Array<Date|null>}
 */
export function buildMonthCells(year, month) {
  const firstDay   = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingNulls = firstDay.getDay(); // 0=Sun, 1=Mon … 6=Sat

  const cells = [];

  // Leading empty cells (days before the 1st)
  for (let i = 0; i < leadingNulls; i++) cells.push(null);

  // Days of the current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }

  // Trailing empty cells to complete the last week row
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

/**
 * Returns 'YYYY-MM-DD' key for a Date in local time.
 */
export function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
