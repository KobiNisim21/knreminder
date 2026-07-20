import { useState, useRef, useEffect, useMemo } from 'react';

/**
 * DateTimePicker — iOS-style scroll-wheel date and time picker.
 *
 * Renders two side-by-side drum scrollers:
 *   Left column:  time slots (00:00 – 23:59 in 5-minute intervals)
 *   Right column: date slots (today + next 365 days)
 *
 * The selected item is always centered in the visible window (3 visible items).
 * Uses CSS snap scrolling for the native feel.
 *
 * Props:
 *   value    {Date}         — current selected datetime
 *   onChange {fn(Date)}     — called with new Date when selection changes
 *   allowPast {boolean}     — when true, the date drum also includes the past
 *                             365 days (needed when editing an old reminder and
 *                             keeping/choosing a past date). Default false, so
 *                             snooze pickers stay future-only.
 */
export default function DateTimePicker({ value, onChange, allowPast = false }) {
  const selectedDate = value ? new Date(value) : new Date();

  // Build date options. Future-only by default; also reaches into the past when
  // allowPast is set (edit modal). Memoized so the array identity is stable.
  const dateOptions = useMemo(() => buildDateOptions(allowPast), [allowPast]);
  // Build time options: 00:00 → 23:55 in 5-min steps
  const timeOptions = buildTimeOptions();

  // Find initial indices
  const initDateIdx = findDateIndex(dateOptions, selectedDate);
  const initTimeIdx = findTimeIndex(timeOptions, selectedDate);

  const [dateIdx, setDateIdx] = useState(initDateIdx);
  const [timeIdx, setTimeIdx] = useState(initTimeIdx);

  const dateRef = useRef(null);
  const timeRef = useRef(null);

  const ITEM_HEIGHT = 44; // px per drum item

  // Scroll to selected item on mount
  useEffect(() => {
    scrollTo(dateRef, dateIdx);
    scrollTo(timeRef, timeIdx);
  }, []);

  function scrollTo(ref, idx) {
    if (ref.current) {
      ref.current.scrollTop = idx * ITEM_HEIGHT;
    }
  }

  function handleDateScroll(e) {
    const idx = Math.round(e.target.scrollTop / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(idx, dateOptions.length - 1));
    setDateIdx(clamped);
    emitChange(clamped, timeIdx);
  }

  function handleTimeScroll(e) {
    const idx = Math.round(e.target.scrollTop / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(idx, timeOptions.length - 1));
    setTimeIdx(clamped);
    emitChange(dateIdx, clamped);
  }

  function emitChange(dIdx, tIdx) {
    const date = dateOptions[dIdx].date;
    const { h, m } = timeOptions[tIdx];
    const result = new Date(date);
    result.setHours(h, m, 0, 0);
    onChange(result);
  }

  return (
    <div className="flex items-center justify-center gap-2 py-2 select-none" dir="ltr">
      <div className="relative flex gap-2 w-full max-w-xs">

        {/* Selection highlight bar — sits between the top/bottom fade lines */}
        <div
          className="absolute left-0 right-0 pointer-events-none z-10 rounded-lg"
          style={{
            top: ITEM_HEIGHT,
            height: ITEM_HEIGHT,
            backgroundColor: 'rgba(0,0,0,0.06)',
            borderTop: '1px solid rgba(0,0,0,0.10)',
            borderBottom: '1px solid rgba(0,0,0,0.10)',
          }}
        />

        {/* ── Time drum ─────────────────────────────────────────────────── */}
        <DrumColumn
          items={timeOptions.map((t) => t.label)}
          selectedIdx={timeIdx}
          onScroll={handleTimeScroll}
          ref={timeRef}
          itemHeight={ITEM_HEIGHT}
        />

        {/* ── Date drum ─────────────────────────────────────────────────── */}
        <DrumColumn
          items={dateOptions.map((d) => d.label)}
          selectedIdx={dateIdx}
          onScroll={handleDateScroll}
          ref={dateRef}
          itemHeight={ITEM_HEIGHT}
          wide
        />
      </div>
    </div>
  );
}

// ─── DrumColumn ────────────────────────────────────────────────────────────────

import { forwardRef } from 'react';

const DrumColumn = forwardRef(function DrumColumn(
  { items, selectedIdx, onScroll, itemHeight, wide },
  ref
) {
  const VISIBLE = 3;
  const PADDING = Math.floor(VISIBLE / 2);

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className={`overflow-y-scroll scrollbar-hide relative ${wide ? 'flex-[2]' : 'flex-1'}`}
      style={{
        height: VISIBLE * itemHeight,
        scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch',
        // Prevent iOS from creating a new stacking context that clips text
        WebkitTransform: 'translateZ(0)',
      }}
    >
      {/* Top padding */}
      {Array.from({ length: PADDING }).map((_, i) => (
        <div key={`top-${i}`} style={{ height: itemHeight }} />
      ))}

      {items.map((label, idx) => {
        const isSelected = idx === selectedIdx;
        return (
          <div
            key={idx}
            style={{
              height: itemHeight,
              scrollSnapAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isSelected ? '16px' : '14px',
              fontWeight: isSelected ? '500' : '400',
              // Use explicit rgba instead of Tailwind opacity classes —
              // iOS Safari mishandles text-opacity with certain font variants.
              // -webkit-text-fill-color overrides color on iOS; set it explicitly.
              color: isSelected ? 'rgba(33,33,33,1)' : 'rgba(117,117,117,0.75)',
              WebkitTextFillColor: isSelected ? 'rgba(33,33,33,1)' : 'rgba(117,117,117,0.75)',
              transition: 'font-size 0.15s, color 0.15s',
            }}
          >
            {label}
          </div>
        );
      })}

      {/* Bottom padding */}
      {Array.from({ length: PADDING }).map((_, i) => (
        <div key={`bot-${i}`} style={{ height: itemHeight }} />
      ))}
    </div>
  );
});


// ─── Helpers ───────────────────────────────────────────────────────────────────

// When allowPast is set, the drum also spans this many days *before* today so an
// old reminder's original date can be selected. The Hebrew label includes the
// year for past dates (they can be from previous years) to avoid ambiguity.
const PAST_DAYS = 365;

function buildDateOptions(allowPast = false) {
  const options = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hebrewDate = new Intl.DateTimeFormat('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const hebrewDateWithYear = new Intl.DateTimeFormat('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const start = allowPast ? -PAST_DAYS : 0;
  for (let i = start; i < 365; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    let label;
    if (i === 0) label = 'היום';
    else if (i === 1) label = 'מחר';
    else if (i === -1) label = 'אתמול';
    else if (i < 0) label = hebrewDateWithYear.format(date);
    else label = hebrewDate.format(date);
    options.push({ date, label });
  }
  return options;
}

function buildTimeOptions() {
  const options = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 5) {
      const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      options.push({ h, m, label });
    }
  }
  return options;
}

function findDateIndex(options, date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const idx = options.findIndex((o) => o.date.getTime() === d.getTime());
  return Math.max(0, idx);
}

function findTimeIndex(options, date) {
  const h = date.getHours();
  const m = Math.round(date.getMinutes() / 5) * 5; // round to nearest 5 min
  const idx = options.findIndex((o) => o.h === h && o.m === m);
  return Math.max(0, idx === -1 ? 0 : idx);
}
