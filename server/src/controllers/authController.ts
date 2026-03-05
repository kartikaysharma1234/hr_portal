import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import createHttpError from 'http-errors';

import { env } from '../config/env';
import { RefreshTokenModel } from '../models/RefreshToken';
import { UserModel } from '../models/User';
import { consumeAuthActionToken, createAuthActionToken, invalidatePreviousActionTokens } from '../services/authActionTokenService';
import { sendEmailVerification, sendPasswordResetEmail } from '../services/emailService';
import { verifyGoogleIdToken } from '../services/googleAuthService';
import {
  findValidRefreshToken,
  persistRefreshToken,
  revokeRefreshToken
} from '../services/refreshTokenService';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} from '../services/tokenService';
import type { AuthTokenPayload } from '../types/tenant';
import { asyncHandler } from '../utils/asyncHandler';

const buildAuthPayload = (params: {
  userId: string;
  organizationId: string;
  role: 'super_admin' | 'admin' | 'hr' | 'manager' | 'employee';
  email: string;
}): AuthTokenPayload => {
  return {
    sub: params.userId,
    organizationId: params.organizationId,
    role: params.role,
    email: params.email
  };
};

const resolveClientMeta = (req: Request): { ipAddress: string | null; userAgent: string | null } => {
  const forwardedFor = req.header('x-forwarded-for');
  const ipAddress = forwardedFor ? forwardedFor.split(',')[0]?.trim() || null : req.ip || null;

  return {
    ipAddress,
    userAgent: req.header('user-agent') ?? null
  };
};

const resolveFrontendOrigin = (req: Request): string => {
  const origin = req.header('origin')?.trim();
  if (origin) {
    return origin.replace(/\/$/, '');
  }

  return env.clientAppUrl.replace(/\/$/, '');
};

const mapUserForResponse = (user: {
  _id: unknown;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'hr' | 'manager' | 'employee';
  emailVerified: boolean;
}) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified
  };
};

const issueAuthTokens = async (params: {
  userId: string;
  organizationId: string;
  role: 'super_admin' | 'admin' | 'hr' | 'manager' | 'employee';
  email: string;
  req: Request;
}): Promise<{ accessToken: string; refreshToken: string }> => {
  const tokenPayload = buildAuthPayload({
    userId: params.userId,
    organizationId: params.organizationId,
    role: params.role,
    email: params.email
  });

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  const decodedRefreshToken = verifyRefreshToken(refreshToken);
  await persistRefreshToken({
    refreshToken,
    organizationId: params.organizationId,
    userId: params.userId,
    jwtPayload: decodedRefreshToken,
    meta: resolveClientMeta(params.req)
  });

  return {
    accessToken,
    refreshToken
  };
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  if (!req.tenant) {
    throw createHttpError(400, 'Tenant context is required');
  }

  const name = String(req.body.name ?? '').trim();
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '').trim();

  if (!name || !email || !password) {
    throw createHttpError(400, 'name, email and password are required');
  }

  if (password.length < 8) {
    throw createHttpError(400, 'Password must be at least 8 characters');
  }

  const existingUser = await UserModel.findOne({
    organization: req.tenant.organizationId,
    email
  }).lean();

  if (existingUser) {
    throw createHttpError(409, 'User already exists in this tenant');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await UserModel.create({
    organization: req.tenant.organizationId,
    name,
    email,
    passwordHash,
    role: 'employee',
    authProvider: 'local',
    emailVerified: false
  });

  await invalidatePreviousActionTokens({
    organizationId: req.tenant.organizationId,
    userId: user._id.toString(),
    purpose: 'email_verify'
  });

  const rawToken = await createAuthActionToken({
    organizationId: req.tenant.organizationId,
    userId: user._id.toString(),
    email: user.email,
    purpose: 'email_verify',
    expiresAt: new Date(Date.now() + env.emailVerifyExpiresMinutes * 60 * 1000)
  });

  const verificationUrl = `${resolveFrontendOrigin(req)}/verify-email?token=${rawToken}`;
  await sendEmailVerification({
    to: user.email,
    name: user.name,
    verificationUrl,
    organizationName: req.tenant.organizationName
  });

  res.status(201).json({
    success: true,
    message: 'Registration successful. Please verify your email before login.',
    data: {
      user: mapUserForResponse(user)
    }
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  if (!req.tenant) {
    throw createHttpError(400, 'Tenant context is required');
  }

  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '').trim();

  if (!email || !password) {
    throw createHttpError(400, 'email and password are required');
  }

  const user = await UserModel.findOne({
    organization: req.tenant.organizationId,
    email,
    isActive: true
  })
    .select('+passwordHash')
    .exec();

  if (!user || !user.passwordHash) {
    throw createHttpError(401, 'Invalid credentials');
  }

  if (!user.emailVerified) {
    throw createHttpError(403, 'Please verify your email before login');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw createHttpError(401, 'Invalid credentials');
  }

  const tokens = await issueAuthTokens({
    userId: user._id.toString(),
    organizationId: req.tenant.organizationId,
    role: user.role,
    email: user.email,
    req
  });

  res.json({
    success: true,
    data: {
      user: mapUserForResponse(user),
      tenant: req.tenant,
      tokens
    }
  });
});

