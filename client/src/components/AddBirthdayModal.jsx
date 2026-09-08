import { useState, useEffect, useRef } from 'react';
import { useReminderMutations } from '../hooks/useReminderMutations';
import DateTimePicker from './DateTimePicker';

function defaultDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return date;
}

/**
 * AddBirthdayModal — Bottom-sheet for creating and editing yearly events.
 *
 * Birthdays and special events are stored as yearly-recurring reminders.
 * Birthday records can also include a birth year for age calculation.
 *
 * Props:
 *   isOpen   {boolean}
 *   onClose  {fn}
 *   item      {object|null} existing birthday/special event to edit
 */
export default function AddBirthdayModal({ isOpen, onClose, item = null }) {
  const { createMutation, updateMutation, deleteMutation } = useReminderMutations();
  const nameRef = useRef(null);

  const [eventType, setEventType] = useState(item?.type === 'special' ? 'special' : 'birthday');
  const [name, setName] = useState(item?.personName ?? '');
  const [birthYear, setBirthYear] = useState(item?.birthYear ? String(item.birthYear) : '');
  const [reminderAt, setReminderAt] = useState(
    () => item?.reminderAt ? new Date(item.reminderAt) : defaultDate()
  );
  const [error, setError] = useState('');

  const currentYear = new Date().getFullYear();
  const isEditing = Boolean(item);
  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  useEffect(() => {
    if (isOpen) {
      const focusTimer = setTimeout(() => nameRef.current?.focus(), 350);
      return () => clearTimeout(focusTimer);
    }
  }, [isOpen]);



  function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('נא להזין שם');
      nameRef.current?.focus();
      return;
    }

    let year = null;
    if (eventType === 'birthday' && birthYear.trim()) {
      year = Number(birthYear);
      if (!Number.isInteger(year) || year < 1900 || year > currentYear) {
        setError('שנת לידה לא תקינה');
        return;
      }
    }

    const data = {
      type: eventType,
      personName: name.trim(),
      text: eventType === 'birthday'
        ? `יום הולדת — ${name.trim()}`
        : name.trim(),
      birthYear: year,
      reminderAt: reminderAt.toISOString(),
      isRecurring: true,
      recurrence: { frequency: 'yearly' },
    };

    const options = {
      onSuccess: onClose,
      onError: (err) => setError(err?.message || 'שמירת האירוע נכשלה. נסה שוב.'),
    };
    if (isEditing) updateMutation.mutate({ id: item._id, data }, options);
    else createMutation.mutate(data, options);
  }

  function handleDelete() {
    if (!window.confirm(`למחוק את ${name}?`)) return;
    deleteMutation.mutate(item._id, {
      onSuccess: onClose,
      onError: (err) => setError(err?.message || 'מחיקת האירוע נכשלה. נסה שוב.'),
    });
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="drag-handle" />

        <form onSubmit={handleSubmit} className="overflow-y-auto momentum-scroll scrollbar-hide max-h-[85vh]">
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-divider">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="text-textSecondary text-[15px] font-medium active:opacity-60"
            >
              ביטול
            </button>
            <h2 className="text-[17px] font-semibold text-textPrimary">
              {isEditing
                ? (eventType === 'birthday' ? 'עריכת יום הולדת' : 'עריכת אירוע מיוחד')
                : (eventType === 'birthday' ? 'יום הולדת חדש' : 'אירוע מיוחד חדש')}
            </h2>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className={`text-[15px] font-semibold active:opacity-60
                          ${isPending || !name.trim()
                            ? 'text-textDisabled'
                            : 'text-primary'}`}
            >
              {isPending ? 'שומר…' : 'שמור'}
            </button>
          </div>

          <div className="px-5 pt-4">
            <div className="grid grid-cols-2 gap-2 rounded-ios bg-gray-100 p-1">
              {[
                { value: 'birthday', label: 'יום הולדת' },
                { value: 'special', label: 'אירוע מיוחד' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={isPending}
                  onClick={() => setEventType(option.value)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors
                    ${eventType === option.value
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-textSecondary'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Name ───────────────────────────────────────────────────────── */}
          <div className="px-5 pt-4">
            <label className="block text-xs text-textSecondary mb-1.5">
              {eventType === 'birthday' ? 'שם' : 'שם האירוע'}
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={eventType === 'birthday' ? 'למשל: אמא' : 'למשל: יום נישואין'}
              maxLength={120}
              className="w-full text-[17px] py-2 border-b border-divider
                         focus:border-primary outline-none bg-transparent
                         placeholder:text-textDisabled"
            />
          </div>

          {/* ── Birth year ─────────────────────────────────────────────────── */}
          {eventType === 'birthday' && (
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
          )}

          {/* ── Next occurrence date/time ──────────────────────────────────── */}
          <div className="px-5 pt-4">
            <label className="block text-xs text-textSecondary mb-1">מועד התזכורת הבא</label>
            <DateTimePicker value={reminderAt} onChange={setReminderAt} allowPast={isEditing} />
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
              disabled={isPending || !name.trim()}
              className={`w-full py-3.5 rounded-ios text-white font-semibold text-[15px]
                          transition-all duration-200
                          ${isPending || !name.trim()
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-primary active:bg-primary-dark active:scale-[0.98]'}`}
            >
              {isPending
                ? 'שומר…'
                : isEditing
                  ? 'שמור שינויים'
                  : eventType === 'birthday'
                    ? 'הוסף יום הולדת'
                    : 'הוסף אירוע מיוחד'}
            </button>
          </div>

          {isEditing && (
            <div className="px-5 pb-6">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="w-full py-3 rounded-ios border border-accent/30 bg-red-50
                           text-accent font-medium text-[15px] disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'מוחק…' : 'מחק אירוע'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
