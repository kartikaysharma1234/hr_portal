import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envCandidates = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server/.env')
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const required = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  mongodbUri: required('MONGODB_URI'),
  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  allowedRootDomain: process.env.ALLOWED_ROOT_DOMAIN ?? process.env.TOP_LEVEL_DOMAIN ?? 'localhost',
  platformAdminKey: process.env.PLATFORM_ADMIN_KEY ?? '',
  platformJwtSecret: process.env.PLATFORM_JWT_SECRET ?? process.env.JWT_ACCESS_SECRET ?? '',
  platformTokenExpiresIn: process.env.PLATFORM_TOKEN_EXPIRES_IN ?? '12h',
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL ?? '',
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD ?? '',
  clientAppUrl: process.env.CLIENT_APP_URL ?? 'http://localhost:5173',
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: String(process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpFrom: process.env.SMTP_FROM ?? 'no-reply@hrms.local',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  emailVerifyExpiresMinutes: Number(process.env.EMAIL_VERIFY_EXPIRES_MINUTES ?? 60 * 24),
  passwordResetExpiresMinutes: Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES ?? 30)
};