export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
  if (!req.tenant) {
    throw createHttpError(400, 'Tenant context is required');
  }

  const idToken = String(req.body.idToken ?? '').trim();
  if (!idToken) {
    throw createHttpError(400, 'idToken is required');
  }

  const googleProfile = await verifyGoogleIdToken(idToken);
  if (!googleProfile.emailVerified) {
    throw createHttpError(403, 'Google email is not verified');
  }

  let user = await UserModel.findOne({
    organization: req.tenant.organizationId,
    email: googleProfile.email,
    isActive: true
  }).exec();

  if (!user) {
    user = await UserModel.create({
      organization: req.tenant.organizationId,
      name: googleProfile.name,
      email: googleProfile.email,
      role: 'employee',
      authProvider: 'google',
      googleId: googleProfile.googleId,
      emailVerified: true
    });
  } else {
    if (user.googleId && user.googleId !== googleProfile.googleId) {
      throw createHttpError(409, 'This email is linked with another Google account');
    }

    user.googleId = googleProfile.googleId;
    user.emailVerified = true;
    await user.save();
  }

  const tokens = await issueAuthTokens({
    userId: user._id.toString(),
    organizationId: req.tenant.organizationId,
    role: user.role,
    email: user.email,
    req
  });

  res.json({
    success: true,
    data: {
      user: mapUserForResponse(user),
      tenant: req.tenant,
      tokens
    }
  });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.tenant) {
    throw createHttpError(400, 'Tenant context is required');
  }

  const email = String(req.body.email ?? '').trim().toLowerCase();
  if (!email) {
    throw createHttpError(400, 'email is required');
  }

  const user = await UserModel.findOne({
    organization: req.tenant.organizationId,
    email,
    isActive: true
  }).lean();

  if (user) {
    await invalidatePreviousActionTokens({
      organizationId: req.tenant.organizationId,
      userId: user._id.toString(),
      purpose: 'password_reset'
    });

    const rawToken = await createAuthActionToken({
      organizationId: req.tenant.organizationId,
      userId: user._id.toString(),
      email: user.email,
      purpose: 'password_reset',
      expiresAt: new Date(Date.now() + env.passwordResetExpiresMinutes * 60 * 1000)
    });

    const resetUrl = `${resolveFrontendOrigin(req)}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      organizationName: req.tenant.organizationName
    });
  }

  res.json({
    success: true,
    message: 'If the email exists, a reset link has been sent.'
  });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.body.token ?? '').trim();
  const newPassword = String(req.body.newPassword ?? '').trim();

  if (!token || !newPassword) {
    throw createHttpError(400, 'token and newPassword are required');
  }

  if (newPassword.length < 8) {
    throw createHttpError(400, 'Password must be at least 8 characters');
  }

  const actionToken = await consumeAuthActionToken({
    rawToken: token,
    purpose: 'password_reset'
  });

  const user = await UserModel.findOne({
    _id: actionToken.user,
    organization: actionToken.organization,
    isActive: true
  }).exec();

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.authProvider = user.authProvider ?? 'local';
  user.emailVerified = true;
  await user.save();

  await RefreshTokenModel.updateMany(
    {
      organization: user.organization,
      user: user._id,
      revokedAt: null
    },
    {
      $set: {
        revokedAt: new Date()
      }
    }
  ).exec();

  res.json({
    success: true,
    message: 'Password has been reset successfully. Please login again.'
  });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.body.token ?? req.query.token ?? '').trim();
  if (!token) {
    throw createHttpError(400, 'token is required');
  }

  const actionToken = await consumeAuthActionToken({
    rawToken: token,
    purpose: 'email_verify'
  });

  const user = await UserModel.findOne({
    _id: actionToken.user,
    organization: actionToken.organization,
    isActive: true
  }).exec();

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  user.emailVerified = true;
  await user.save();

  res.json({
    success: true,
    message: 'Email verified successfully. You can login now.'
  });
});

export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  if (!req.tenant) {
    throw createHttpError(400, 'Tenant context is required');
  }

  const email = String(req.body.email ?? '').trim().toLowerCase();
  if (!email) {
    throw createHttpError(400, 'email is required');
  }

  const user = await UserModel.findOne({
    organization: req.tenant.organizationId,
    email,
    isActive: true
  }).lean();

  if (user && !user.emailVerified) {
    await invalidatePreviousActionTokens({
      organizationId: req.tenant.organizationId,
      userId: user._id.toString(),
      purpose: 'email_verify'
    });

    const rawToken = await createAuthActionToken({
      organizationId: req.tenant.organizationId,
      userId: user._id.toString(),
      email: user.email,
      purpose: 'email_verify',
      expiresAt: new Date(Date.now() + env.emailVerifyExpiresMinutes * 60 * 1000)
    });

    const verificationUrl = `${resolveFrontendOrigin(req)}/verify-email?token=${rawToken}`;
    await sendEmailVerification({
      to: user.email,
      name: user.name,
      verificationUrl,
      organizationName: req.tenant.organizationName
    });
  }

  res.json({
    success: true,
    message: 'If the account exists and is unverified, a verification email has been sent.'
  });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.tenant) {
    throw createHttpError(401, 'Unauthorized');
  }

  const user = await UserModel.findOne({
    _id: req.user.sub,
    organization: req.tenant.organizationId,
    isActive: true
  }).lean();

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  res.json({
    success: true,
    data: {
      user: mapUserForResponse(user),
      tenant: req.tenant
    }
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  if (!req.tenant) {
    throw createHttpError(400, 'Tenant context is required');
  }

  const currentRefreshToken = String(req.body.refreshToken ?? '').trim();
  if (!currentRefreshToken) {
    throw createHttpError(400, 'refreshToken is required');
  }

  let decodedRefreshToken: AuthTokenPayload & { exp?: number };
  try {
    decodedRefreshToken = verifyRefreshToken(currentRefreshToken);
  } catch {
    throw createHttpError(401, 'Invalid refresh token');
  }

  if (decodedRefreshToken.organizationId !== req.tenant.organizationId) {
    throw createHttpError(403, 'Refresh token tenant mismatch');
  }

  const storedToken = await findValidRefreshToken({
    refreshToken: currentRefreshToken,
    organizationId: req.tenant.organizationId,
    userId: decodedRefreshToken.sub
  });

  if (!storedToken) {
    throw createHttpError(401, 'Refresh token is revoked or expired');
  }

  const user = await UserModel.findOne({
    _id: decodedRefreshToken.sub,
    organization: req.tenant.organizationId,
    isActive: true
  }).lean();

  if (!user) {
    throw createHttpError(401, 'User not found or inactive');
  }

  const nextTokens = await issueAuthTokens({
    userId: user._id.toString(),
    organizationId: req.tenant.organizationId,
    role: user.role,
    email: user.email,
    req
  });

  await revokeRefreshToken({
    refreshToken: currentRefreshToken,
    replacedByRefreshToken: nextTokens.refreshToken
  });

  res.json({
    success: true,
    data: {
      user: mapUserForResponse(user),
      tenant: req.tenant,
      tokens: nextTokens
    }
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (!req.tenant) {
    throw createHttpError(400, 'Tenant context is required');
  }

  const currentRefreshToken = String(req.body.refreshToken ?? '').trim();
  if (!currentRefreshToken) {
    throw createHttpError(400, 'refreshToken is required');
  }

  let decodedRefreshToken: AuthTokenPayload;
  try {
    decodedRefreshToken = verifyRefreshToken(currentRefreshToken);
  } catch {
    throw createHttpError(401, 'Invalid refresh token');
  }

  if (decodedRefreshToken.organizationId !== req.tenant.organizationId) {
    throw createHttpError(403, 'Refresh token tenant mismatch');
  }

  await revokeRefreshToken({
    refreshToken: currentRefreshToken
  });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});
