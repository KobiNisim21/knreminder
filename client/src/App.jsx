import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Completed from './pages/Completed';
import CalendarView from './pages/CalendarView';
import Birthdays from './pages/Birthdays';
import MoreView from './pages/MoreView';
import InstallPrompt from './components/InstallPrompt';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Dashboard />} />
        <Route path="/birthdays" element={<Birthdays />} />
        <Route path="/calendar"  element={<CalendarView />} />
        <Route path="/more"      element={<MoreView />} />
        <Route path="/completed" element={<Completed />} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>

      {/* iOS install banner — self-detecting, renders only in Safari when not in standalone */}
      <InstallPrompt />
    </BrowserRouter>
  );
}

export default App;
