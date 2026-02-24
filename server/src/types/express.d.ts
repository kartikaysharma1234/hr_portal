import type { AuthTokenPayload, PlatformTokenPayload, TenantContext } from './tenant';

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
      user?: AuthTokenPayload;
      platformUser?: PlatformTokenPayload;
    }
  }
}

export {};
