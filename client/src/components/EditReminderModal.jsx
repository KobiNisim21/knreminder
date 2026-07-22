import { useState, useEffect, useRef } from 'react';
import { useReminderMutations } from '../hooks/useReminderMutations';
import DateTimePicker from './DateTimePicker';

const RECURRENCE_OPTIONS = [
  { value: null,      label: 'אין חזרה' },
  { value: 'daily',   label: 'כל יום' },
  { value: 'weekly',  label: 'כל שבוע' },
  { value: 'monthly', label: 'כל חודש' },
  { value: 'yearly',  label: 'כל שנה' },
];

const SNOOZE_OPTIONS = [
  { minutes: 15,  label: "15 דק'" },
  { minutes: 30,  label: "30 דק'" },
  { minutes: 60,  label: 'שעה' },
  { minutes: 180, label: '3 שעות' },
  { minutes: 1440,label: 'יום שלם' },
];

/**
 * EditReminderModal — Pre-filled bottom-sheet for editing an existing reminder.
 *
 * Sections:
 *   1. Header (Cancel | title | Save)
 *   2. Text input (pre-filled)
 *   3. DateTimePicker (pre-filled)
 *   4. Recurrence chips (pre-selected)
 *   5. Snooze quick-actions row
 *   6. Danger zone: "מחק תזכורת" (delete)
 *
 * Props:
 *   reminder   {object|null}  — the reminder being edited (null = closed)
 *   onClose    {fn}
 */
