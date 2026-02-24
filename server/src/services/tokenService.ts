import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

import { env } from '../config/env';
import type { AuthTokenPayload, PlatformTokenPayload } from '../types/tenant';

const signToken = (payload: object, secret: string, expiresIn: string): string => {
  return jwt.sign(payload, secret, {
    expiresIn: expiresIn as SignOptions['expiresIn']
  });
};

export const generateAccessToken = (payload: AuthTokenPayload): string => {
  return signToken(payload, env.jwtAccessSecret, env.jwtAccessExpiresIn);
};

export const generateRefreshToken = (payload: AuthTokenPayload): string => {
  return signToken(payload, env.jwtRefreshSecret, env.jwtRefreshExpiresIn);
};

export const verifyAccessToken = (token: string): AuthTokenPayload => {
  return jwt.verify(token, env.jwtAccessSecret) as AuthTokenPayload;
};

export const verifyRefreshToken = (token: string): AuthTokenPayload & JwtPayload => {
  return jwt.verify(token, env.jwtRefreshSecret) as AuthTokenPayload & JwtPayload;
};

export const generatePlatformToken = (payload: PlatformTokenPayload): string => {
  return signToken(payload, env.platformJwtSecret, env.platformTokenExpiresIn);
};

export const verifyPlatformToken = (token: string): PlatformTokenPayload & JwtPayload => {
  return jwt.verify(token, env.platformJwtSecret) as PlatformTokenPayload & JwtPayload;
};
