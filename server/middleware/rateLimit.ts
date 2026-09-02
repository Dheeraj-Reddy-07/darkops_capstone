import { Request, Response, NextFunction } from 'express';
import { HTTPError } from './errors';

const rateLimits = new Map<string, { count: number; expiresAt: number }>();

export const rateLimit = (limit: number = 100, windowMs: number = 60000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Basic IP tracking for the demo
    const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const path = req.path;
    
    const key = `${ip}:${path}`;
    const now = Date.now();

    const record = rateLimits.get(key);

    if (!record || now > record.expiresAt) {
      rateLimits.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }

    if (record.count >= limit) {
      return next(new HTTPError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again later.'));
    }

    record.count += 1;
    next();
  };
};
