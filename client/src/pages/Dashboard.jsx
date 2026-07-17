import { useState } from 'react';
import { useReminders } from '../hooks/useReminders';
import ReminderList from '../components/ReminderList';
import BottomNav from '../components/BottomNav';
import AddReminderModal from '../components/AddReminderModal';

/**
 * Dashboard — Main page: active reminders timeline.
 *
 * Manages:
 *   - fetching active reminders via useReminders()
 *   - AddReminderModal open/close state
 *   - initialDate passed to modal (from section quick-add "+")
 *   - pull-to-refresh (via refetch)
 */
export default function Dashboard() {
  const { data: reminders, isLoading, isError, error, refetch, isFetching } = useReminders();
  const [modalOpen, setModalOpen] = useState(false);
  const [initialModalDate, setInitialModalDate] = useState(null);

  function openModal(date = null) {
    setInitialModalDate(date);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setInitialModalDate(null);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── App Header ────────────────────────────────────────────────────── */}
      <header className="bg-surface border-b border-divider px-4 sticky top-0 z-20 pt-safe">
        <div className="flex items-center justify-between h-14">
          {/* Menu button (left in RTL = visually right) */}
          <div className="flex items-center gap-3">
            <button
              className="text-textSecondary p-1 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="תפריט"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
              </svg>
            </button>

            <button
              className="text-textSecondary p-1 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="אנשי קשר"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
            </button>

            <button
              className="text-textSecondary p-1 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="חיפוש"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>
          </div>

          {/* Title (right in RTL) */}
          <h1 className="text-lg font-semibold text-textPrimary">תזכורות</h1>
        </div>

        {/* Thin loading bar */}
        {isFetching && !isLoading && (
          <div className="h-0.5 bg-primary/20 -mx-4 relative overflow-hidden">
            <div className="absolute inset-y-0 bg-primary animate-pulse w-1/3 rounded-full" />
          </div>
        )}
      </header>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 scroll-container momentum-scroll scrollbar-hide">

        {/* Loading skeleton */}
        {isLoading && <LoadingSkeleton />}

        {/* Error state */}
        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <p className="font-medium text-textPrimary">שגיאה בטעינת התזכורות</p>
            <p className="text-sm text-textSecondary">{error?.message}</p>
            <button
              onClick={refetch}
              className="mt-1 px-5 py-2 bg-primary text-white rounded-ios text-sm font-medium active:scale-95 transition-transform"
            >
              נסה שנית
            </button>
          </div>
        )}

        {/* Reminders list */}
        {!isLoading && !isError && (
          <ReminderList
            reminders={reminders ?? []}
            onEdit={(reminder) => {
              // Phase 4: wire to EditReminderModal
              console.log('Edit:', reminder._id);
            }}
            onQuickAdd={(sectionKey) => {
              // Pre-fill date based on section
              const dateMap = {
                '__today__': new Date(),
                '__tomorrow__': (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })(),
              };
              openModal(dateMap[sectionKey] ?? null);
            }}
          />
        )}
      </main>

      {/* ── AddReminderModal ─────────────────────────────────────────────────── */}
      <AddReminderModal
        isOpen={modalOpen}
        onClose={closeModal}
        initialDate={initialModalDate}
      />

      {/* ── Bottom navigation + FAB ───────────────────────────────────────────── */}
      <BottomNav onAddPress={() => openModal()} />
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      {[0, 1].map((group) => (
        <div key={group}>
          {/* Section header skeleton */}
          <div className="h-9 bg-gray-100 border-y border-divider px-4 flex items-center">
            <div className="h-3 w-16 bg-gray-200 rounded" />
          </div>
          {/* Row skeletons */}
          {[...Array(group === 0 ? 3 : 2)].map((_, i) => (
            <div key={i} className="flex items-center px-4 py-4 border-b border-divider bg-white gap-4">
              <div className="w-16 h-8 bg-gray-100 rounded" />
              <div className="flex-1 h-4 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
