const AppError = require('./AppError');

/**
 * In-memory sliding window rate limiter
 */
function createRateLimiter({ windowMs = 60 * 1000, max = 15, message = 'Too many requests, please try again later.' }) {
  const hits = new Map();

  // Periodic cleanup of stale IP records
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of hits.entries()) {
      if (record.resetAt <= now) {
        hits.delete(ip);
      }
    }
  }, 60 * 1000).unref?.();

  return (req, res, next) => {
    const ip =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown';
    const now = Date.now();

    let record = hits.get(ip);
    if (!record || record.resetAt <= now) {
      record = { count: 1, resetAt: now + windowMs };
      hits.set(ip, record);
      return next();
    }

    record.count += 1;
    if (record.count > max) {
      const waitSeconds = Math.ceil((record.resetAt - now) / 1000);
      return next(
        new AppError(
          `${message} Please wait ${waitSeconds}s.`,
          429,
          'RATE_LIMIT_EXCEEDED'
        )
      );
    }

    next();
  };
}

module.exports = { createRateLimiter };
