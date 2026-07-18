import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Completed from './pages/Completed';
import InstallPrompt from './components/InstallPrompt';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Dashboard />} />
        <Route path="/completed" element={<Completed />} />
        <Route path="/calendar"  element={<div className="p-8 text-center text-textSecondary pt-safe">לוח שנה — בקרוב (Phase 8)</div>} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>

      {/* iOS install banner — self-detecting, renders only in Safari when not in standalone */}
      <InstallPrompt />
    </BrowserRouter>
  );
}

export default App;
