import { useState, useMemo } from 'react';
import { useCalendarData, toDateKey } from '../hooks/useCalendarData';
import { useReminderMutations } from '../hooks/useReminderMutations';
import MonthGrid from '../components/MonthGrid';
import ReminderItem from '../components/ReminderItem';
import BottomNav from '../components/BottomNav';
import AddReminderModal from '../components/AddReminderModal';
import EditReminderModal from '../components/EditReminderModal';
import ActionBar from '../components/ActionBar';

// Full Hebrew day names (Sunday=0 … Saturday=6)
const DAY_NAMES_FULL = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const MONTH_NAMES    = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

/**
 * CalendarView — Monthly calendar page.
 *
 * Layout (top to bottom):
 *   1. Sticky header: "לוח שנה"
 *   2. MonthGrid (sticky below header)
 *   3. Day panel: list of reminders for the selected day
 *   4. BottomNav + FAB
 *
 * Behaviour:
 *   • Defaults to today's month, today selected
 *   • Navigating months preserves selected day if it exists in the new month
 *   • Tapping a day with reminders scrolls to the list
 *   • Tapping a day with no reminders shows an empty state with a quick-add hint
 */
export default function CalendarView() {
  const today = new Date();

  const [year, setYear]               = useState(today.getFullYear());
  const [month, setMonth]             = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalDate, setAddModalDate] = useState(null);
  const [editingReminder, setEditingReminder] = useState(null);
  const [selectedReminder, setSelectedReminder] = useState(null);

  const { remindersByDate, isLoading, isError, error, refetch } = useCalendarData();
  const { completeMutation, snoozeMutation, deleteMutation } = useReminderMutations();

  function toggleSelect(reminder) {
    setSelectedReminder((prev) => (prev?._id === reminder._id ? null : reminder));
  }

  // Reminders for the currently selected day
  const selectedKey       = selectedDate ? toDateKey(selectedDate) : null;
  const selectedReminders = useMemo(
    () => (selectedKey ? (remindersByDate[selectedKey] ?? []) : []),
    [selectedKey, remindersByDate]
  );

  // Count of reminders in the visible month (for the month summary chip)
  const monthReminderCount = useMemo(() => {
    let count = 0;
    for (const key of Object.keys(remindersByDate)) {
      const [y, m] = key.split('-').map(Number);
      if (y === year && m === month + 1) count += remindersByDate[key].length;
    }
    return count;
  }, [remindersByDate, year, month]);

  function handleMonthChange(newYear, newMonth) {
    setYear(newYear);
    setMonth(newMonth);
    // Keep selected date if it's in the new month; else jump to 1st
    if (
      selectedDate &&
      (selectedDate.getFullYear() !== newYear || selectedDate.getMonth() !== newMonth)
    ) {
      setSelectedDate(new Date(newYear, newMonth, 1));
    }
  }

  function handleDaySelect(date) {
    setSelectedDate(date);
  }

  function openAddForDay(date) {
    const d = new Date(date);
    d.setHours(9, 0, 0, 0); // default to 09:00
    setAddModalDate(d);
    setAddModalOpen(true);
  }

  // Format selected day label
  const selectedDayLabel = selectedDate
    ? `יום ${DAY_NAMES_FULL[selectedDate.getDay()]}, ${selectedDate.getDate()} ב${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
    : '';

  const isSelectedToday = selectedKey === toDateKey(today);

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <header className="bg-surface border-b border-divider px-4 sticky top-0 z-20 pt-safe">
        <div className="flex items-center justify-between h-14">
          <div className="w-8" />
          <h1 className="text-lg font-semibold text-textPrimary">לוח שנה</h1>
          {/* Month summary chip */}
          {monthReminderCount > 0 && (
            <div className="bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
              {monthReminderCount} תזכורות
            </div>
          )}
          {monthReminderCount === 0 && <div className="w-8" />}
        </div>
      </header>

      {/* ── Sticky MonthGrid ─────────────────────────────────────────────────── */}
      <div className="sticky top-14 z-10">
        {isLoading && (
          <div className="h-1 bg-primary/20 relative overflow-hidden">
            <div className="absolute inset-y-0 bg-primary animate-pulse w-1/2 rounded-full" />
          </div>
        )}
        <MonthGrid
          year={year}
          month={month}
          selectedDate={selectedDate}
          remindersByDate={remindersByDate}
          onMonthChange={handleMonthChange}
          onDaySelect={handleDaySelect}
        />
      </div>

      {/* ── Day panel (scrollable) ───────────────────────────────────────────── */}
      <main className="flex-1 scroll-container momentum-scroll scrollbar-hide">

        {/* Selected day header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-divider">
          <button
            onClick={() => openAddForDay(selectedDate ?? today)}
            className="text-primary text-xl font-light w-8 h-8
                       flex items-center justify-center rounded-full
                       hover:bg-primary/10 active:bg-primary/20 transition-colors"
            aria-label="הוסף תזכורת ליום זה"
          >
            +
          </button>
          <div className="text-right">
            <p className={`text-[15px] font-semibold
                           ${isSelectedToday ? 'text-primary' : 'text-textPrimary'}`}>
              {isSelectedToday ? 'היום' : selectedDayLabel}
            </p>
            {!isSelectedToday && (
              <p className="text-xs text-textSecondary">{selectedDayLabel}</p>
            )}
          </div>
        </div>

        {/* Error state */}
        {isError && (
          <div className="flex flex-col items-center py-12 gap-3 text-center px-6">
            <p className="text-accent font-medium">שגיאה בטעינת התזכורות</p>
            <p className="text-sm text-textSecondary">{error?.message}</p>
            <button onClick={refetch} className="text-primary text-sm underline">
              נסה שנית
            </button>
          </div>
        )}

        {/* Reminder list for selected day */}
        {!isError && selectedReminders.length > 0 && (
          <div className="animate-fade-in">
            {selectedReminders
              .slice()
              .sort((a, b) => new Date(a.reminderAt) - new Date(b.reminderAt))
              .map((reminder) => (
                <ReminderItem
                  key={reminder._id}
                  reminder={reminder}
                  isSelected={selectedReminder?._id === reminder._id}
                  onSelect={toggleSelect}
                />
              ))}
          </div>
        )}

        {/* Empty state for selected day */}
        {!isError && selectedReminders.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                stroke="#BDBDBD" strokeWidth="1.5" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <p className="text-[15px] font-medium text-textPrimary">אין תזכורות ביום זה</p>
              <p className="text-sm text-textSecondary mt-1">
                לחץ על <span className="text-primary font-bold">+</span> כדי להוסיף תזכורת
              </p>
            </div>
            <button
              onClick={() => openAddForDay(selectedDate ?? today)}
              className="mt-2 px-6 py-2.5 bg-primary text-white rounded-ios
                         text-sm font-medium active:scale-95 transition-transform"
            >
              הוסף תזכורת ליום זה
            </button>
          </div>
        )}
      </main>

      {/* ── Contextual action bar ────────────────────────────────────────────── */}
      <ActionBar
        reminder={selectedReminder}
        onClose={() => setSelectedReminder(null)}
        onEdit={(reminder) => setEditingReminder(reminder)}
        onComplete={(id) => completeMutation.mutate(id)}
        onSnooze={(id, minutes) => snoozeMutation.mutate({ id, minutes })}
        onRemove={(id) => deleteMutation.mutate(id)}
      />

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      <AddReminderModal
        isOpen={addModalOpen}
        onClose={() => { setAddModalOpen(false); setAddModalDate(null); }}
        initialDate={addModalDate}
      />
      <EditReminderModal
        reminder={editingReminder}
        onClose={() => setEditingReminder(null)}
      />

      {/* ── Bottom navigation ────────────────────────────────────────────────── */}
      <BottomNav
        onAddPress={() => openAddForDay(selectedDate ?? today)}
        anyModalOpen={addModalOpen || !!editingReminder || !!selectedReminder}
      />

    </div>
  );
}
