import crypto from 'crypto';
import createHttpError from 'http-errors';
import type { JwtPayload } from 'jsonwebtoken';

import { RefreshTokenModel } from '../models/RefreshToken';

export interface RefreshTokenMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export const hashRefreshToken = (refreshToken: string): string => {
  return crypto.createHash('sha256').update(refreshToken).digest('hex');
};

const resolveExpiryDate = (jwtPayload: JwtPayload): Date => {
  if (!jwtPayload.exp) {
    throw createHttpError(401, 'Invalid refresh token expiry');
  }

  return new Date(jwtPayload.exp * 1000);
};

export const persistRefreshToken = async (params: {
  refreshToken: string;
  organizationId: string;
  userId: string;
  jwtPayload: JwtPayload;
  meta?: RefreshTokenMeta;
}): Promise<void> => {
  const tokenHash = hashRefreshToken(params.refreshToken);
  const expiresAt = resolveExpiryDate(params.jwtPayload);

  await RefreshTokenModel.create({
    organization: params.organizationId,
    user: params.userId,
    tokenHash,
    expiresAt,
    ipAddress: params.meta?.ipAddress ?? null,
    userAgent: params.meta?.userAgent ?? null
  });
};

export const findValidRefreshToken = async (params: {
  refreshToken: string;
  organizationId: string;
  userId: string;
}) => {
  const tokenHash = hashRefreshToken(params.refreshToken);

  return RefreshTokenModel.findOne({
    tokenHash,
    organization: params.organizationId,
    user: params.userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  }).exec();
};

export const revokeRefreshToken = async (params: {
  refreshToken: string;
  replacedByRefreshToken?: string;
}): Promise<void> => {
  const tokenHash = hashRefreshToken(params.refreshToken);
  const replacedByTokenHash = params.replacedByRefreshToken
    ? hashRefreshToken(params.replacedByRefreshToken)
    : null;

  await RefreshTokenModel.updateOne(
    {
      tokenHash,
      revokedAt: null
    },
    {
      $set: {
        revokedAt: new Date(),
        replacedByTokenHash
      }
    }
  ).exec();
};
