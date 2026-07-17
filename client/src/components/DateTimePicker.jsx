import { useState, useRef, useEffect } from 'react';

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
 */
export default function DateTimePicker({ value, onChange }) {
  const selectedDate = value ? new Date(value) : new Date();

  // Build date options: today + 364 days
  const dateOptions = buildDateOptions();
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
      {/* Selection highlight bar */}
      <div className="relative flex gap-2 w-full max-w-xs">
        {/* Highlight overlay (center row) */}
        <div
          className="absolute left-0 right-0 pointer-events-none z-10 rounded-lg bg-gray-100"
          style={{
            top: ITEM_HEIGHT,
            height: ITEM_HEIGHT,
          }}
        />
        {/* Top / bottom fade gradients */}
        <div className="absolute left-0 right-0 top-0 h-11 pointer-events-none z-20 bg-gradient-to-b from-white to-transparent" />
        <div className="absolute left-0 right-0 bottom-0 h-11 pointer-events-none z-20 bg-gradient-to-t from-white to-transparent" />

        {/* ── Time drum (left, since LTR inside) ─────────────────────── */}
        <DrumColumn
          items={timeOptions.map((t) => t.label)}
          selectedIdx={timeIdx}
          onScroll={handleTimeScroll}
          ref={timeRef}
          itemHeight={ITEM_HEIGHT}
        />

        {/* ── Date drum (right) ─────────────────────────────────────── */}
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
  const PADDING = Math.floor(VISIBLE / 2); // 1 item padding top and bottom

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className={`overflow-y-scroll scrollbar-hide relative ${wide ? 'flex-[2]' : 'flex-1'}`}
      style={{
        height: VISIBLE * itemHeight,
        scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Top padding */}
      {Array.from({ length: PADDING }).map((_, i) => (
        <div key={`top-${i}`} style={{ height: itemHeight }} />
      ))}

      {items.map((label, idx) => (
        <div
          key={idx}
          className={`flex items-center justify-center text-[15px] transition-all duration-150
                      ${idx === selectedIdx
                        ? 'text-textPrimary font-medium'
                        : 'text-textSecondary text-opacity-60'}`}
          style={{
            height: itemHeight,
            scrollSnapAlign: 'center',
            fontSize: idx === selectedIdx ? '16px' : '14px',
          }}
        >
          {label}
        </div>
      ))}

      {/* Bottom padding */}
      {Array.from({ length: PADDING }).map((_, i) => (
        <div key={`bot-${i}`} style={{ height: itemHeight }} />
      ))}
    </div>
  );
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildDateOptions() {
  const options = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hebrewDate = new Intl.DateTimeFormat('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  for (let i = 0; i < 365; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    let label;
    if (i === 0) label = 'היום';
    else if (i === 1) label = 'מחר';
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
