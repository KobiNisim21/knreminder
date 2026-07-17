/**
 * Global Express error handler.
 *
 * Catches all errors forwarded via next(err) — including:
 *   - Mongoose ValidationError  → 400
 *   - Mongoose CastError        → 400 (invalid ObjectId)
 *   - Generic errors            → 500
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'שגיאת שרת פנימית';

  // Mongoose ValidationError (field-level validation failures)
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const fields = Object.values(err.errors).map((e) => e.message);
    message = fields.join('; ');
  }

  // Mongoose CastError (e.g., invalid ObjectId passed as :id param)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    message = 'מזהה תזכורת אינו תקין';
  }

  // Mongoose duplicate key (unique index violation)
  if (err.code === 11000) {
    statusCode = 409;
    message = 'ערך כפול — הרשומה כבר קיימת';
  }

  // Log server errors (not client errors)
  if (statusCode >= 500) {
    console.error(`[Error Handler] ${statusCode} —`, err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Include stack trace only in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
