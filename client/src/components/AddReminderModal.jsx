import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { remindersApi } from '../api/reminders';
import DateTimePicker from './DateTimePicker';

const RECURRENCE_OPTIONS = [
  { value: null, label: 'אין חזרה' },
  { value: 'daily', label: 'כל יום' },
  { value: 'weekly', label: 'כל שבוע' },
  { value: 'monthly', label: 'כל חודש' },
  { value: 'yearly', label: 'כל שנה' },
];

/**
 * AddReminderModal — Bottom-sheet slide-up for creating a reminder.
 *
 * Sections (top to bottom):
 *   1. Drag handle
 *   2. Text input (autofocused, RTL)
 *   3. DateTimePicker (iOS drum scroll)
 *   4. Recurrence selector (chip row)
 *   5. Save button
 *
 * Props:
 *   isOpen         {boolean}
 *   onClose        {fn}
 *   initialDate    {Date|null}  — pre-filled date (e.g. from section quick-add)
 */
export default function AddReminderModal({ isOpen, onClose, initialDate }) {
  const queryClient = useQueryClient();
  const textRef = useRef(null);

  // ── Form state ─────────────────────────────────────────────────────────────
  const defaultDate = () => {
    const d = initialDate ? new Date(initialDate) : new Date();
    // Default to next full hour
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d;
  };

  const [text, setText] = useState('');
  const [reminderAt, setReminderAt] = useState(defaultDate);
  const [recurrence, setRecurrence] = useState(null);
  const [isImportant, setIsImportant] = useState(false);
  const [error, setError] = useState('');

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setText('');
      setReminderAt(defaultDate());
      setRecurrence(null);
      setIsImportant(false);
      setError('');
      // Autofocus text input after animation settles
      setTimeout(() => textRef.current?.focus(), 350);
    }
  }, [isOpen, initialDate]);

  // ── Mutation ───────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (payload) => remindersApi.create(payload),
    onSuccess: () => {
      // refetchQueries triggers an IMMEDIATE network fetch (not just "mark stale").
      // This is what makes the new reminder appear instantly without re-opening the app.
      queryClient.refetchQueries({ queryKey: ['reminders'], type: 'active' });
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  // ── Submit ─────────────────────────────────────────────────────────────────
  function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!text.trim()) {
      setError('נא להזין טקסט לתזכורת');
      textRef.current?.focus();
      return;
    }

    createMutation.mutate({
      text: text.trim(),
      reminderAt: reminderAt.toISOString(),
      isRecurring: recurrence !== null,
      recurrence: recurrence ? { frequency: recurrence } : null,
      isImportant,
    });
  }

  // ── Backdrop click closes modal ────────────────────────────────────────────
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="הוספת תזכורת חדשה"
    >
      <div className="bottom-sheet">

        {/* Drag handle */}
        <div className="drag-handle" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-divider">
          <button
            onClick={onClose}
            className="text-primary text-[15px] font-medium"
            disabled={createMutation.isPending}
          >
            ביטול
          </button>
          <h2 className="text-base font-semibold text-textPrimary">תזכורת חדשה</h2>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending || !text.trim()}
            className={`text-[15px] font-semibold transition-opacity
                        ${!text.trim() || createMutation.isPending
                          ? 'text-textDisabled'
                          : 'text-primary'}`}
          >
            {createMutation.isPending ? '…' : 'שמור'}
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto momentum-scroll max-h-[70vh]">

          {/* Error */}
          {error && (
            <div className="mx-5 mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-accent">
              {error}
            </div>
          )}

          {/* ── Text input ──────────────────────────────────────────────── */}
          <div className="px-5 pt-4 pb-2">
            <textarea
              ref={textRef}
              id="reminder-text-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="+ טקסט תזכורת"
              rows={2}
              maxLength={500}
              className="w-full resize-none text-[15px] text-textPrimary
                         placeholder:text-textDisabled
                         border-b-2 border-divider focus:border-primary
                         outline-none pb-1 bg-transparent
                         transition-colors duration-200"
              dir="rtl"
            />
          </div>

          {/* ── DateTimePicker ──────────────────────────────────────────── */}
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
              <p className="text-xs text-textSecondary text-right">
                תאריך ושעה
              </p>
            </div>
            <DateTimePicker value={reminderAt} onChange={setReminderAt} allowPast />
          </div>

          {/* ── Recurrence chips ────────────────────────────────────────── */}
          <div className="px-5 py-4">
            <p className="text-xs text-textSecondary mb-3">חזרה</p>
            <div className="flex flex-wrap gap-2 justify-end">
              {RECURRENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value ?? 'none'}
                  type="button"
                  onClick={() => setRecurrence(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium
                              border transition-all duration-150
                              ${recurrence === opt.value
                                ? 'bg-primary text-white border-primary'
                                : 'bg-white text-textSecondary border-divider'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Submit button (mobile-friendly large tap target) ─────────── */}
          <div className="px-5 pb-6">
            <button
              type="submit"
              disabled={createMutation.isPending || !text.trim()}
              className={`w-full py-3.5 rounded-ios text-white font-semibold text-[15px]
                          transition-all duration-200
                          ${createMutation.isPending || !text.trim()
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-primary active:bg-primary-dark active:scale-[0.98]'}`}
            >
              {createMutation.isPending
                ? 'שומר…'
                : `הוסף תזכורת${recurrence ? ` (${RECURRENCE_OPTIONS.find(o => o.value === recurrence)?.label})` : ''}`}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
