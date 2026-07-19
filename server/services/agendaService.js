const Agenda = require('agenda');
const Reminder = require('../models/Reminder');
// NOTE: telegramService is required lazily inside the job handler to avoid
// the circular dependency (telegramService → agendaService → telegramService).
// Node.js handles this correctly when the require is deferred to call-time.


// ─── Agenda instance (singleton) ──────────────────────────────────────────────

let agenda;

function getAgenda() {
  if (!agenda) {
    agenda = new Agenda({
      db: {
        address: process.env.MONGO_URI,
        collection: 'agendaJobs', // separate collection inside same Atlas DB
      },
      processEvery: '30 seconds', // how often Agenda polls for due jobs
      maxConcurrency: 5,
    });
  }
  return agenda;
}

// ─── Job definitions ──────────────────────────────────────────────────────────

/**
 * 'send reminder' job
 *
 * Triggered at the scheduled time for every active reminder.
 * After sending:
 *   - Non-recurring → marks notified = true
 *   - Recurring     → advances reminderAt to the next occurrence and reschedules
 */
function defineJobs(ag) {
  ag.define('send reminder', { priority: 'high', concurrency: 1 }, async (job) => {
    const { reminderId } = job.attrs.data;

    // Lazy-load telegramService here (avoids circular require at module load time)
    const { sendReminderNotification } = require('./telegramService');

    const reminder = await Reminder.findById(reminderId);


    // Guard: reminder might have been deleted or already completed
    if (!reminder || reminder.status !== 'active') {
      console.log(`[Agenda] Skipping job — reminder ${reminderId} is no longer active.`);
      return;
    }

    // Send the Telegram notification
    try {
      await sendReminderNotification(reminder);
      console.log(`[Agenda] ✅ Notification sent for: "${reminder.text}"`);
    } catch (err) {
      console.error(`[Agenda] ❌ Telegram send failed for ${reminderId}:`, err.message);
      // Re-throw so Agenda marks the job as failed and can retry
      throw err;
    }

    if (reminder.isRecurring && reminder.recurrence) {
      // Advance to the next occurrence
      const nextDate = getNextOccurrence(reminder.reminderAt, reminder.recurrence.frequency);
      reminder.reminderAt = nextDate;
      reminder.notified = false; // reset for next cycle
      await reminder.save();

      // Schedule the next job for this recurrence
      await scheduleReminder(reminder);
      console.log(`[Agenda] 🔁 Rescheduled recurring reminder for: ${nextDate.toISOString()}`);
    } else {
      // One-time reminder — mark as notified
      reminder.notified = true;
      await reminder.save();
    }
  });
}

// ─── Public scheduling API ────────────────────────────────────────────────────

/**
 * Schedule (or reschedule) a reminder job in Agenda.
 * Cancels any existing job for this reminder before creating a new one.
 *
 * @param {Document} reminder - Mongoose Reminder document
 * @returns {Object} The Agenda job
 */
async function scheduleReminder(reminder) {
  const ag = getAgenda();

  // Cancel any previous job for this reminder (idempotent)
  const cancelledCount = await ag.cancel({ 'data.reminderId': reminder._id.toString() });
  if (cancelledCount > 0) {
    console.log(`[Agenda] Cancelled ${cancelledCount} existing job(s) for reminder ${reminder._id}`);
  }

  const job = await ag.schedule(reminder.reminderAt, 'send reminder', {
    reminderId: reminder._id.toString(),
  });

  // Persist the Agenda job ID on the reminder document for traceability
  await Reminder.findByIdAndUpdate(reminder._id, {
    agendaJobId: job.attrs._id.toString(),
  });

  console.log(
    `[Agenda] 📅 Scheduled job ${job.attrs._id} for "${reminder.text}" at ${reminder.reminderAt.toISOString()}`
  );

  return job;
}

/**
 * Cancel all Agenda jobs associated with a reminder (e.g., on delete or complete).
 *
 * @param {string} reminderId - The reminder's MongoDB _id as a string
 */
async function cancelReminderJob(reminderId) {
  const ag = getAgenda();
  const count = await ag.cancel({ 'data.reminderId': reminderId.toString() });
  console.log(`[Agenda] Cancelled ${count} job(s) for reminder ${reminderId}`);
}

// ─── Startup & shutdown ───────────────────────────────────────────────────────

/**
 * Connect Agenda to MongoDB and start the scheduler.
 * Call this once at application boot, after mongoose.connect() succeeds.
 */
async function startAgenda() {
  const ag = getAgenda();
  defineJobs(ag);
  await ag.start();

  ag.on('ready', () => console.log('[Agenda] ✅ Scheduler ready'));
  ag.on('error', (err) => console.error('[Agenda] ❌ Scheduler error:', err));

  return ag;
}

/**
 * Gracefully stop Agenda (drains running jobs before exiting).
 * Called on SIGTERM / SIGINT.
 */
async function stopAgenda() {
  if (agenda) {
    await agenda.stop();
    console.log('[Agenda] Stopped gracefully.');
  }
}

// ─── Date arithmetic ──────────────────────────────────────────────────────────

/**
 * Calculate the next occurrence datetime based on recurrence frequency.
 *
 * @param {Date} currentDate - The last fired date
 * @param {'daily'|'weekly'|'monthly'|'yearly'} frequency
 * @returns {Date}
 */
function getNextOccurrence(currentDate, frequency) {
  const next = new Date(currentDate);
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      throw new Error(`Unknown recurrence frequency: ${frequency}`);
  }
  return next;
}

module.exports = {
  startAgenda,
  stopAgenda,
  scheduleReminder,
  cancelReminderJob,
  getNextOccurrence,
};
