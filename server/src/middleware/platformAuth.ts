import type { NextFunction, Request, Response } from 'express';
import createHttpError from 'http-errors';

import { env } from '../config/env';
import { verifyPlatformToken } from '../services/tokenService';

export const requirePlatformAccess = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();

    try {
      const decoded = verifyPlatformToken(token);
      if (decoded.type !== 'platform' || decoded.role !== 'super_admin') {
        throw createHttpError(403, 'Invalid platform role');
      }

      req.platformUser = {
        sub: decoded.sub,
        role: decoded.role,
        email: decoded.email,
        type: decoded.type
      };
      next();
      return;
    } catch {
      throw createHttpError(401, 'Invalid platform token');
    }
  }

  if (!env.platformAdminKey) {
    throw createHttpError(500, 'PLATFORM_ADMIN_KEY is not configured');
  }

  const providedKey = req.header('x-platform-key');
  if (!providedKey || providedKey !== env.platformAdminKey) {
    throw createHttpError(403, 'Invalid platform credentials');
  }

  req.platformUser = {
    sub: 'platform-super-admin',
    role: 'super_admin',
    email: 'platform-key-auth',
    type: 'platform'
  };
  next();
};
