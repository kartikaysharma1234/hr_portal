import createHttpError from 'http-errors';
import { OAuth2Client } from 'google-auth-library';

import { env } from '../config/env';

const oauthClient = new OAuth2Client();

export interface GoogleUserProfile {
  googleId: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export const verifyGoogleIdToken = async (idToken: string): Promise<GoogleUserProfile> => {
  if (!env.googleClientId) {
    throw createHttpError(500, 'GOOGLE_CLIENT_ID is not configured');
  }

  const ticket = await oauthClient.verifyIdToken({
    idToken,
    audience: env.googleClientId
  });

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw createHttpError(401, 'Invalid Google token payload');
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name ?? payload.given_name ?? payload.email,
    emailVerified: Boolean(payload.email_verified)
  };
};
