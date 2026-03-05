export interface TenantContext {
  subdomain: string;
  organizationId: string;
  organizationName: string;
}

export interface AuthTokenPayload {
  sub: string;
  organizationId: string;
  role: 'super_admin' | 'admin' | 'hr' | 'manager' | 'employee';
  email: string;
}

export interface PlatformTokenPayload {
  sub: 'platform-super-admin';
  role: 'super_admin';
  email: string;
  type: 'platform';
}
