import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { remindersApi } from '../api/reminders';
import DateTimePicker from './DateTimePicker';

/**
 * AddBirthdayModal — Bottom-sheet slide-up for adding a birthday.
 *
 * A birthday is stored as a yearly-recurring reminder with type:'birthday'.
 * The user provides:
 *   1. Person name (e.g. "אמא")
 *   2. Birth year   (to compute the upcoming age)
 *   3. The next occurrence date/time (reused DateTimePicker — covers next 365 days)
 *
 * Props:
 *   isOpen   {boolean}
 *   onClose  {fn}
 */
export default function AddBirthdayModal({ isOpen, onClose }) {
  const queryClient = useQueryClient();
  const nameRef = useRef(null);

  // Default the next occurrence to tomorrow at 10:00 (matches the reference feed)
  const defaultDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  };

  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [reminderAt, setReminderAt] = useState(defaultDate);
  const [error, setError] = useState('');

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (isOpen) {
      setName('');
      setBirthYear('');
      setReminderAt(defaultDate());
      setError('');
      setTimeout(() => nameRef.current?.focus(), 350);
    }
  }, [isOpen]);

  const createMutation = useMutation({
    mutationFn: (payload) => remindersApi.create(payload),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['reminders', 'birthdays'], type: 'active' });
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('נא להזין שם');
      nameRef.current?.focus();
      return;
    }

    let year = null;
    if (birthYear.trim()) {
      year = Number(birthYear);
      if (!Number.isInteger(year) || year < 1900 || year > currentYear) {
        setError('שנת לידה לא תקינה');
        return;
      }
    }

    createMutation.mutate({
      type: 'birthday',
      personName: name.trim(),
      text: `יום הולדת — ${name.trim()}`,
      birthYear: year,
      reminderAt: reminderAt.toISOString(),
    });
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="drag-handle" />

        <form onSubmit={handleSubmit}>
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-divider">
            <button
              type="button"
              onClick={onClose}
              className="text-textSecondary text-[15px] font-medium active:opacity-60"
            >
              ביטול
            </button>
            <h2 className="text-[17px] font-semibold text-textPrimary">יום הולדת חדש</h2>
            <button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
              className={`text-[15px] font-semibold active:opacity-60
                          ${createMutation.isPending || !name.trim()
                            ? 'text-textDisabled'
                            : 'text-primary'}`}
            >
              {createMutation.isPending ? 'שומר…' : 'שמור'}
            </button>
          </div>

          {/* ── Name ───────────────────────────────────────────────────────── */}
          <div className="px-5 pt-4">
            <label className="block text-xs text-textSecondary mb-1.5">שם</label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="למשל: אמא"
              maxLength={120}
              className="w-full text-[17px] py-2 border-b border-divider
                         focus:border-primary outline-none bg-transparent
                         placeholder:text-textDisabled"
            />
          </div>

          {/* ── Birth year ─────────────────────────────────────────────────── */}
          <div className="px-5 pt-4">
            <label className="block text-xs text-textSecondary mb-1.5">
              שנת לידה <span className="text-textDisabled">(לחישוב הגיל)</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder="למשל: 1969"
              min={1900}
              max={currentYear}
              className="w-full text-[17px] py-2 border-b border-divider
                         focus:border-primary outline-none bg-transparent
                         placeholder:text-textDisabled"
              dir="ltr"
            />
          </div>

          {/* ── Next occurrence date/time ──────────────────────────────────── */}
          <div className="px-5 pt-4">
            <label className="block text-xs text-textSecondary mb-1">מועד התזכורת הבא</label>
            <DateTimePicker value={reminderAt} onChange={setReminderAt} />
          </div>

          {/* ── Error ──────────────────────────────────────────────────────── */}
          {error && (
            <div className="px-5 pt-1">
              <p className="text-accent text-sm text-center">{error}</p>
            </div>
          )}

          {/* ── Submit ─────────────────────────────────────────────────────── */}
          <div className="px-5 py-6">
            <button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
              className={`w-full py-3.5 rounded-ios text-white font-semibold text-[15px]
                          transition-all duration-200
                          ${createMutation.isPending || !name.trim()
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-primary active:bg-primary-dark active:scale-[0.98]'}`}
            >
              {createMutation.isPending ? 'שומר…' : 'הוסף יום הולדת'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
