import { createContext, useContext, useEffect, useState, useCallback } from 'react';

/**
 * SettingsContext — Centralized, LocalStorage-backed app preferences.
 *
 * All user-tunable settings live here so any screen can read/write them and
 * every consumer re-renders on change. The whole object is persisted to
 * LocalStorage under a single key and rehydrated on load.
 *
 * Shape:
 *   repeat: {
 *     count:  number   // how many times a notification repeats
 *     period: string   // one of REPEAT_PERIODS values
 *   }
 *   snoozePresets: string[]  // ordered list shown in the snooze section
 *   birthdays: {
 *     color:        string   // hex/key of the default birthday tag color
 *     reminderTime: string   // "HH:MM" default delivery time
 *     inAdvance:    string   // one of IN_ADVANCE_OPTIONS values
 *   }
 */

const STORAGE_KEY = 'knr.settings.v1';

// ─── Option catalogs (exported so screens render consistent choices) ───────────

export const REPEAT_PERIODS = [
  { value: '5min',  label: "5 דקות" },
  { value: '15min', label: "15 דקות" },
  { value: '30min', label: "30 דקות" },
  { value: '1hour', label: 'שעה' },
  { value: '1day',  label: 'יום' },
];

// Snooze presets — mix of relative durations and absolute clock times,
// matching the reference screenshot (15 minutes, 1 hour, 10:00, 14:00, 18:00).
export const DEFAULT_SNOOZE_PRESETS = ['15min', '1hour', '10:00', '14:00', '18:00'];

export const BIRTHDAY_COLORS = [
  { key: 'white',  hex: '#FFFFFF', border: true },
  { key: 'blue',   hex: '#0A84FF' },
  { key: 'red',    hex: '#E53935' },
  { key: 'purple', hex: '#AF52DE' },
  { key: 'orange', hex: '#FF9500' },
  { key: 'green',  hex: '#34A853' },
];

export const IN_ADVANCE_OPTIONS = [
  { value: '0',  label: 'ביום עצמו' },
  { value: '1',  label: 'יום 1' },
  { value: '2',  label: 'יומיים' },
  { value: '3',  label: '3 ימים' },
  { value: '7',  label: 'שבוע' },
];

// ─── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS = {
  repeat: { count: 1, period: '1hour' },
  snoozePresets: DEFAULT_SNOOZE_PRESETS,
  birthdays: {
    color: 'blue',        // blue is checked by default in the reference
    reminderTime: '10:00',
    inAdvance: '3',
  },
};

// ─── Context ─────────────────────────────────────────────────────────────────

const SettingsContext = createContext(null);

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    // Deep-merge onto defaults so newly-added keys are always present.
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      repeat: { ...DEFAULT_SETTINGS.repeat, ...(parsed.repeat || {}) },
      birthdays: { ...DEFAULT_SETTINGS.birthdays, ...(parsed.birthdays || {}) },
      snoozePresets: Array.isArray(parsed.snoozePresets)
        ? parsed.snoozePresets
        : DEFAULT_SETTINGS.snoozePresets,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);

  // Persist on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* storage full / unavailable — settings stay in-memory for the session */
    }
  }, [settings]);

  // Update a top-level section by shallow-merging a patch.
  const updateSection = useCallback((section, patch) => {
    setSettings((prev) => ({
      ...prev,
      [section]:
        typeof prev[section] === 'object' && !Array.isArray(prev[section])
          ? { ...prev[section], ...patch }
          : patch,
    }));
  }, []);

  const updateBirthdays = useCallback(
    (patch) => updateSection('birthdays', patch),
    [updateSection]
  );

  const updateRepeat = useCallback(
    (patch) => updateSection('repeat', patch),
    [updateSection]
  );

  const setSnoozePresets = useCallback(
    (presets) => setSettings((prev) => ({ ...prev, snoozePresets: presets })),
    []
  );

  const resetSettings = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  const value = {
    settings,
    updateSection,
    updateRepeat,
    updateBirthdays,
    setSnoozePresets,
    resetSettings,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a <SettingsProvider>');
  }
  return ctx;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Human-readable label for a snooze preset value ("15min" → "15 דקות"). */
export function snoozePresetLabel(preset) {
  if (/^\d{1,2}:\d{2}$/.test(preset)) return preset; // clock time, show as-is
  const map = {
    '5min':  "5 דקות",
    '15min': "15 דקות",
    '30min': "30 דקות",
    '1hour': 'שעה',
    '3hour': '3 שעות',
    '1day':  'מחר',
  };
  return map[preset] || preset;
}

/** Label for a repeat-period value. */
export function repeatPeriodLabel(value) {
  return REPEAT_PERIODS.find((p) => p.value === value)?.label || value;
}

/** Label for an in-advance value. */
export function inAdvanceLabel(value) {
  return IN_ADVANCE_OPTIONS.find((o) => o.value === String(value))?.label || value;
}
