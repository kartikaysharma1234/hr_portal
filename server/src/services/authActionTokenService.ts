import crypto from 'crypto';
import createHttpError from 'http-errors';

import {
  AuthActionTokenModel,
  type AuthActionTokenPurpose
} from '../models/AuthActionToken';

export const hashActionToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const generateRawActionToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const createAuthActionToken = async (params: {
  organizationId: string;
  userId: string;
  email: string;
  purpose: AuthActionTokenPurpose;
  expiresAt: Date;
}): Promise<string> => {
  const rawToken = generateRawActionToken();
  const tokenHash = hashActionToken(rawToken);

  await AuthActionTokenModel.create({
    organization: params.organizationId,
    user: params.userId,
    email: params.email,
    purpose: params.purpose,
    tokenHash,
    expiresAt: params.expiresAt
  });

  return rawToken;
};

export const consumeAuthActionToken = async (params: {
  rawToken: string;
  purpose: AuthActionTokenPurpose;
}) => {
  const tokenHash = hashActionToken(params.rawToken);
  const tokenDoc = await AuthActionTokenModel.findOne({
    tokenHash,
    purpose: params.purpose,
    usedAt: null,
    expiresAt: { $gt: new Date() }
  }).exec();

  if (!tokenDoc) {
    throw createHttpError(400, 'Token is invalid or expired');
  }

  tokenDoc.usedAt = new Date();
  await tokenDoc.save();

  return tokenDoc;
};

export const invalidatePreviousActionTokens = async (params: {
  organizationId: string;
  userId: string;
  purpose: AuthActionTokenPurpose;
}): Promise<void> => {
  await AuthActionTokenModel.updateMany(
    {
      organization: params.organizationId,
      user: params.userId,
      purpose: params.purpose,
      usedAt: null
    },
    {
      $set: {
        usedAt: new Date()
      }
    }
  ).exec();
};
