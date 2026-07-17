/**
 * asyncHandler — wraps async Express route handlers to eliminate try/catch boilerplate.
 * Any thrown error is forwarded to the next() error-handling middleware.
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => { ... }));
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
