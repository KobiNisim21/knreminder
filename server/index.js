require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const remindersRouter = require('./routes/reminders');
const telegramRouter  = require('./routes/telegram');
const authRouter      = require('./routes/auth');
const errorHandler    = require('./middleware/errorHandler');
const { startAgenda, stopAgenda } = require('./services/agendaService');
const { startPolling, stopPolling, deleteWebhook } = require('./services/telegramService');


// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 5000;

// Security headers
app.use(helmet());

// CORS — allow requests from the React client (dev + production)
const ALLOWED_ORIGINS = [
  'http://localhost:5173',          // Vite dev server
  'http://localhost:4173',          // Vite preview
  'https://knreminder.vercel.app',  // Vercel production
  process.env.CLIENT_URL,           // optional override from .env
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests (no Origin header) and known origins
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin "${origin}" not allowed`));
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-chat-id'],
    credentials: true,
  })
);

// Request logging (concise in production, dev-friendly locally)
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// JSON body parser (Telegram webhooks also send JSON).
// 5mb ceiling accommodates full backup/restore payloads.
app.use(express.json({ limit: '5mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────

// Auth is mounted WITHOUT the resolveUser guard — login is how you obtain an
// identity in the first place, so it must be reachable unauthenticated.
app.use('/api/auth', authRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/telegram', telegramRouter);

// Health check endpoint (used by Railway/Render for uptime monitoring)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV,
  });
});

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'הנתיב לא נמצא' });
});

// Global error handler (must be last)
app.use(errorHandler);

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function start() {
  try {
    // 1. Connect to MongoDB Atlas
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✅ MongoDB Atlas connected');

    // 2. Start Agenda.js (uses the same MongoDB connection)
    await startAgenda();
    console.log('✅ Agenda.js scheduler started');

    // 3. Start Express server
    app.listen(PORT, async () => {
      console.log(`🚀 KN Reminder server running on port ${PORT}`);
      console.log(`   Health:  http://localhost:${PORT}/api/health`);
      console.log(`   Bot:     http://localhost:${PORT}/api/telegram/status`);

      // 4. In development: start long-polling so Telegram button taps work locally
      //    (No public HTTPS / ngrok needed — getUpdates polling handles it)
      if (process.env.NODE_ENV !== 'production' && process.env.TELEGRAM_BOT_TOKEN) {
        try {
          await deleteWebhook();   // clear any registered webhook first
          startPolling();          // non-blocking — runs in background
          console.log('🤖 Telegram long-polling started (dev mode)');
        } catch (err) {
          console.warn('[Telegram] Could not start polling:', err.message);
        }
      }
    });

  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

start();

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(signal) {
  console.log(`\n[${signal}] Shutting down gracefully…`);
  try {
    stopPolling();                          // stop Telegram polling loop
    await stopAgenda();
    await mongoose.connection.close();
    console.log('✅ Connections closed. Goodbye.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err.message);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled promise rejections to prevent silent crashes
process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});
