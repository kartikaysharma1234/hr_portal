export type LeaveRequestStatus = 'pending' | 'submitted' | 'approved' | 'rejected' | 'cancelled';
export type LeaveRequestType =
  | 'CL'
  | 'HCL'
  | 'HPL'
  | 'PL'
  | 'HSL'
  | 'SL'
  | 'COF'
  | 'HCO'
  | 'HOD'
  | 'OD'
  | 'OH'
  | 'HWFH'
  | 'WFH'
  | 'SPL';
export type LeaveDurationType = 'full_day' | 'first_half' | 'second_half';

export interface LeaveRequestAuditEntry {
  action: string;
  at: string | null;
  comment: string;
  byUser: string;
}

export interface LeaveRequestEmployee {
  id: string;
  employeeCode: string;
  name: string;
}

export interface LeaveRequestApprover {
  id: string;
  name: string;
  email: string;
}

export interface LeaveRequestRecord {
  id: string;
  leaveType: LeaveRequestType;
  leaveTypeLabel: string;
  durationType: LeaveDurationType;
  fromDate: string;
  toDate: string;
  fromDateLabel: string;
  toDateLabel: string;
  noOfDays: number;
  reason: string;
  workLocation: string;
  status: LeaveRequestStatus;
  appliedOn: string;
  appliedOnLabel: string;
  submittedAt: string | null;
  decidedAt: string | null;
  decisionComment: string;
  employee: LeaveRequestEmployee | null;
  approver: LeaveRequestApprover | null;
  proxyApprover: LeaveRequestApprover | null;
  auditTrail: LeaveRequestAuditEntry[];
}
