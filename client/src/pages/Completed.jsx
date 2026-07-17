import CompletedList from '../components/CompletedList';
import BottomNav from '../components/BottomNav';
import { useState } from 'react';
import AddReminderModal from '../components/AddReminderModal';

/**
 * Completed — Page showing archived (completed) reminders.
 * Reminders auto-delete from MongoDB after 90 days via TTL index.
 */
export default function Completed() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <header className="bg-surface border-b border-divider px-4 sticky top-0 z-20 pt-safe">
        <div className="flex items-center justify-between h-14">
          <div className="w-8" /> {/* spacer */}
          <h1 className="text-lg font-semibold text-textPrimary">הושלמו</h1>
          <div className="w-8" /> {/* spacer */}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 scroll-container momentum-scroll scrollbar-hide">
        <CompletedList />
      </main>

      <AddReminderModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      <BottomNav onAddPress={() => setModalOpen(true)} />
    </div>
  );
}
