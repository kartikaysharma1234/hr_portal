import type { Request, Response } from 'express';
import createHttpError from 'http-errors';

import { env } from '../config/env';
import { generatePlatformToken } from '../services/tokenService';
import { asyncHandler } from '../utils/asyncHandler';

export const loginSuperAdmin = asyncHandler(async (req: Request, res: Response) => {
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '').trim();

  if (!email || !password) {
    throw createHttpError(400, 'email and password are required');
  }

  if (!env.superAdminEmail || !env.superAdminPassword) {
    throw createHttpError(500, 'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be configured');
  }

  if (email !== env.superAdminEmail.toLowerCase() || password !== env.superAdminPassword) {
    throw createHttpError(401, 'Invalid super admin credentials');
  }

  const token = generatePlatformToken({
    sub: 'platform-super-admin',
    role: 'super_admin',
    email,
    type: 'platform'
  });

  res.json({
    success: true,
    data: {
      user: {
        id: 'platform-super-admin',
        name: 'Super Admin',
        email,
        role: 'super_admin'
      },
      token
    }
  });
});
