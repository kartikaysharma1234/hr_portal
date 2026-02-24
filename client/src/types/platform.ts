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

export interface OrganizationSummary {
  id: string;
  name: string;
  subdomain: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateOrganizationPayload {
  name: string;
  subdomain: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}
