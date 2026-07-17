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

// ─── Request interceptor (add auth headers later if needed) ──────────────────
api.interceptors.request.use(
  (config) => config,
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
};

export default api;
