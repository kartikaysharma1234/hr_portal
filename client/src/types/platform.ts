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
  currentPlan: string;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  employeeLimit: number;
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

export interface UpdateOrganizationSubscriptionPayload {
  currentPlan?: 'Free' | 'Starter' | 'Growth' | 'Enterprise';
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  employeeLimit?: number;
}
