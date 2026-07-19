import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useSettings,
  REPEAT_PERIODS,
  repeatPeriodLabel,
  snoozePresetLabel,
} from '../context/SettingsContext';
// Options a snooze slot can be set to: relative durations + common clock times.
const SNOOZE_CHOICES = [
  { value: '15min', label: '15 דקות' },
  { value: '30min', label: '30 דקות' },
  { value: '1hour', label: 'שעה' },
  { value: '3hour', label: '3 שעות' },
  { value: '10:00', label: '10:00' },
  { value: '14:00', label: '14:00' },
  { value: '18:00', label: '18:00' },
  { value: '20:00', label: '20:00' },
];
import {
  SettingsPage,
  Section,
  Row,
  PickerSheet,
} from '../components/settings/SettingsPrimitives';

// Choices for "number of repeats".
const REPEAT_COUNTS = [1, 2, 3, 5, 10].map((n) => ({ value: n, label: String(n) }));

/**
 * Settings — Main settings screen (iOS grouped list).
 *
 * Sections (Ringtone intentionally omitted per spec):
 *   • Repeating notifications → number of repeats + repeat period
 *   • Snooze                  → list of snooze presets
 *   • Birthdays               → navigates to the birthday sub-settings screen
 *
 * All values are read from / written to the shared SettingsContext, which
 * persists them to LocalStorage.
 */
export default function Settings() {
  const navigate = useNavigate();
  const { settings, updateRepeat, setSnoozePresets } = useSettings();
  const [picker, setPicker] = useState(null);       // 'count' | 'period' | null
  const [snoozeIdx, setSnoozeIdx] = useState(null); // index of snooze slot being edited

  function changeSnoozeSlot(value) {
    const next = [...settings.snoozePresets];
    next[snoozeIdx] = value;
    setSnoozePresets(next);
  }

  return (
    <SettingsPage title="הגדרות" backTo="/more">
      {/* ── Repeating notifications ─────────────────────────────────────────── */}
      <Section caption="התראות חוזרות">
        <Row
          first
          label="מספר חזרות"
          value={settings.repeat.count}
          onClick={() => setPicker('count')}
        />
        <Row
          label="תדירות חזרה"
          value={repeatPeriodLabel(settings.repeat.period)}
          onClick={() => setPicker('period')}
        />
      </Section>

      {/* ── Snooze presets ──────────────────────────────────────────────────── */}
      <Section caption="דחייה">
        {settings.snoozePresets.map((preset, idx) => (
          <Row
            key={`${preset}-${idx}`}
            first={idx === 0}
            label={snoozePresetLabel(preset)}
            onClick={() => setSnoozeIdx(idx)}
          />
        ))}
      </Section>

      {/* ── Birthdays sub-settings ──────────────────────────────────────────── */}
      <Section>
        <Row
          first
          label="ימי הולדת"
          onClick={() => navigate('/settings/birthdays')}
        />
      </Section>

      {/* ── Pickers ─────────────────────────────────────────────────────────── */}
      <PickerSheet
        open={picker === 'count'}
        title="מספר חזרות"
        options={REPEAT_COUNTS}
        selected={settings.repeat.count}
        onSelect={(v) => updateRepeat({ count: Number(v) })}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        open={picker === 'period'}
        title="תדירות חזרה"
        options={REPEAT_PERIODS}
        selected={settings.repeat.period}
        onSelect={(v) => updateRepeat({ period: v })}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        open={snoozeIdx !== null}
        title="בחר זמן דחייה"
        options={SNOOZE_CHOICES}
        selected={snoozeIdx !== null ? settings.snoozePresets[snoozeIdx] : null}
        onSelect={changeSnoozeSlot}
        onClose={() => setSnoozeIdx(null)}
      />
    </SettingsPage>
  );
}
