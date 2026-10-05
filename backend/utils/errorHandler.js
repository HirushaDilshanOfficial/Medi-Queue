/**
 * Standard HTTP Error handler for Express.
 * Formats all errors into a consistent JSON shape: { success: false, message, code }.
 * Maps Mongoose validation and cast errors to HTTP 400.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode && res.statusCode !== 200
    ? res.statusCode
    : (err.statusCode || err.status || 500);

  // Mongoose validation error -> 400
  if (err.name === 'ValidationError') {
    statusCode = 400;
  }

  // Mongoose cast error (e.g. invalid ObjectId) -> 400, not 500
  if (err.name === 'CastError') {
    statusCode = 400;
  }

  // Mongoose strict mode error (unknown fields) -> 400
  if (err.name === 'StrictModeError') {
    statusCode = 400;
  }

  // MongoDB duplicate key error -> 409 (if still 500)
  if (err.code === 11000 && statusCode === 500) {
    statusCode = 409;
  }

  // Build clean message
  let message = err.message || 'An unexpected error occurred';
  if (err.name === 'CastError') {
    message = `Invalid ${err.path || 'identifier'}: ${err.value}`;
  } else if (err.name === 'ValidationError' && err.errors) {
    message = Object.values(err.errors).map((e) => e.message).join(', ') || err.message;
  }

  // Consistent code (explicit error code, or fallback to HTTP statusCode)
  const code = err.code !== undefined ? err.code : statusCode;

  const response = {
    success: false,
    message,
    code,
  };

  // Preserve conflict details when available
  if (err.requestedSlot !== undefined) {
    response.requestedSlot = err.requestedSlot;
  }
  if (err.nextAvailableSlot !== undefined) {
    response.nextAvailableSlot = err.nextAvailableSlot;
  }

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * Async handler wrapper to catch unhandled promise rejections
 * and pass them to the Express error handler middleware.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Helper to construct an Error with HTTP statusCode and optional code
 */
const createError = (message, statusCode = 400, code) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code !== undefined ? code : statusCode;
  return err;
};

module.exports = { errorHandler, asyncHandler, createError };

