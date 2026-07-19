import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { remindersApi } from '../api/reminders';
import { SettingsPage, Section, Row } from '../components/settings/SettingsPrimitives';

/**
 * BackupRestore — export/import all reminders + birthdays.
 *
 * Backup:  GET /export → serialize → download `backup.knr` (JSON payload).
 * Restore: pick a `.knr` file → parse + validate → POST /import →
 *          invalidate the React Query cache so restored data appears instantly.
 */
export default function BackupRestore() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(null);   // 'backup' | 'restore' | null
  const [status, setStatus] = useState(null); // { type: 'ok'|'err', text }

  // ── Backup ─────────────────────────────────────────────────────────────────
  async function handleBackup() {
    setBusy('backup');
    setStatus(null);
    try {
      const res = await remindersApi.exportAll();
      const payload = res.backup ?? res;
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'backup.knr';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus({ type: 'ok', text: `נשמרו ${payload.count ?? payload.items?.length ?? 0} פריטים לקובץ backup.knr` });
    } catch (err) {
      setStatus({ type: 'err', text: err.message || 'הגיבוי נכשל' });
    } finally {
      setBusy(null);
    }
  }

  // ── Restore ──────────────────────────────────────────────────────────────────
  function triggerRestore() {
    fileInputRef.current?.click();
  }

  async function handleFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so the same file can be re-selected later
    if (!file) return;

    setBusy('restore');
    setStatus(null);
    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('הקובץ אינו קובץ גיבוי תקין (JSON פגום)');
      }

      // Accept both a raw backup object and { backup: {...} } wrappers.
      const items = parsed.items ?? parsed.backup?.items;
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('לא נמצאו פריטים לשחזור בקובץ');
      }

      const res = await remindersApi.import({ items });

      // Refresh every reminders query so restored data populates immediately.
      await queryClient.invalidateQueries({ queryKey: ['reminders'] });
      await queryClient.refetchQueries({ queryKey: ['reminders'], type: 'active' });

      setStatus({
        type: 'ok',
        text: res.message || `שוחזרו ${res.imported ?? items.length} פריטים`,
      });
    } catch (err) {
      setStatus({ type: 'err', text: err.message || 'השחזור נכשל' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <SettingsPage title="גיבוי ושחזור" backTo="/more">
      <Section footer="כל התזכורות וימי ההולדת יישמרו בקובץ 'backup.knr'.">
        <Row
          first
          label={busy === 'backup' ? 'מגבה…' : 'גיבוי'}
          danger
          hideChevron
          onClick={busy ? undefined : handleBackup}
        />
      </Section>

      <Section footer="התזכורות ישוחזרו מתוך קובץ 'backup.knr'.">
        <Row
          first
          label={busy === 'restore' ? 'משחזר…' : 'שחזור'}
          danger
          hideChevron
          onClick={busy ? undefined : triggerRestore}
        />
      </Section>

      {/* Hidden file picker for restore */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".knr,application/json"
        onChange={handleFileChosen}
        className="hidden"
      />

      {status && (
        <p
          className={`px-5 text-sm leading-relaxed ${
            status.type === 'ok' ? 'text-green-700' : 'text-accent'
          }`}
        >
          {status.text}
        </p>
      )}
    </SettingsPage>
  );
}
