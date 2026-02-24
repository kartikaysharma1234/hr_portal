import type { NextFunction, Request, Response } from 'express';
import createHttpError from 'http-errors';

import { asyncHandler } from '../utils/asyncHandler';
import { verifyAccessToken } from '../services/tokenService';
import type { UserRole } from '../models/User';

export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createHttpError(401, 'Missing Bearer token');
  }

  const token = authHeader.replace('Bearer ', '').trim();
  let decoded: ReturnType<typeof verifyAccessToken>;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    throw createHttpError(401, 'Invalid access token');
  }

  if (req.tenant && decoded.organizationId !== req.tenant.organizationId) {
    throw createHttpError(403, 'Token tenant mismatch');
  }

  req.user = decoded;
  next();
});

export const requireRoles = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw createHttpError(401, 'Unauthorized');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw createHttpError(403, 'Insufficient permissions');
    }

    next();
  };
};
