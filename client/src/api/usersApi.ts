import { apiClient } from './http';
import type {
  CreateOrganizationUserPayload,
  ManagedUserRole,
  OrganizationUserRow,
  UserPunchWindow,
} from '../types/userManagement';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface ListUsersQuery {
  search?: string;
  role?: ManagedUserRole | '';
  isActive?: 'true' | 'false' | '';
}

export const usersApi = {
  async listUsers(query: ListUsersQuery = {}): Promise<OrganizationUserRow[]> {
    const response = await apiClient.get<ApiEnvelope<OrganizationUserRow[]>>('/users', {
      params: {
        search: query.search || undefined,
        role: query.role || undefined,
        isActive: query.isActive || undefined,
      },
    });

    return response.data.data;
  },

  async createUser(payload: CreateOrganizationUserPayload): Promise<void> {
    await apiClient.post('/users', payload);
  },

  async updateUserRole(userId: string, role: ManagedUserRole): Promise<void> {
    await apiClient.patch(`/users/${userId}/role`, { role });
  },

  async updateUserStatus(userId: string, isActive: boolean): Promise<void> {
    await apiClient.patch(`/users/${userId}/status`, { isActive });
  },

  async updateUserPunchWindow(userId: string, punchWindow: UserPunchWindow): Promise<void> {
    await apiClient.patch(`/users/${userId}/punch-window`, { punchWindow });
  },

  async deleteUser(userId: string): Promise<void> {
    await apiClient.delete(`/users/${userId}`);
  },
};
