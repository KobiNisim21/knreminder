/**
 * convert_legacy.js — one-time migration: BZ Reminder backup → KN Reminder backup.
 *
 * Reads a legacy "BZ Reminder" export (root object with a `bzzzs` array) and
 * writes a KN Reminder restore file ({ format:"knr-backup", version:1, items:[…] })
 * that can be fed straight into the app's Backup & Restore (POST /api/reminders/import).
 *
 * Usage (from server/):
 *   node scripts/convert_legacy.js <input.bzr> [output.json]
 *   node scripts/convert_legacy.js ../uploads/backupbz.bzr ./migrated-backup.knr.json
 *
 * Mapping rules (agreed with the user):
 *   text        ← description
 *   reminderAt  ← dateBzzz, interpreted as Asia/Jerusalem wall-clock → UTC (DST-aware)
 *   status      ← NEW | BZZZING → "active";  DISMISSED → "completed" (+ completedAt = now)
 *   recurrence  ← ONCE               → isRecurring:false
 *                 REPEAT_DAY         → daily
 *                 REPEAT_DAY_OF_WEEK → weekly  (dayOfWeek from the reminder's own weekday)
 *                 REPEAT_YEAR        → yearly
 *   birthday    ← REPEAT_YEAR + dateBirth with a REAL year (1900..thisYear) becomes
 *                 type:"birthday" with personName + birthYear. REPEAT_YEAR items that
 *                 aren't real people (placeholder year like 0001, e.g. an anniversary,
 *                 or a note) stay type:"reminder" with a yearly recurrence instead — so
 *                 the Birthdays tab only ever shows people with valid ages.
 *
 * This script only READS the input and WRITES a new file. It never touches the
 * database — you review the output, then restore it through the app.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const TZ = 'Asia/Jerusalem';
const THIS_YEAR = new Date().getFullYear();

const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;

/**
 * Convert a naive wall-clock timestamp ("2024-06-16T19:00:00", no zone) that was
 * recorded in `tz` into the correct UTC Date, honouring DST for that date.
 */
function zonedToUtc(naive, tz) {
  const asIfUtc = new Date(naive + 'Z');
  if (Number.isNaN(asIfUtc.getTime())) return null;
  const tzStr = asIfUtc.toLocaleString('en-US', { timeZone: tz });
  const utcStr = asIfUtc.toLocaleString('en-US', { timeZone: 'UTC' });
  const offsetMs = new Date(tzStr) - new Date(utcStr);
  return new Date(asIfUtc.getTime() - offsetMs);
}

/** The weekday (0=Sun..6=Sat) of a UTC date as it reads in Israel local time. */
function weekdayInTz(utcDate, tz) {
  return new Date(utcDate.toLocaleString('en-US', { timeZone: tz })).getDay();
}

/** Extract a 4-digit birth year from a dateBirth string, or null if not real. */
function realBirthYear(dateBirth) {
  if (!dateBirth || typeof dateBirth !== 'string') return null;
  const m = dateBirth.match(/^(\d{4})-/);
  if (!m) return null;
  const year = Number(m[1]);
  // The KN schema only accepts 1900..currentYear. Placeholder years (e.g. 0001,
  // used by BZ for anniversaries with no birth year) are rejected here so they
  // fall through to the "yearly reminder" branch instead of the Birthdays tab.
  if (year >= 1900 && year <= THIS_YEAR) return year;
  return null;
}

/**
 * Does this label look like a person's name (vs. an event/note)?
 *
 * A valid birth year alone isn't enough: a car-service note ("...92,000 km...",
 * year 2025) or an anniversary of an event ("the day I met my wife", year 2024)
 * both carry plausible years but are NOT people, and would render as "age 1-2".
 * Real people in this data are short labels with no digits (אמא, אבא, שירן…), so
 * we additionally require a name-like label: at most 2 words and no digits.
 */
function looksLikePersonName(text) {
  if (!text) return false;
  if (/\d/.test(text)) return false; // notes with quantities/measurements
  const words = text.trim().split(/\s+/);
  return words.length <= 2;
}

