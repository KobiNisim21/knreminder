/**
 * dateHelpers.js
 *
 * Utilities for grouping reminders into Timeline sections:
 *   TODAY / TOMORROW / UPCOMING (by date)
 * and for formatting Hebrew display strings.
 */

// ─── Grouping ─────────────────────────────────────────────────────────────────

/**
 * Returns a Date set to midnight (00:00:00.000) of the given date,
 * in local time — used for day-level comparisons.
 */
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Groups an array of reminder objects into sections for the dashboard.
 *
 * @param {Array} reminders - Sorted ascending by reminderAt
 * @returns {Array<{ label: string, key: string, reminders: Array }>}
 *
 * Section labels:
 *   'היום'      — today
 *   'מחר'       — tomorrow
 *   'עבר הזמן'  — past (overdue active reminders)
 *   Date string — e.g. 'יום ג׳, 20 ביולי'
 */
export function groupRemindersByDay(reminders) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const dayAfterTomorrowStart = new Date(tomorrowStart);
  dayAfterTomorrowStart.setDate(dayAfterTomorrowStart.getDate() + 1);

  const groups = {};
  const groupOrder = [];

  for (const reminder of reminders) {
    const date = new Date(reminder.reminderAt);
    const dayStart = startOfDay(date);
    let key;
    let label;

    if (dayStart < todayStart) {
      key = '__overdue__';
      label = '⚠️ עבר הזמן';
    } else if (dayStart.getTime() === todayStart.getTime()) {
      key = '__today__';
      label = 'היום';
    } else if (dayStart.getTime() === tomorrowStart.getTime()) {
      key = '__tomorrow__';
      label = 'מחר';
    } else {
      // Future dates — use ISO date string as key (stable)
      key = dayStart.toISOString().slice(0, 10);
      label = formatDateLabel(date);
    }

    if (!groups[key]) {
      groups[key] = { label, key, reminders: [] };
      groupOrder.push(key);
    }
    groups[key].reminders.push(reminder);
  }

  // Return in insertion order (reminders are pre-sorted by reminderAt)
  // but put overdue first
  const ordered = [];
  if (groups['__overdue__']) ordered.push(groups['__overdue__']);
  if (groups['__today__']) ordered.push(groups['__today__']);
  if (groups['__tomorrow__']) ordered.push(groups['__tomorrow__']);
  for (const key of groupOrder) {
    if (!['__overdue__', '__today__', '__tomorrow__'].includes(key)) {
      ordered.push(groups[key]);
    }
  }

  return ordered;
}

// ─── Formatters ──────────────────────────────────────────────────────────────

/**
 * Formats a date into a Hebrew section header label.
 * Example: "יום ג׳, 20 ביולי 2026"
 */
export function formatDateLabel(date) {
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

/**
 * Formats just the time portion for display in a reminder row.
 * Returns { hours, minutes, period } for flexible rendering.
 * Uses 24-hour format (common in Israeli apps).
 *
 * Example: { hours: '18', minutes: '30', period: null }
 */
export function parseDisplayTime(date) {
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return { hours, minutes };
}

/**
 * Formats a full Hebrew datetime string for Telegram messages.
 * Example: "יום ה׳, 17 ביולי 2026, 18:00"
 */
export function formatFullHebrew(date) {
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/**
 * Formats a relative time label for the completed list.
 * Examples: "לפני שעתיים", "לפני 3 ימים", "לפני שבוע"
 */
export function formatRelativeTime(date) {
  const rtf = new Intl.RelativeTimeFormat('he', { numeric: 'auto' });
  const diffMs = new Date(date) - new Date();
  const diffSecs = Math.round(diffMs / 1000);
  const diffMins = Math.round(diffSecs / 60);
  const diffHours = Math.round(diffMins / 60);
  const diffDays = Math.round(diffHours / 24);
  const diffWeeks = Math.round(diffDays / 7);

  if (Math.abs(diffSecs) < 60) return rtf.format(diffSecs, 'second');
  if (Math.abs(diffMins) < 60) return rtf.format(diffMins, 'minute');
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, 'day');
  return rtf.format(diffWeeks, 'week');
}

/**
 * Returns the Hebrew label for a recurrence frequency.
 */
export const RECURRENCE_LABELS = {
  daily:   'כל יום',
  weekly:  'כל שבוע',
  monthly: 'כל חודש',
  yearly:  'כל שנה',
};

/**
 * Checks whether a reminder's time has passed.
 */
export function isOverdue(reminder) {
  return reminder.status === 'active' && new Date(reminder.reminderAt) < new Date();
}

// ─── Birthdays ─────────────────────────────────────────────────────────────────

/**
 * Computes the age a person will turn on their upcoming birthday occurrence.
 *
 * The birthday's reminderAt already points at the next upcoming occurrence
 * (the recurrence engine advances it each year), so the age is simply the
 * occurrence year minus the birth year.
 *
 * @param {number|null} birthYear
 * @param {string|Date} occurrenceDate - the upcoming reminderAt
 * @returns {number|null} the age they turn, or null if birthYear unknown
 */
export function computeUpcomingAge(birthYear, occurrenceDate) {
  if (!birthYear) return null;
  const occurrenceYear = new Date(occurrenceDate).getFullYear();
  const age = occurrenceYear - birthYear;
  return age >= 0 ? age : null;
}

/**
 * Builds the birthday row label in the reference layout: "y/o 57 ,אמא".
 * Falls back gracefully when age or name is missing.
 *
 * @param {object} b - birthday reminder document
 * @returns {string}
 */
export function formatBirthdayLabel(b) {
  const name = b.personName || b.text || '';
  const age = computeUpcomingAge(b.birthYear, b.reminderAt);
  if (age === null) return name;
  return `y/o ${age} ,${name}`;
}

/**
 * Formats a birthday's date as an uppercase short header,
 * matching the reference UI (e.g. "THU 2 APR 2026").
 */
export function formatBirthdayDateHeader(date) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
    .format(new Date(date))
    .toUpperCase();
}
