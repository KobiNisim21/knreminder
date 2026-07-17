import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Completed from './pages/Completed';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Dashboard />} />
        <Route path="/completed" element={<Completed />} />
        <Route path="/calendar"  element={<div className="p-8 text-center text-textSecondary pt-safe">לוח שנה — בקרוב (Phase 8)</div>} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