function convert(legacy) {
  const records = Array.isArray(legacy?.bzzzs) ? legacy.bzzzs : [];
  const items = [];
  const stats = {
    total: records.length,
    active: 0,
    completed: 0,
    birthdays: 0,
    daily: 0,
    weekly: 0,
    yearly: 0,
    once: 0,
    skipped: 0,
  };
  const warnings = [];
  const nowIso = new Date().toISOString();

  records.forEach((r, i) => {
    const text = (r.description || '').trim();
    const utc = zonedToUtc(r.dateBzzz, TZ);

    // A KN item must have text + a valid reminderAt.
    if (!text || !utc) {
      stats.skipped += 1;
      warnings.push(`#${i}: skipped (missing description or unparseable dateBzzz="${r.dateBzzz}")`);
      return;
    }

    // ── Status ────────────────────────────────────────────────────────────────
    const legacyStatus = String(r.status || '').toUpperCase();
    const isDismissed = legacyStatus === 'DISMISSED';
    const status = isDismissed ? 'completed' : 'active';

    // ── Recurrence / type ───────────────────────────────────────────────────────
    const alarm = String(r.alarm || 'ONCE').toUpperCase();
    let type = 'reminder';
    let isRecurring = false;
    let recurrence = null;
    let personName = null;
    let birthYear = null;

    if (alarm === 'REPEAT_DAY') {
      isRecurring = true;
      recurrence = { frequency: 'daily', dayOfWeek: null, dayOfMonth: null, endDate: null };
      stats.daily += 1;
    } else if (alarm === 'REPEAT_DAY_OF_WEEK') {
      isRecurring = true;
      recurrence = {
        frequency: 'weekly',
        dayOfWeek: weekdayInTz(utc, TZ),
        dayOfMonth: null,
        endDate: null,
      };
      stats.weekly += 1;
      // The KN schema supports a single weekly day; flag legacy multi-day rules.
      if (r.extraDaysOfWeek) {
        try {
          const days = Object.entries(JSON.parse(r.extraDaysOfWeek))
            .filter(([, v]) => v)
            .map(([k]) => k.replace(/^is/, ''));
          if (days.length > 1) {
            warnings.push(
              `#${i}: weekly rule had multiple days [${days.join(', ')}] — kept only ${
                ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][recurrence.dayOfWeek]
              } (schema supports one). Text: "${text.slice(0, 30)}"`
            );
          }
        } catch {
          /* ignore malformed extraDaysOfWeek */
        }
      }
    } else if (alarm === 'REPEAT_YEAR') {
      const by = realBirthYear(r.dateBirth);
      recurrence = { frequency: 'yearly', dayOfWeek: null, dayOfMonth: null, endDate: null };
      isRecurring = true;
      if (by && looksLikePersonName(text)) {
        // A real person → Birthdays tab.
        type = 'birthday';
        personName = text.slice(0, 120);
        birthYear = by;
        stats.birthdays += 1;
        warnings.push(`#${i}: → BIRTHDAY "${text.slice(0, 30)}" (born ${by})`);
      } else {
        // Anniversary / note / non-person → yearly reminder, not a birthday.
        stats.yearly += 1;
        if (by) {
          warnings.push(
            `#${i}: REPEAT_YEAR "${text.slice(0, 30)}" had year ${by} but isn't a person → yearly reminder`
          );
        }
      }
    } else {
      // ONCE (or unknown) → one-off reminder.
      stats.once += 1;
    }

    if (status === 'completed') stats.completed += 1;
    else stats.active += 1;

    const item = {
      text: text.slice(0, 500), // respect schema maxlength
      type,
      personName,
      birthYear,
      reminderAt: utc.toISOString(),
      isRecurring,
      recurrence,
      status,
      completedAt: isDismissed ? nowIso : null,
      snoozeCount: 0,
      originalReminderAt: null,
      notified: false,
      expiresAt: null,
    };

    items.push(item);
  });

  return { items, stats, warnings };
}

function main() {
  const args = process.argv.slice(2);
  const input = args[0];
  if (!input) {
    console.error(RED('Usage: node scripts/convert_legacy.js <input.bzr> [output.json]'));
    process.exit(1);
  }
  const output = args[1] || path.join(path.dirname(input), 'migrated-backup.knr.json');

  const raw = fs.readFileSync(input, 'utf8');
  const legacy = JSON.parse(raw);

  const { items, stats, warnings } = convert(legacy);

  const backup = {
    format: 'knr-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    source: 'bz-reminder-migration',
    count: items.length,
    items,
  };

  fs.writeFileSync(output, JSON.stringify(backup, null, 2), 'utf8');

  console.log(GREEN(`✓ Wrote ${items.length} items → ${output}`));
  console.log('\nSummary:');
  console.log(`  total legacy records : ${stats.total}`);
  console.log(`  converted            : ${items.length}`);
  console.log(`  skipped              : ${stats.skipped}`);
  console.log(`  ── by status ──`);
  console.log(`  active               : ${stats.active}`);
  console.log(`  completed            : ${stats.completed}`);
  console.log(`  ── by kind ──`);
  console.log(`  one-off (ONCE)       : ${stats.once}`);
  console.log(`  daily                : ${stats.daily}`);
  console.log(`  weekly               : ${stats.weekly}`);
  console.log(`  yearly reminder      : ${stats.yearly}`);
  console.log(`  birthdays (people)   : ${stats.birthdays}`);

  if (warnings.length) {
    console.log(YELLOW(`\n${warnings.length} warning(s):`));
    warnings.forEach((w) => console.log(YELLOW('  • ' + w)));
  }
}

main();

module.exports = { convert, zonedToUtc, realBirthYear };
