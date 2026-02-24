import type { NextFunction, Request, Response } from 'express';
import createHttpError, { isHttpError } from 'http-errors';

export const notFoundHandler = (_req: Request, _res: Response, next: NextFunction): void => {
  next(createHttpError(404, 'Route not found'));
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (typeof error === 'object' && error !== null) {
    const maybeMongoError = error as { code?: number; keyPattern?: Record<string, unknown> };
    if (maybeMongoError.code === 11000) {
      const duplicateFields = Object.keys(maybeMongoError.keyPattern ?? {}).join(', ') || 'resource';
      res.status(409).json({
        success: false,
        message: `Duplicate ${duplicateFields}`
      });
      return;
    }

    const maybeCastError = error as { name?: string };
    if (maybeCastError.name === 'CastError') {
      res.status(400).json({
        success: false,
        message: 'Invalid identifier'
      });
      return;
    }
  }

  const statusCode = isHttpError(error) ? error.statusCode : 500;
  const message = isHttpError(error) ? error.message : 'Internal server error';

  res.status(statusCode).json({
    success: false,
    message
  });
};
