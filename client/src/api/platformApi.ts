import { apiClient } from './http';
import type {
  CreateOrganizationPayload,
  OrganizationSettings,
  OrganizationSettingsResponse,
  OrganizationSummary,
  PlatformLoginResponse
} from '../types/platform';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const platformApi = {
  async login(email: string, password: string): Promise<PlatformLoginResponse> {
    const response = await apiClient.post<ApiEnvelope<PlatformLoginResponse>>('/platform/auth/login', {
      email,
      password
    });
    return response.data.data;
  },

  async listOrganizations(): Promise<OrganizationSummary[]> {
    const response = await apiClient.get<ApiEnvelope<OrganizationSummary[]>>('/platform/organizations');
    return response.data.data;
  },

  async createOrganization(payload: CreateOrganizationPayload): Promise<void> {
    await apiClient.post('/platform/organizations', payload);
  },

  async deleteOrganization(organizationId: string): Promise<void> {
    await apiClient.delete(`/platform/organizations/${organizationId}`);
  },

  async getOrganizationSettings(organizationId: string): Promise<OrganizationSettingsResponse> {
    const response = await apiClient.get<ApiEnvelope<OrganizationSettingsResponse>>(
      `/platform/organizations/${organizationId}/settings`
    );
    return response.data.data;
  },

  async updateOrganizationSettings(
    organizationId: string,
    settingsPatch: OrganizationSettings
  ): Promise<void> {
    await apiClient.put(`/platform/organizations/${organizationId}/settings`, {
      settings: settingsPatch
    });
  }
};
