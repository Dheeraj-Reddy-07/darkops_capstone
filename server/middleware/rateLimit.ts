import { Request, Response, NextFunction } from "express";
import { HTTPError } from "./errors";

interface RateLimitRecord {
  count: number;
  expiresAt: number;
}

const rateLimits = new Map<string, RateLimitRecord>();

/**
 * Enhanced rate limiting with user-specific limits and better cleanup
 */
export const rateLimit = (limit: number = 100, windowMs: number = 60000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req as any).requestId || "unknown";

    // Try to get user ID for user-specific rate limiting
    const userId = (req as any).auth?.user?.id;
    const ip = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
    const path = req.path;

    // Use user ID if available, otherwise fall back to IP
    const key = userId ? `${userId}:${path}` : `${ip}:${path}`;
    const now = Date.now();

    const record = rateLimits.get(key);

    if (!record || now > record.expiresAt) {
      rateLimits.set(key, { count: 1, expiresAt: now + windowMs });

      // Set rate limit headers
      res.setHeader("X-RateLimit-Limit", limit.toString());
      res.setHeader("X-RateLimit-Remaining", (limit - 1).toString());
      res.setHeader("X-RateLimit-Reset", new Date(now + windowMs).toISOString());

      return next();
    }

    if (record.count >= limit) {
      console.log(
        `[RATE_LIMIT_EXCEEDED] [${requestId}] Key: ${key}, Count: ${record.count}, Limit: ${limit}`,
      );
      res.setHeader("X-RateLimit-Limit", limit.toString());
      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader("X-RateLimit-Reset", new Date(record.expiresAt).toISOString());
      res.setHeader("Retry-After", Math.ceil((record.expiresAt - now) / 1000).toString());

      return next(
        new HTTPError(429, "RATE_LIMIT_EXCEEDED", "Too many requests. Please try again later."),
      );
    }

    record.count += 1;

    // Update rate limit headers
    res.setHeader("X-RateLimit-Limit", limit.toString());
    res.setHeader("X-RateLimit-Remaining", (limit - record.count).toString());
    res.setHeader("X-RateLimit-Reset", new Date(record.expiresAt).toISOString());

    next();
  };
};

/**
 * Cleanup expired rate limit records (call this periodically)
 */
export const cleanupExpiredRateLimits = () => {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, record] of rateLimits.entries()) {
    if (now > record.expiresAt) {
      rateLimits.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[RATE_LIMIT_CLEANUP] Cleaned ${cleaned} expired records`);
  }

  return cleaned;
};

/**
 * Get current rate limit statistics (for monitoring)
 */
export const getRateLimitStats = () => {
  return {
    totalRecords: rateLimits.size,
    activeRecords: Array.from(rateLimits.values()).filter((r) => r.expiresAt > Date.now()).length,
  };
};
