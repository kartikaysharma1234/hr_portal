export interface RequestEmployeeRef {
  id: string;
  name: string;
  employeeCode: string;
}

export interface RequestUserRef {
  id: string;
  name: string;
  email: string;
  role?: string;
  employeeCode?: string;
}

export interface RequestAuditEntry {
  action: string;
  at: string | null;
  comment: string;
  byUser: string;
}

export interface RequestMastersPayload {
  context: {
    currentUserId: string;
    employee: RequestEmployeeRef;
    reportingManager: RequestUserRef | null;
  };
  helpDesk: {
    typeOptions: string[];
    priorityOptions: Array<{ value: 'high' | 'medium' | 'low'; label: string }>;
    supportOwners: RequestUserRef[];
  };
  appreciation: {
    categoryOptions: string[];
    recipients: RequestUserRef[];
    hrApprovers: RequestUserRef[];
  };
  resignation: {
    reasonOptions: string[];
    noticePeriodDays: number;
    hrApprovers: RequestUserRef[];
  };
  leaveEncashment: {
    leaveTypes: Array<'PL' | 'CL' | 'SL' | 'OH'>;
    encashableDaysPerYear: number;
    hrApprovers: RequestUserRef[];
    summaryByLeaveType: Array<{
      leaveType: 'PL' | 'CL' | 'SL' | 'OH';
      leaveBalance: number;
      encashedDaysCurrentYear: number;
    }>;
  };
}

export type HelpDeskStatus = 'pending' | 'submitted' | 'responded' | 'cancelled';
export type HelpDeskScope = 'mine' | 'assigned' | 'all';

export interface HelpDeskRecord {
  id: string;
  ticketType: string;
  targetType: 'support_owner' | 'reporting_manager';
  priority: 'high' | 'medium' | 'low';
  priorityLabel: string;
  subject: string;
  description: string;
  response: string;
  attachments: string[];
  status: HelpDeskStatus;
  submittedAt: string | null;
  submittedAtLabel: string | null;
  respondedAt: string | null;
  respondedAtLabel: string | null;
  createdAt: string | null;
  createdAtLabel: string | null;
  updatedAt: string | null;
  employee: RequestEmployeeRef | null;
  requestedBy: RequestUserRef | null;
  assignedTo: RequestUserRef | null;
  respondedBy: RequestUserRef | null;
  auditTrail: RequestAuditEntry[];
}

export type AppreciationStatus = 'pending' | 'submitted' | 'approved' | 'rejected' | 'cancelled';
export type AppreciationScope = 'mine' | 'assigned' | 'all';

export interface AppreciationRecord {
  id: string;
  appreciationCategory: string;
  appreciationTitle: string;
  description: string;
  status: AppreciationStatus;
  submittedAt: string | null;
  submittedAtLabel: string | null;
  decidedAt: string | null;
  decidedAtLabel: string | null;
  decisionComment: string;
  createdAt: string | null;
  createdAtLabel: string | null;
  updatedAt: string | null;
  employee: RequestEmployeeRef | null;
  requestedBy: RequestUserRef | null;
  appreciationTo: RequestUserRef | null;
  appreciationToEmployee: RequestEmployeeRef | null;
  approver: RequestUserRef | null;
  decidedBy: RequestUserRef | null;
  auditTrail: RequestAuditEntry[];
}

export type ResignationStatus = 'submitted' | 'approved' | 'rejected' | 'cancelled';
export type ResignationScope = 'mine' | 'assigned' | 'all';

export interface ResignationRecord {
  id: string;
  dateOfResignation: string;
  dateOfResignationLabel: string | null;
  noticePeriodDays: number;
  lastDateAsPerPolicy: string;
  lastDateAsPerPolicyLabel: string | null;
  expectedLastDate: string;
  expectedLastDateLabel: string | null;
  reasonForExit: string;
  description: string;
  status: ResignationStatus;
  submittedAt: string | null;
  submittedAtLabel: string | null;
  decidedAt: string | null;
  decidedAtLabel: string | null;
  decisionComment: string;
  createdAt: string | null;
  createdAtLabel: string | null;
  employee: RequestEmployeeRef | null;
  requestedBy: RequestUserRef | null;
  reportingManager: RequestUserRef | null;
  hrManager: RequestUserRef | null;
  decidedBy: RequestUserRef | null;
  auditTrail: RequestAuditEntry[];
}

export type LeaveEncashmentStatus = 'pending' | 'submitted' | 'approved' | 'rejected' | 'cancelled';
export type LeaveEncashmentScope = 'mine' | 'assigned' | 'all';

export interface LeaveEncashmentRecord {
  id: string;
  leaveType: 'PL' | 'CL' | 'SL' | 'OH';
  daysToEncash: number;
  purpose: string;
  encashableDaysPerYear: number;
  encashedDaysCurrentYear: number;
  currentLeaveBalance: number;
  status: LeaveEncashmentStatus;
  submittedAt: string | null;
  submittedAtLabel: string | null;
  decidedAt: string | null;
  decidedAtLabel: string | null;
  decisionComment: string;
  createdAt: string | null;
  createdAtLabel: string | null;
  employee: RequestEmployeeRef | null;
  requestedBy: RequestUserRef | null;
  approver: RequestUserRef | null;
  decidedBy: RequestUserRef | null;
  auditTrail: RequestAuditEntry[];
}

export interface LeaveEncashmentMeta {
  leaveType: 'PL' | 'CL' | 'SL' | 'OH';
  encashableDaysPerYear: number;
  leaveBalance: number;
  encashedDaysCurrentYear: number;
  availableToEncash: number;
}
