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

// ─── Auth: attach the signed-in user's chatId to every request ────────────────
// AuthContext calls setAuthChatId() on login/logout/refresh. We keep the value
// in a module-level variable (seeded from LocalStorage so the very first request
// after a page load is already authenticated, before React mounts) and stamp it
// onto each outgoing request as `x-user-chat-id`. The server's resolveUser
// middleware reads this header to scope all data to the user.
let currentChatId = null;
try {
  const raw = localStorage.getItem('knr.auth.v1');
  if (raw) currentChatId = JSON.parse(raw)?.chatId ?? null;
} catch {
  /* ignore malformed/absent storage */
}

/** Set (or clear, with null) the chatId attached to all subsequent requests. */
export function setAuthChatId(chatId) {
  currentChatId = chatId ? String(chatId) : null;
}

api.interceptors.request.use(
  (config) => {
    if (currentChatId) {
      config.headers['x-user-chat-id'] = currentChatId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor (normalize errors) ─────────────────────────────────
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      'שגיאת רשת — נסה שנית';
    return Promise.reject(new Error(message));
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
};

export default api;
