import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

/**
 * Middleware to add a unique request correlation ID to each request
 * This ID is used for tracing requests through logs and debugging
 */
export function addCorrelationId(req: Request, res: Response, next: NextFunction) {
  // Generate or use existing correlation ID from header
  const correlationId = (req.headers["x-request-id"] as string) || randomUUID();

  // Attach to request object for use in controllers
  (req as any).requestId = correlationId;

  // Add to response header for client-side tracing
  res.setHeader("X-Request-ID", correlationId);

  next();
}
