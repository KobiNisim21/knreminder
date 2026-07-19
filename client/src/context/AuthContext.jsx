import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setAuthChatId } from '../api/reminders';

/**
 * AuthContext — global authentication state for the multi-user app.
 *
 * Holds the signed-in user's Telegram identity ({ chatId, firstName, username,
 * photoUrl }) and persists it to LocalStorage so a refresh keeps you logged in.
 * The stored chatId is what the axios interceptor attaches to every API request
 * (via setAuthChatId), so the server can scope data to this user.
 *
 * Login is performed by the Login screen against POST /api/auth/telegram, which
 * HMAC-verifies the Telegram Login Widget payload server-side and returns the
 * trusted user object we store here.
 */

const STORAGE_KEY = 'knr.auth.v1';

const AuthContext = createContext(null);

function loadUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // A user is only valid if it carries a chatId.
    return parsed && parsed.chatId ? parsed : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(loadUser);

  // Keep the axios interceptor's chatId in sync with the current user, on mount
  // and on every change. This runs before children render their queries.
  useEffect(() => {
    setAuthChatId(user?.chatId ?? null);
  }, [user]);

  const login = useCallback(
    (userData) => {
      if (!userData || !userData.chatId) {
        throw new Error('login() requires a user object with a chatId');
      }
      const normalized = { ...userData, chatId: String(userData.chatId) };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      } catch {
        /* storage unavailable — session stays in-memory only */
      }
      setAuthChatId(normalized.chatId);
      // Clear any cache from a previous identity before the new user's queries run.
      queryClient.clear();
      setUser(normalized);
    },
    [queryClient]
  );

  const logout = useCallback(() => {
    // Purge persisted identity…
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    // …stop attaching the old chatId to requests…
    setAuthChatId(null);
    // …and blow away all cached query data so no stale rows from the previous
    // user can flash on screen for the next one.
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  const value = {
    user,
    chatId: user?.chatId ?? null,
    isAuthenticated: !!user?.chatId,
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
