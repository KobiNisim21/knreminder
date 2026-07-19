import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Completed from './pages/Completed';
import CalendarView from './pages/CalendarView';
import Birthdays from './pages/Birthdays';
import MoreView from './pages/MoreView';
import Settings from './pages/Settings';
import BirthdaySettings from './pages/BirthdaySettings';
import BackupRestore from './pages/BackupRestore';
import Login from './pages/Login';
import InstallPrompt from './components/InstallPrompt';
import { useAuth } from './context/AuthContext';

function App() {
  const { isAuthenticated } = useAuth();

  // Auth gate: until the user has a stored, verified chatId, the only thing that
  // mounts is the Login screen. This keeps every data-fetching screen behind
  // authentication so no request ever fires without an identity.
  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Dashboard />} />
        <Route path="/birthdays" element={<Birthdays />} />
        <Route path="/calendar"  element={<CalendarView />} />
        <Route path="/more"      element={<MoreView />} />
        <Route path="/settings"           element={<Settings />} />
        <Route path="/settings/birthdays" element={<BirthdaySettings />} />
        <Route path="/backup"     element={<BackupRestore />} />
        <Route path="/completed" element={<Completed />} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>

      {/* iOS install banner — self-detecting, renders only in Safari when not in standalone */}
      <InstallPrompt />
    </BrowserRouter>
  );
}

export default App;