export default function EditReminderModal({ reminder, onClose }) {
  const { updateMutation, deleteMutation, snoozeMutation, completeMutation } =
    useReminderMutations();

  const textRef = useRef(null);
  const isOpen = !!reminder;

  // ── Local form state (synced from reminder prop) ───────────────────────────
  const [text, setText] = useState('');
  const [reminderAt, setReminderAt] = useState(new Date());
  const [recurrence, setRecurrence] = useState(null);
  const [isImportant, setIsImportant] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  // Tracks whether the user actually changed the date/time. When false we omit
  // reminderAt from the PATCH so a text-only edit never touches the (possibly
  // past) original date — the server then skips its future-date validation.
  const [timeTouched, setTimeTouched] = useState(false);

  useEffect(() => {
    if (reminder) {
      setText(reminder.text ?? '');
      setReminderAt(new Date(reminder.reminderAt));
      setRecurrence(reminder.recurrence?.frequency ?? null);
      setIsImportant(reminder.isImportant ?? false);
      setError('');
      setShowDeleteConfirm(false);
      setTimeTouched(false);
      setResetKey(Date.now()); // force remount of DateTimePicker
      setTimeout(() => textRef.current?.focus(), 350);
    }
  }, [reminder]);

  if (!isOpen) return null;

  // ── Derived flags ──────────────────────────────────────────────────────────
  const isLoading =
    updateMutation.isPending ||
    deleteMutation.isPending ||
    snoozeMutation.isPending ||
    completeMutation.isPending;

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleSave() {
    setError('');
    if (!text.trim()) {
      setError('נא להזין טקסט לתזכורת');
      textRef.current?.focus();
      return;
    }

    const data = {
      text: text.trim(),
      isRecurring: recurrence !== null,
      recurrence: recurrence ? { frequency: recurrence } : null,
      isImportant,
    };
    // Only send reminderAt if the user actually adjusted the picker. Omitting it
    // preserves the original date (even if it's in the past) and lets the server
    // skip future-date validation — so text-only edits always save.
    if (timeTouched) {
      data.reminderAt = reminderAt.toISOString();
    }

    updateMutation.mutate(
      { id: reminder._id, data },
      {
        onSuccess: onClose,
        onError: (err) =>
          setError(err?.message || 'שמירת השינויים נכשלה. נסה שוב.'),
      }
    );
  }

  function handleSnooze(minutes) {
    snoozeMutation.mutate(
      { id: reminder._id, minutes },
      { onSuccess: onClose }
    );
  }

  function handleComplete() {
    completeMutation.mutate(reminder._id, { onSuccess: onClose });
  }

  function handleDelete() {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    deleteMutation.mutate(reminder._id, { onSuccess: onClose });
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="עריכת תזכורת"
    >
      <div className="bottom-sheet">
        <div className="drag-handle" />

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-divider">
          <button
            onClick={onClose}
            className="text-primary text-[15px] font-medium"
            disabled={isLoading}
          >
            ביטול
          </button>
          <h2 className="text-base font-semibold text-textPrimary">עריכת תזכורת</h2>
          <button
            onClick={handleSave}
            disabled={isLoading || !text.trim()}
            className={`text-[15px] font-semibold transition-opacity
                        ${isLoading || !text.trim() ? 'text-textDisabled' : 'text-primary'}`}
          >
            {updateMutation.isPending ? '…' : 'שמור'}
          </button>
        </div>

        {/* ── Scrollable form body ──────────────────────────────────────── */}
        <div className="overflow-y-auto momentum-scroll scrollbar-hide max-h-[78vh]">

          {/* Error */}
          {error && (
            <div className="mx-5 mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-accent">
              {error}
            </div>
          )}

          {/* Text */}
          <div className="px-5 pt-5 pb-2">
            <textarea
              ref={textRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full resize-none text-[15px] text-textPrimary
                         border-b-2 border-divider focus:border-primary
                         outline-none pb-1 bg-transparent transition-colors"
              dir="rtl"
            />
          </div>

          {/* DateTimePicker */}
          <div className="px-3 py-2 border-b border-divider">
            <div className="flex justify-between items-center px-2 mb-1">
              <button
                type="button"
                onClick={() => setIsImportant(!isImportant)}
                className={`flex items-center gap-1.5 text-sm font-medium transition-colors
                  ${isImportant ? 'text-amber-500' : 'text-textSecondary'}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={isImportant ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                חשוב
              </button>
              <p className="text-xs text-textSecondary text-right">תאריך ושעה</p>
            </div>
            <DateTimePicker
              key={resetKey}
              value={reminderAt}
              onChange={(d) => { setReminderAt(d); setTimeTouched(true); }}
              allowPast
            />
          </div>

          {/* Recurrence chips */}
          <div className="px-5 py-4 border-b border-divider">
            <p className="text-xs text-textSecondary mb-3">חזרה</p>
            <div className="flex flex-wrap gap-2 justify-end">
              {RECURRENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value ?? 'none'}
                  type="button"
                  onClick={() => setRecurrence(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all
                              ${recurrence === opt.value
                                ? 'bg-primary text-white border-primary'
                                : 'bg-white text-textSecondary border-divider'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Snooze quick-actions ─────────────────────────────────────── */}
          <div className="px-5 py-4 border-b border-divider">
            <p className="text-xs text-textSecondary mb-3">דחה תזכורת ב…</p>
            <div className="flex gap-2 flex-wrap justify-end">
              {SNOOZE_OPTIONS.map((opt) => (
                <button
                  key={opt.minutes}
                  type="button"
                  onClick={() => handleSnooze(opt.minutes)}
                  disabled={isLoading}
                  className="px-3 py-1.5 rounded-full text-sm border border-amber-300
                             bg-amber-50 text-amber-800 font-medium
                             active:scale-95 transition-all disabled:opacity-50"
                >
                  ⏰ {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Mark complete ─────────────────────────────────────────────── */}
          <div className="px-5 py-4 border-b border-divider">
            <button
              onClick={handleComplete}
              disabled={isLoading}
              className="w-full py-3 rounded-ios border-2 border-green-500
                         text-green-700 font-semibold text-[15px]
                         active:bg-green-50 transition-colors disabled:opacity-50"
            >
              {completeMutation.isPending ? '…' : '✅ סמן כבוצע'}
            </button>
          </div>

          {/* ── Danger zone — delete ─────────────────────────────────────── */}
          <div className="px-5 py-5">
            {!showDeleteConfirm ? (
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="w-full py-3 rounded-ios text-accent font-medium text-[15px]
                           border border-accent/30 bg-red-50
                           active:bg-red-100 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? '…' : 'מחק תזכורת'}
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 rounded-ios border border-divider text-textSecondary font-medium"
                >
                  ביטול
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-ios bg-accent text-white font-semibold
                             active:bg-accent-dark transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isPending ? '…' : 'מחק לצמיתות'}
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
