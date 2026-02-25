export interface PlatformAuthUser {
  id: string;
  name: string;
  email: string;
  role: 'super_admin';
}

export interface PlatformLoginResponse {
  user: PlatformAuthUser;
  token: string;
}

export type OrganizationSettings = Record<string, unknown>;

export interface OrganizationSummary {
  id: string;
  name: string;
  subdomain: string;
  isActive: boolean;
  logoDataUrl?: string;
  createdAt: string;
}

export interface OrganizationSettingsResponse {
  id: string;
  name: string;
  subdomain: string;
  logoDataUrl?: string;
  settings: OrganizationSettings;
}

export interface CreateOrganizationPayload {
  name: string;
  subdomain: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  logoDataUrl?: string;
}
