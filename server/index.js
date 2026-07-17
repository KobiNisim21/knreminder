require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const remindersRouter = require('./routes/reminders');
const telegramRouter = require('./routes/telegram');
const errorHandler = require('./middleware/errorHandler');
const { startAgenda, stopAgenda } = require('./services/agendaService');

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 5000;

// Security headers
app.use(helmet());

// CORS — allow requests from the React client
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Request logging (concise in production, dev-friendly locally)
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// JSON body parser (Telegram webhooks also send JSON)
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────

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
    app.listen(PORT, () => {
      console.log(`🚀 KN Reminder server running on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/api/health`);
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
