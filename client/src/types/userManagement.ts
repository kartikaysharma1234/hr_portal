export type ManagedUserRole = 'admin' | 'hr' | 'manager' | 'employee';

export interface UserPunchWindow {
  punchInStartTime: string;
  punchInEndTime: string;
  punchOutStartTime: string;
  punchOutEndTime: string;
}

export interface OrganizationUserRow {
  id: string;
  name: string;
  email: string;
  role: ManagedUserRole;
  isActive: boolean;
  authProvider: 'local' | 'google';
  emailVerified: boolean;
  punchWindow: UserPunchWindow;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateOrganizationUserPayload {
  name: string;
  email: string;
  password: string;
  role: ManagedUserRole;
  punchWindow: UserPunchWindow;
}
