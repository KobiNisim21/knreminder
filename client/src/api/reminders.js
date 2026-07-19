import axios from 'axios';

// ─── Axios instance ───────────────────────────────────────────────────────────
// Reads the backend URL from Vite's env system.
// In development: set VITE_API_URL in client/.env (e.g., http://localhost:5000)
// In production:  set VITE_API_URL in Vercel dashboard (e.g., https://your-railway-app.railway.app)
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// ─── Auth: attach the signed session token to every request ───────────────────
// AuthContext calls setAuthToken() on login/logout/refresh. We keep the token in
// a module-level variable (seeded from LocalStorage so the very first request
// after a page load is already authenticated, before React mounts) and send it
// as `Authorization: Bearer <token>`. The server's resolveUser middleware
// verifies the signature — the chatId lives inside the signed token, so it can't
// be forged.
let currentToken = null;
try {
  const raw = localStorage.getItem('knr.auth.v1');
  if (raw) currentToken = JSON.parse(raw)?.token ?? null;
} catch {
  /* ignore malformed/absent storage */
}

/** Set (or clear, with null) the session token attached to all requests. */
export function setAuthToken(token) {
  currentToken = token || null;
}

api.interceptors.request.use(
  (config) => {
    if (currentToken) {
      config.headers['Authorization'] = `Bearer ${currentToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// When the server rejects our token (expired / invalid), surface a signal the
// AuthContext can listen for to force a re-login instead of leaving the user
// staring at silent failures.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error?.response?.data?.code;
    if (error?.response?.status === 401 && (code === 'BAD_TOKEN' || code === 'NO_CHAT_ID')) {
      window.dispatchEvent(new CustomEvent('knr:auth-expired'));
    }
    return Promise.reject(error);
  }
);

// ─── Response interceptor (normalize errors) ─────────────────────────────────
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const serverMessage = error.response?.data?.message;
    const message = serverMessage || error.message || 'שגיאת רשת — נסה שנית';
    // Preserve the HTTP status and raw server message on the thrown Error so
    // callers can surface exact diagnostics (e.g. distinguish 503 vs 404 vs a
    // network failure) instead of a generic string.
    const err = new Error(message);
    err.status = error.response?.status ?? null; // null → no response (network/CORS)
    err.serverMessage = serverMessage ?? null;
    return Promise.reject(err);
  }
);

// ─── Reminders API ───────────────────────────────────────────────────────────

export const remindersApi = {
  /** Get all active + snoozed reminders */
  getAll: () => api.get('/reminders'),

  /** Get completed reminders (within 90-day retention) */
  getCompleted: () => api.get('/reminders/completed'),

  /** Get all birthday items, sorted by next upcoming occurrence */
  getBirthdays: () => api.get('/reminders/birthdays'),

  /** Get a single reminder by ID */
  getById: (id) => api.get(`/reminders/${id}`),

  /**
   * Create a new reminder
   * @param {{ text: string, reminderAt: string, isRecurring?: boolean, recurrence?: object }} data
   */
  create: (data) => api.post('/reminders', data),

  /**
   * Update reminder text or time
   * @param {string} id
   * @param {{ text?: string, reminderAt?: string, isRecurring?: boolean, recurrence?: object }} data
   */
  update: (id, data) => api.patch(`/reminders/${id}`, data),

  /** Mark reminder as completed (triggers 90-day TTL) */
  complete: (id) => api.patch(`/reminders/${id}/complete`),

  /**
   * Snooze a reminder by N minutes
   * @param {string} id
   * @param {number} minutes
   */
  snooze: (id, minutes) => api.patch(`/reminders/${id}/snooze`, { minutes }),

  /** Hard delete a reminder */
  delete: (id) => api.delete(`/reminders/${id}`),

  /** Full data dump for backup — returns { success, backup: {...} } */
  exportAll: () => api.get('/reminders/export'),

  /**
   * Bulk restore from a backup payload.
   * @param {{ items: Array }} payload
   */
  import: (payload) => api.post('/reminders/import', payload),
};

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  /**
   * Verify a Telegram Login Widget payload server-side.
   * @param {object} telegramUser - raw object from the Telegram widget, OR
   *   { id, first_name, dev: true } for the local-dev fallback path.
   * @returns {Promise<{ success, user, dev? }>}
   */
  loginWithTelegram: (telegramUser) => api.post('/auth/telegram', telegramUser),

  /**
   * Start a deep-link login session. Returns a one-time sessionId and the
   * t.me deep link the user opens in their Telegram app.
   * @returns {Promise<{ success, sessionId, deepLink, botUsername }>}
   */
  startDeepLink: () => api.post('/auth/deeplink/start'),

  /**
   * Poll a deep-link session's status.
   * @param {string} sessionId
   * @returns {Promise<{ success, status: 'pending'|'authenticated'|'expired', token?, user? }>}
   */
  getDeepLinkStatus: (sessionId) => api.get(`/auth/deeplink/status/${sessionId}`),
};

export default api;
