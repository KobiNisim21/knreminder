const mongoose = require('mongoose');

// ─── Recurrence sub-schema ─────────────────────────────────────────────────────
const RecurrenceSchema = new mongoose.Schema(
  {
    // Frequency of recurrence
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
      required: true,
    },
    // Day-of-week for weekly (0=Sun … 6=Sat). Optional.
    dayOfWeek: { type: Number, min: 0, max: 6, default: null },
    // Day-of-month for monthly. Optional.
    dayOfMonth: { type: Number, min: 1, max: 31, default: null },
    // End date for the recurrence series. null = repeats forever.
    endDate: { type: Date, default: null },
  },
  { _id: false }
);

// ─── Main Reminder Schema ──────────────────────────────────────────────────────
const ReminderSchema = new mongoose.Schema(
  {
    // ── Core fields ──────────────────────────────────────────────────────────────
    text: {
      type: String,
      required: [true, 'נא להזין טקסט לתזכורת'],
      trim: true,
      maxlength: [500, 'הטקסט ארוך מדי (מקסימום 500 תווים)'],
    },

    // The exact UTC datetime at which the notification fires
    reminderAt: {
      type: Date,
      required: [true, 'נא לבחור תאריך ושעה'],
    },

    // ── Recurrence ───────────────────────────────────────────────────────────────
    isRecurring: { type: Boolean, default: false },
    recurrence: { type: RecurrenceSchema, default: null },

    // ── Status lifecycle: active → snoozed → completed ───────────────────────────
    status: {
      type: String,
      enum: ['active', 'snoozed', 'completed'],
      default: 'active',
    },
    completedAt: { type: Date, default: null },

    // ── Snooze tracking ──────────────────────────────────────────────────────────
    snoozeCount: { type: Number, default: 0 },
    // Preserved so the UI can show "originally scheduled for X"
    originalReminderAt: { type: Date, default: null },

    // ── Notification tracking ────────────────────────────────────────────────────
    // true once the Telegram message has been sent for this occurrence
    notified: { type: Boolean, default: false },

    // Agenda.js job ID — stored so we can cancel the job on delete/complete
    agendaJobId: { type: String, default: null },

    // ── TTL (90-day retention for completed reminders) ───────────────────────────
    // • While status = 'active'    → expiresAt = null  (TTL index ignores null)
    // • When marked 'completed'    → expiresAt = completedAt + 90 days
    // • MongoDB background task auto-deletes the document when Date.now() >= expiresAt
    expiresAt: { type: Date, default: null },
  },
  {
    timestamps: true, // adds createdAt + updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// TTL index: expireAfterSeconds: 0 means "delete at exactly expiresAt"
ReminderSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for scheduler query: active + not-yet-notified + due soon
ReminderSchema.index({ status: 1, notified: 1, reminderAt: 1 });

// Index for sorted dashboard listing
ReminderSchema.index({ status: 1, reminderAt: 1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────

// isOverdue: true if active and past due but not yet notified
ReminderSchema.virtual('isOverdue').get(function () {
  return this.status === 'active' && this.reminderAt < new Date();
});

// ─── Pre-save Hook ────────────────────────────────────────────────────────────

// Automatically set expiresAt when status changes to 'completed'
ReminderSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === 'completed') {
    if (!this.completedAt) {
      this.completedAt = new Date();
    }
    // 90 days from completion time
    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
    this.expiresAt = new Date(this.completedAt.getTime() + NINETY_DAYS_MS);
  }

  // Preserve original time on first snooze
  if (this.isModified('snoozeCount') && this.snoozeCount === 1) {
    this.originalReminderAt = this.reminderAt;
  }

  next();
});

module.exports = mongoose.model('Reminder', ReminderSchema);
