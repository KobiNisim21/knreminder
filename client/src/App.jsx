import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';

/**
 * App — Root routing shell.
 * Pages will be added as phases progress:
 *   /           → Dashboard (active reminders)
 *   /calendar   → CalendarView (Phase 8)
 *   /completed  → CompletedList (Phase 5)
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        {/* Placeholder routes — components wired in upcoming phases */}
        <Route path="/calendar" element={<div className="p-8 text-center text-textSecondary">לוח שנה — בקרוב</div>} />
        <Route path="/completed" element={<div className="p-8 text-center text-textSecondary">הושלמו — בקרוב</div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
