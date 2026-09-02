import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { HTTPError } from './errors';

export const validateBody = (schema: z.Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new HTTPError(400, 'VALIDATION_ERROR', 'Invalid request body', error.errors));
      } else {
        next(new HTTPError(400, 'BAD_REQUEST', 'Unable to parse JSON body'));
      }
    }
  };
};

export const validateQuery = (schema: z.Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('Query dump:', JSON.stringify(req.query), Object.prototype.toString.call(req.query));
      // Fix Object.create(null) issue by spreading into a new object
      const safeQuery = { ...req.query };
      req.query = schema.parse(safeQuery) as any;
      next();
    } catch (error: any) {
      console.error('Validation error:', error);
      if (error && error.errors) {
        next(new HTTPError(400, 'VALIDATION_ERROR', 'Invalid query parameters', error.errors));
      } else {
        next(new HTTPError(400, 'BAD_REQUEST', 'Invalid query parameters'));
      }
    }
  };
};
