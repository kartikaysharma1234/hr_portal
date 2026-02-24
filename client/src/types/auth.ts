export type UserRole = 'super_admin' | 'admin' | 'manager' | 'employee';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
}

export interface TenantInfo {
  subdomain: string;
  organizationId: string;
  organizationName: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: AuthUser;
  tenant: TenantInfo;
  tokens: AuthTokens;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}
