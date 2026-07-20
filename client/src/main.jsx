import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { SettingsProvider } from './context/SettingsContext';
import { AuthProvider } from './context/AuthContext';
import './index.css';

// ─── React Query client ───────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,      // 30 seconds before re-fetching
      refetchOnWindowFocus: true,
      retry: 2,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

// ─── Service Worker registration ──────────────────────────────────────────────
// Register after the page loads so the SW never delays first paint.
// The sw.js lives in /public and is served from the root scope.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[SW] Registered — scope:', registration.scope);

        // Detect when a new SW version is waiting to activate
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // A new version is available — could show an "Update available" toast here
              console.log('[SW] New version available — will activate on next visit.');
            }
          });
        });
      })
      .catch((err) => console.error('[SW] Registration failed:', err));
  });
}
