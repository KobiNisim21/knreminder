import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useSettings,
  REPEAT_PERIODS,
  repeatPeriodLabel,
  snoozePresetLabel,
} from '../context/SettingsContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
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
  Toggle,
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
  const { settings, updateRepeat, updateNotifications, setSnoozePresets } = useSettings();
  const push = usePushNotifications();
  const [picker, setPicker] = useState(null);       // 'count' | 'period' | null
  const [snoozeIdx, setSnoozeIdx] = useState(null); // index of snooze slot being edited
  const [testStatus, setTestStatus] = useState(null);

  function changeSnoozeSlot(value) {
    const next = [...settings.snoozePresets];
    next[snoozeIdx] = value;
    setSnoozePresets(next);
  }

  async function togglePush(enabled) {
    setTestStatus(null);
    try {
      if (enabled) await push.enable();
      else await push.disable();
    } catch {
      // The hook exposes a localized error directly below the section.
    }
  }

  async function sendTest() {
    setTestStatus('שולח…');
    try {
      await push.sendTest();
      setTestStatus('נשלחה התראת בדיקה');
    } catch (error) {
      setTestStatus(error.message || 'שליחת הבדיקה נכשלה');
    }
  }

  return (
    <SettingsPage title="הגדרות" backTo="/more">
      {/* ── Web Push notifications ─────────────────────────────────────────── */}
      <Section
        caption="התראות פוש"
        footer={
          push.error
            ? <span role="alert" className="font-medium text-red-600">{push.error}</span>
            : (!push.supported && !push.loading
            ? 'הדפדפן הזה אינו תומך בפוש. ב-iPhone יש להתקין את האפליקציה במסך הבית.'
            : 'תזכורות נשלחות בדיוק במועד שנקבע. אפשר לבחור את כולן או חשובות בלבד. חגים נשלחים יום לפני וזמני שבת ביום שישי ב-10:00.')
        }
      >
        <Row first label="התראות במכשיר">
          <Toggle
            label="התראות במכשיר"
            checked={push.subscribed && settings.notifications.enabled}
            disabled={push.loading || (!push.supported && !push.loading)}
            onChange={togglePush}
          />
        </Row>
        <Row label="כל התזכורות">
          <Toggle label="כל התזכורות" checked={settings.notifications.allReminders}
            disabled={!push.subscribed}
            onChange={(value) => updateNotifications({ allReminders: value })} />
        </Row>
        <Row label="תזכורות חשובות בלבד">
          <Toggle label="תזכורות חשובות בלבד" checked={!settings.notifications.allReminders && settings.notifications.importantReminders}
            disabled={!push.subscribed || settings.notifications.allReminders}
            onChange={(value) => updateNotifications({ importantReminders: value })} />
        </Row>
        <Row label="ימי הולדת">
          <Toggle label="ימי הולדת" checked={settings.notifications.birthdays}
            disabled={!push.subscribed}
            onChange={(value) => updateNotifications({ birthdays: value })} />
        </Row>
        <Row label="חגים קרובים">
          <Toggle label="חגים קרובים" checked={settings.notifications.holidays}
            disabled={!push.subscribed}
            onChange={(value) => updateNotifications({ holidays: value })} />
        </Row>
        <Row label="כניסת ויציאת שבת">
          <Toggle label="כניסת ויציאת שבת" checked={settings.notifications.shabbat}
            disabled={!push.subscribed}
            onChange={(value) => updateNotifications({ shabbat: value })} />
        </Row>
        {push.subscribed && (
          <Row label="שלח התראת בדיקה" onClick={sendTest} value={testStatus} hideChevron />
        )}
      </Section>

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
