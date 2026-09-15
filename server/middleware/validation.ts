import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { HTTPError } from "./errors";
import { sanitizeText, sanitizeSearchQuery } from "../lib/sanitize";

export const validateBody = (schema: z.Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new HTTPError(400, "VALIDATION_ERROR", "Invalid request body", error.errors));
      } else {
        next(new HTTPError(400, "BAD_REQUEST", "Unable to parse JSON body"));
      }
    }
  };
};

export const validateQuery = (schema: z.Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Fix Object.create(null) issue by spreading into a new object
      const safeQuery = { ...req.query };
      const parsed = schema.parse(safeQuery) as any;

      // In Express 5, req.query has only a getter and cannot be reassigned directly with req.query = ...
      // Mutate req.query properties in-place instead.
      for (const key of Object.keys(req.query)) {
        delete (req.query as any)[key];
      }
      Object.assign(req.query, parsed);
      next();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        next(new HTTPError(400, "VALIDATION_ERROR", "Invalid query parameters", error.errors));
      } else {
        next(new HTTPError(400, "BAD_REQUEST", "Invalid query parameters"));
      }
    }
  };
};

/**
 * Sanitize string inputs in request body
 */
export const sanitizeBodyFields = (fields: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      for (const field of fields) {
        if (req.body[field] && typeof req.body[field] === "string") {
          req.body[field] = sanitizeText(req.body[field]);
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Sanitize search/query parameters
 */
export const sanitizeSearchParams = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize common search parameters
      const searchFields = ["q", "query", "search", "filter", "name", "email"];

      for (const field of searchFields) {
        if (req.query[field] && typeof req.query[field] === "string") {
          req.query[field] = sanitizeSearchQuery(req.query[field] as string);
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
