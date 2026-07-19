import { useState } from 'react';
import {
  useSettings,
  BIRTHDAY_COLORS,
  IN_ADVANCE_OPTIONS,
  inAdvanceLabel,
} from '../context/SettingsContext';
import {
  SettingsPage,
  Section,
  Row,
  PickerSheet,
} from '../components/settings/SettingsPrimitives';

// Reminder-time choices (on the hour + common half-hours).
const TIME_CHOICES = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '14:00', '16:00', '18:00', '20:00',
].map((t) => ({ value: t, label: t }));

/**
 * BirthdaySettings — Sub-settings for birthday defaults.
 *
 *   • DEFAULT  → a row of selectable color dots for the birthday tag color
 *   • Reminder time → default notification delivery time
 *   • In advance    → how many days ahead to warn
 *
 * Reachable from Settings → "ימי הולדת". All values persist via SettingsContext.
 */
export default function BirthdaySettings() {
  const { settings, updateBirthdays } = useSettings();
  const [picker, setPicker] = useState(null); // 'time' | 'advance' | null
  const b = settings.birthdays;

  return (
    <SettingsPage title="ימי הולדת" backTo="/settings">
      {/* ── Default color ───────────────────────────────────────────────────── */}
      <Section caption="ברירת מחדל">
        <div className="flex items-center gap-4 px-5 py-4">
          {BIRTHDAY_COLORS.map((c) => {
            const isSel = b.color === c.key;
            return (
              <button
                key={c.key}
                onClick={() => updateBirthdays({ color: c.key })}
                aria-label={`צבע ${c.key}`}
                aria-pressed={isSel}
                className="relative w-9 h-9 rounded-full flex items-center justify-center
                           active:scale-90 transition-transform"
                style={{
                  backgroundColor: c.hex,
                  border: c.border ? '1.5px solid #D1D1D6' : 'none',
                }}
              >
                {isSel && (
                  <svg
                    width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke={c.key === 'white' ? '#0A84FF' : '#FFFFFF'}
                    strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Reminder time + in-advance ──────────────────────────────────────── */}
      <Section>
        <Row
          first
          label="שעת תזכורת"
          value={b.reminderTime}
          onClick={() => setPicker('time')}
        />
        <Row
          label="התראה מוקדמת"
          value={inAdvanceLabel(b.inAdvance)}
          onClick={() => setPicker('advance')}
        />
      </Section>

      {/* ── Pickers ─────────────────────────────────────────────────────────── */}
      <PickerSheet
        open={picker === 'time'}
        title="שעת תזכורת"
        options={TIME_CHOICES}
        selected={b.reminderTime}
        onSelect={(v) => updateBirthdays({ reminderTime: v })}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        open={picker === 'advance'}
        title="התראה מוקדמת"
        options={IN_ADVANCE_OPTIONS}
        selected={b.inAdvance}
        onSelect={(v) => updateBirthdays({ inAdvance: v })}
        onClose={() => setPicker(null)}
      />
    </SettingsPage>
  );
}
