import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setAuthToken } from '../api/reminders';

/**
 * AuthContext — global authentication state for the multi-user app.
 *
 * Holds the signed-in user's identity plus a signed session token. The token —
 * not a raw chatId — is what the axios interceptor sends on every request (via
 * setAuthToken); the server verifies its signature, so identity can't be forged.
 *
 * Persisted shape in LocalStorage ({ token, chatId, firstName, username,
 * photoUrl }) survives refresh. Login calls POST /api/auth/telegram, which
 * HMAC-verifies the Telegram Login Widget payload and returns { token, user }.
 */

const STORAGE_KEY = 'knr.auth.v1';

const AuthContext = createContext(null);

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // A session is only valid if it carries both a token and a chatId.
    return parsed && parsed.token && parsed.chatId ? parsed : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState(loadStored);

  // Keep the axios interceptor's token in sync with the current session, on
  // mount and on every change, before children render their queries.
  useEffect(() => {
    setAuthToken(session?.token ?? null);
  }, [session]);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setAuthToken(null);
    // Blow away cached query data so no stale rows from the previous user can
    // flash on screen for the next one.
    queryClient.clear();
    setSession(null);
  }, [queryClient]);

  const login = useCallback(
    ({ token, user }) => {
      if (!token || !user || !user.chatId) {
        throw new Error('login() requires { token, user:{ chatId } }');
      }
      const stored = {
        token,
        chatId: String(user.chatId),
        firstName: user.firstName ?? null,
        username: user.username ?? null,
        photoUrl: user.photoUrl ?? null,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      } catch {
        /* storage unavailable — session stays in-memory only */
      }
      setAuthToken(token);
      // Clear any cache from a previous identity before the new user's queries run.
      queryClient.clear();
      setSession(stored);
    },
    [queryClient]
  );

  // If the server ever rejects our token (expired/invalid), the axios response
  // interceptor fires this event — drop the dead session so App shows Login.
  useEffect(() => {
    function onExpired() {
      logout();
    }
    window.addEventListener('knr:auth-expired', onExpired);
    return () => window.removeEventListener('knr:auth-expired', onExpired);
  }, [logout]);

  const value = {
    user: session,
    chatId: session?.chatId ?? null,
    isAuthenticated: !!session?.token,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
