import type { Request, Response } from 'express';
import createHttpError from 'http-errors';
import mongoose from 'mongoose';
import { DateTime } from 'luxon';

import { AppreciationRequestModel } from '../models/AppreciationRequest';
import { AttendanceLeaveLedgerModel } from '../models/AttendanceLeaveLedger';
import { EmployeeModel } from '../models/Employee';
import { HelpDeskRequestModel } from '../models/HelpDeskRequest';
import { LeaveEncashmentRequestModel } from '../models/LeaveEncashmentRequest';
import { ResignationRequestModel } from '../models/ResignationRequest';
import { UserModel } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';

const approverRoles = new Set(['super_admin', 'admin', 'hr', 'manager']);
const privilegedApproverRoles = new Set(['super_admin', 'admin', 'hr']);
const supportOwnerRoles = new Set(['super_admin', 'admin', 'hr', 'manager']);
const hrManagerRoles = new Set(['super_admin', 'admin', 'hr']);

const helpDeskStatusValues = ['pending', 'submitted', 'responded', 'cancelled'] as const;
const helpDeskPriorityValues = ['high', 'medium', 'low'] as const;
const helpDeskTargetValues = ['support_owner', 'reporting_manager'] as const;
const appreciationStatusValues = ['pending', 'submitted', 'approved', 'rejected', 'cancelled'] as const;
const resignationStatusValues = ['submitted', 'approved', 'rejected', 'cancelled'] as const;
const leaveEncashmentStatusValues = ['pending', 'submitted', 'approved', 'rejected', 'cancelled'] as const;
const leaveEncashmentLeaveTypes = ['PL', 'CL', 'SL', 'OH'] as const;
const saveSubmitActions = ['save', 'submit'] as const;

type HelpDeskStatusCode = (typeof helpDeskStatusValues)[number];
type HelpDeskPriorityCode = (typeof helpDeskPriorityValues)[number];
type HelpDeskTargetCode = (typeof helpDeskTargetValues)[number];
type AppreciationStatusCode = (typeof appreciationStatusValues)[number];
type ResignationStatusCode = (typeof resignationStatusValues)[number];
type LeaveEncashmentStatusCode = (typeof leaveEncashmentStatusValues)[number];
type LeaveEncashmentLeaveTypeCode = (typeof leaveEncashmentLeaveTypes)[number];
type SaveSubmitActionCode = (typeof saveSubmitActions)[number];

const helpDeskTypeOptions = [
  'Attendance',
  'Payroll',
  'IT Support',
  'Leave & Policy',
  'Infra / Admin',
  'General Query'
] as const;

const appreciationCategoryOptions = [
  'A Team',
  'Dragan Warrior',
  'Fifteen Year',
  'Five Year',
  'Golden Quill',
  'HR ON FIRE',
  'LORD OF THE BEES',
  'MONEY HONEY',
  'North Star',
  'SHIFU',
  'SHIFU 2',
  'Super Bug Squasher',
  'Super Seven',
  'Ten Year',
  'Thirteen Year',
  'Three Year',
  'Zero Defector'
] as const;

const resignationReasonOptions = [
  'Better Prospects',
  'Higher Studies',
  'Others (Please Specify)',
  'Personal Reason',
  'Relocation'
] as const;

const leaveEncashmentYearlyCap = 30;

const requireTenantAndUser = (req: Request): { organizationId: string; userId: string } => {
  if (!req.tenant) {
    throw createHttpError(400, 'Tenant context is required');
  }

  if (!req.user) {
    throw createHttpError(401, 'Unauthorized');
  }

  return {
    organizationId: req.tenant.organizationId,
    userId: req.user.sub
  };
};

const requireApproverRole = (req: Request): void => {
  if (!req.user || !approverRoles.has(req.user.role)) {
    throw createHttpError(403, 'Only manager/hr/admin can perform this action');
  }
};

const parseAction = (rawValue: unknown): SaveSubmitActionCode => {
  const value = String(rawValue ?? 'save').trim().toLowerCase();
  if (!saveSubmitActions.includes(value as SaveSubmitActionCode)) {
    throw createHttpError(400, 'action must be save or submit');
  }

  return value as SaveSubmitActionCode;
};

const parseIsoDateStrict = (rawValue: unknown, fieldName: string): string => {
  const value = String(rawValue ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw createHttpError(400, `${fieldName} must be YYYY-MM-DD`);
  }

  const parsed = DateTime.fromISO(value, { zone: 'Asia/Kolkata' });
  if (!parsed.isValid) {
    throw createHttpError(400, `${fieldName} is invalid`);
  }

  return parsed.toFormat('yyyy-LL-dd');
};

const toIsoDisplay = (rawDate: Date | string | null | undefined): string | null => {
  if (!rawDate) {
    return null;
  }

  const parsed =
    rawDate instanceof Date
      ? DateTime.fromJSDate(rawDate, { zone: 'Asia/Kolkata' })
      : DateTime.fromISO(String(rawDate), { zone: 'Asia/Kolkata' });
  if (!parsed.isValid) {
    return null;
  }

  return parsed.toFormat('dd-LLL-yy');
};

const parseDateRangeFilter = (req: Request): { $gte?: Date; $lte?: Date } | null => {
  const fromDateRaw = String(req.query.fromDate ?? '').trim();
  const toDateRaw = String(req.query.toDate ?? '').trim();

  if (!fromDateRaw && !toDateRaw) {
    return null;
  }

  const range: { $gte?: Date; $lte?: Date } = {};

  if (fromDateRaw) {
    const fromIso = parseIsoDateStrict(fromDateRaw, 'fromDate');
    const fromDate = DateTime.fromISO(fromIso, { zone: 'Asia/Kolkata' }).startOf('day');
    range.$gte = fromDate.toJSDate();
  }

  if (toDateRaw) {
    const toIso = parseIsoDateStrict(toDateRaw, 'toDate');
    const toDate = DateTime.fromISO(toIso, { zone: 'Asia/Kolkata' }).endOf('day');
    range.$lte = toDate.toJSDate();
  }

  return range;
};

const resolveEmployeeForAuthenticatedUser = async (req: Request): Promise<any> => {
  const { organizationId, userId } = requireTenantAndUser(req);
  const userEmail = String(req.user?.email ?? '').trim().toLowerCase();

  let employee = await EmployeeModel.findOne({
    organization: organizationId,
    workEmail: userEmail,
    status: 'active'
  }).lean();

  if (!employee && req.user && req.user.role !== 'employee') {
    employee = await EmployeeModel.findOne({
      organization: organizationId,
      managerUser: userId,
      status: 'active'
    })
      .sort({ createdAt: 1 })
      .lean();
  }

  if (!employee) {
    throw createHttpError(
      404,
      'No employee profile is linked with this account. Create employee record with same work email first.'
    );
  }

  return employee;
};

const resolveUserIfValid = async (params: {
  organizationId: string;
  userId: string;
  errorMessage: string;
}): Promise<any> => {
  if (!mongoose.Types.ObjectId.isValid(params.userId)) {
    throw createHttpError(400, params.errorMessage);
  }

  const user = await UserModel.findOne({
    _id: params.userId,
    organization: params.organizationId,
    isActive: true
  })
    .select({ _id: 1, name: 1, email: 1, role: 1 })
    .lean();
  if (!user) {
    throw createHttpError(404, params.errorMessage);
  }

  return user;
};

const ensureCanActAsApprover = (params: {
  req: Request;
  approverUserId: string;
  errorMessage: string;
}): void => {
  requireApproverRole(params.req);
  const actingUserId = params.req.user?.sub ?? '';
  const role = params.req.user?.role ?? '';

  if (actingUserId === params.approverUserId) {
    return;
  }

  if (privilegedApproverRoles.has(role)) {
    return;
  }

  throw createHttpError(403, params.errorMessage);
};

const buildAuditRow = (params: {
  action: string;
  byUser: string;
  comment?: string;
}): { action: string; byUser: mongoose.Types.ObjectId; at: Date; comment: string } => ({
  action: params.action,
  byUser: new mongoose.Types.ObjectId(params.byUser),
  at: new Date(),
  comment: String(params.comment ?? '')
});

const parseHelpDeskStatus = (rawValue: unknown): HelpDeskStatusCode | 'all' => {
  const value = String(rawValue ?? '').trim().toLowerCase();
  if (!value || value === 'all') {
    return 'all';
  }

  if (!helpDeskStatusValues.includes(value as HelpDeskStatusCode)) {
    throw createHttpError(400, 'Invalid helpdesk status');
  }

  return value as HelpDeskStatusCode;
};

const parseAppreciationStatus = (rawValue: unknown): AppreciationStatusCode | 'all' => {
  const value = String(rawValue ?? '').trim().toLowerCase();
  if (!value || value === 'all') {
    return 'all';
  }

  if (!appreciationStatusValues.includes(value as AppreciationStatusCode)) {
    throw createHttpError(400, 'Invalid appreciation status');
  }

  return value as AppreciationStatusCode;
};

const parseResignationStatus = (rawValue: unknown): ResignationStatusCode | 'all' => {
  const value = String(rawValue ?? '').trim().toLowerCase();
  if (!value || value === 'all') {
    return 'all';
  }

  if (!resignationStatusValues.includes(value as ResignationStatusCode)) {
    throw createHttpError(400, 'Invalid resignation status');
  }

  return value as ResignationStatusCode;
};

const parseLeaveEncashmentStatus = (rawValue: unknown): LeaveEncashmentStatusCode | 'all' => {
  const value = String(rawValue ?? '').trim().toLowerCase();
  if (!value || value === 'all') {
    return 'all';
  }

  if (!leaveEncashmentStatusValues.includes(value as LeaveEncashmentStatusCode)) {
    throw createHttpError(400, 'Invalid leave encashment status');
  }

  return value as LeaveEncashmentStatusCode;
};

const parseHelpDeskPriority = (rawValue: unknown): HelpDeskPriorityCode => {
  const value = String(rawValue ?? 'medium').trim().toLowerCase();
  if (!helpDeskPriorityValues.includes(value as HelpDeskPriorityCode)) {
    throw createHttpError(400, 'priority must be high/medium/low');
  }

  return value as HelpDeskPriorityCode;
};

const parseHelpDeskTarget = (rawValue: unknown): HelpDeskTargetCode => {
  const value = String(rawValue ?? 'support_owner').trim().toLowerCase();
  if (!helpDeskTargetValues.includes(value as HelpDeskTargetCode)) {
    throw createHttpError(400, 'targetType must be support_owner/reporting_manager');
  }

  return value as HelpDeskTargetCode;
};

const parseLeaveEncashmentLeaveType = (rawValue: unknown): LeaveEncashmentLeaveTypeCode => {
  const value = String(rawValue ?? '').trim().toUpperCase();
  if (!leaveEncashmentLeaveTypes.includes(value as LeaveEncashmentLeaveTypeCode)) {
    throw createHttpError(400, 'leaveType must be one of PL/CL/SL/OH');
  }

  return value as LeaveEncashmentLeaveTypeCode;
};

const formatPriorityLabel = (priority: HelpDeskPriorityCode): string => {
  if (priority === 'high') return 'High';
  if (priority === 'low') return 'Low';
  return 'Medium';
};

const mapUserRef = (rawValue: any): { id: string; name: string; email: string; role?: string } | null => {
  if (!rawValue || typeof rawValue !== 'object') {
    return null;
  }

  return {
    id: String(rawValue._id ?? ''),
    name: String(rawValue.name ?? ''),
    email: String(rawValue.email ?? ''),
    role: rawValue.role ? String(rawValue.role) : undefined
  };
};

const mapEmployeeRef = (rawValue: any): { id: string; name: string; employeeCode: string } | null => {
  if (!rawValue || typeof rawValue !== 'object') {
    return null;
  }

  const firstName = String(rawValue.firstName ?? '').trim();
  const lastName = String(rawValue.lastName ?? '').trim();
  return {
    id: String(rawValue._id ?? ''),
    name: `${firstName} ${lastName}`.trim(),
    employeeCode: String(rawValue.employeeCode ?? '')
  };
};

const mapHelpDeskPayload = (row: any) => ({
  id: String(row._id ?? ''),
  ticketType: String(row.ticketType ?? ''),
  targetType: String(row.targetType ?? 'support_owner'),
  priority: String(row.priority ?? 'medium'),
  priorityLabel: formatPriorityLabel(String(row.priority ?? 'medium') as HelpDeskPriorityCode),
  subject: String(row.subject ?? ''),
  description: String(row.description ?? ''),
  response: String(row.response ?? ''),
  attachments: Array.isArray(row.attachments) ? row.attachments.map(String) : [],
  status: String(row.status ?? 'pending'),
  submittedAt: row.submittedAt ?? null,
  submittedAtLabel: toIsoDisplay(row.submittedAt),
  respondedAt: row.respondedAt ?? null,
  respondedAtLabel: toIsoDisplay(row.respondedAt),
  createdAt: row.createdAt ?? null,
  createdAtLabel: toIsoDisplay(row.createdAt),
  updatedAt: row.updatedAt ?? null,
  employee: mapEmployeeRef(row.employee),
  requestedBy: mapUserRef(row.requestedBy),
  assignedTo: mapUserRef(row.assignedToUser),
  respondedBy: mapUserRef(row.respondedBy),
  auditTrail: Array.isArray(row.auditTrail)
    ? row.auditTrail.map((entry: any) => ({
        action: String(entry.action ?? ''),
        at: entry.at ?? null,
        comment: String(entry.comment ?? ''),
        byUser: String(entry.byUser ?? '')
      }))
    : []
});

const mapAppreciationPayload = (row: any) => ({
  id: String(row._id ?? ''),
  appreciationCategory: String(row.appreciationCategory ?? ''),
  appreciationTitle: String(row.appreciationTitle ?? ''),
  description: String(row.description ?? ''),
  status: String(row.status ?? 'pending'),
  submittedAt: row.submittedAt ?? null,
  submittedAtLabel: toIsoDisplay(row.submittedAt),
  decidedAt: row.decidedAt ?? null,
  decidedAtLabel: toIsoDisplay(row.decidedAt),
  decisionComment: String(row.decisionComment ?? ''),
  createdAt: row.createdAt ?? null,
  createdAtLabel: toIsoDisplay(row.createdAt),
  updatedAt: row.updatedAt ?? null,
  employee: mapEmployeeRef(row.employee),
  requestedBy: mapUserRef(row.requestedBy),
  appreciationTo: mapUserRef(row.appreciationToUser),
  appreciationToEmployee: mapEmployeeRef(row.appreciationToEmployee),
  approver: mapUserRef(row.approverUser),
  decidedBy: mapUserRef(row.decidedBy),
  auditTrail: Array.isArray(row.auditTrail)
    ? row.auditTrail.map((entry: any) => ({
        action: String(entry.action ?? ''),
        at: entry.at ?? null,
        comment: String(entry.comment ?? ''),
        byUser: String(entry.byUser ?? '')
      }))
    : []
});

const mapResignationPayload = (row: any) => ({
  id: String(row._id ?? ''),
  dateOfResignation: String(row.dateOfResignation ?? ''),
  dateOfResignationLabel: toIsoDisplay(row.dateOfResignation),
  noticePeriodDays: Number(row.noticePeriodDays ?? 0),
  lastDateAsPerPolicy: String(row.lastDateAsPerPolicy ?? ''),
  lastDateAsPerPolicyLabel: toIsoDisplay(row.lastDateAsPerPolicy),
  expectedLastDate: String(row.expectedLastDate ?? ''),
  expectedLastDateLabel: toIsoDisplay(row.expectedLastDate),
  reasonForExit: String(row.reasonForExit ?? ''),
  description: String(row.description ?? ''),
  status: String(row.status ?? 'submitted'),
  submittedAt: row.submittedAt ?? null,
  submittedAtLabel: toIsoDisplay(row.submittedAt),
  decidedAt: row.decidedAt ?? null,
  decidedAtLabel: toIsoDisplay(row.decidedAt),
  decisionComment: String(row.decisionComment ?? ''),
  createdAt: row.createdAt ?? null,
  createdAtLabel: toIsoDisplay(row.createdAt),
  employee: mapEmployeeRef(row.employee),
  requestedBy: mapUserRef(row.requestedBy),
  reportingManager: mapUserRef(row.reportingManagerUser),
  hrManager: mapUserRef(row.hrManagerUser),
  decidedBy: mapUserRef(row.decidedBy),
  auditTrail: Array.isArray(row.auditTrail)
    ? row.auditTrail.map((entry: any) => ({
        action: String(entry.action ?? ''),
        at: entry.at ?? null,
        comment: String(entry.comment ?? ''),
        byUser: String(entry.byUser ?? '')
      }))
    : []
});

const mapLeaveEncashmentPayload = (row: any) => ({
  id: String(row._id ?? ''),
  leaveType: String(row.leaveType ?? ''),
  daysToEncash: Number(row.daysToEncash ?? 0),
  purpose: String(row.purpose ?? ''),
  encashableDaysPerYear: Number(row.encashableDaysPerYear ?? 0),
  encashedDaysCurrentYear: Number(row.encashedDaysCurrentYear ?? 0),
  currentLeaveBalance: Number(row.currentLeaveBalance ?? 0),
  status: String(row.status ?? 'pending'),
  submittedAt: row.submittedAt ?? null,
  submittedAtLabel: toIsoDisplay(row.submittedAt),
  decidedAt: row.decidedAt ?? null,
  decidedAtLabel: toIsoDisplay(row.decidedAt),
  decisionComment: String(row.decisionComment ?? ''),
  createdAt: row.createdAt ?? null,
  createdAtLabel: toIsoDisplay(row.createdAt),
  employee: mapEmployeeRef(row.employee),
  requestedBy: mapUserRef(row.requestedBy),
  approver: mapUserRef(row.approverUser),
  decidedBy: mapUserRef(row.decidedBy),
  auditTrail: Array.isArray(row.auditTrail)
    ? row.auditTrail.map((entry: any) => ({
        action: String(entry.action ?? ''),
        at: entry.at ?? null,
        comment: String(entry.comment ?? ''),
        byUser: String(entry.byUser ?? '')
      }))
    : []
});

const calculateLeaveLedgerBalance = (ledger: any): number => {
  if (!ledger) {
    return 0;
  }

  const opening = Number(ledger.openingBalance ?? 0);
  const totals = Array.isArray(ledger.monthly) ? ledger.monthly : [];
  const credited = totals.reduce((sum: number, item: any) => sum + Number(item.credit ?? 0), 0);
  const availed = totals.reduce((sum: number, item: any) => sum + Number(item.availed ?? 0), 0);
  return Number((opening + credited - availed).toFixed(2));
};

const getLeaveEncashmentCurrentYearMeta = async (params: {
  organizationId: string;
  employeeId: string;
  leaveType: LeaveEncashmentLeaveTypeCode;
  excludeRequestId?: string;
}): Promise<{
  leaveBalance: number;
  encashedDaysCurrentYear: number;
}> => {
  const now = DateTime.now().setZone('Asia/Kolkata');
  const yearStart = now.startOf('year').toJSDate();
  const yearEnd = now.endOf('year').toJSDate();
  const year = now.year;

  const [ledger, encashed] = await Promise.all([
    AttendanceLeaveLedgerModel.findOne({
      organization: params.organizationId,
      employee: params.employeeId,
      leaveType: params.leaveType,
      year
    }).lean(),
    LeaveEncashmentRequestModel.aggregate<{ total: number }>([
      {
        $match: {
          organization: new mongoose.Types.ObjectId(params.organizationId),
          employee: new mongoose.Types.ObjectId(params.employeeId),
          leaveType: params.leaveType,
          status: { $in: ['submitted', 'approved'] },
          createdAt: {
            $gte: yearStart,
            $lte: yearEnd
          },
          ...(params.excludeRequestId && mongoose.Types.ObjectId.isValid(params.excludeRequestId)
            ? { _id: { $ne: new mongoose.Types.ObjectId(params.excludeRequestId) } }
            : {})
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$daysToEncash' }
        }
      }
    ])
  ]);

  return {
    leaveBalance: calculateLeaveLedgerBalance(ledger),
    encashedDaysCurrentYear: Number(encashed[0]?.total ?? 0)
  };
};

export const getRequestMasters = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, userId } = requireTenantAndUser(req);

  const currentEmployee = await resolveEmployeeForAuthenticatedUser(req);

  const [users, employees] = await Promise.all([
    UserModel.find({
      organization: organizationId,
      isActive: true
    })
      .select({ _id: 1, name: 1, email: 1, role: 1 })
      .sort({ name: 1 })
      .lean(),
    EmployeeModel.find({
      organization: organizationId,
      status: 'active'
    })
      .select({ _id: 1, firstName: 1, lastName: 1, employeeCode: 1, workEmail: 1, managerUser: 1 })
      .sort({ firstName: 1, lastName: 1 })
      .lean()
  ]);

  const employeeByEmail = new Map<string, any>();
  for (const employee of employees) {
    employeeByEmail.set(String(employee.workEmail ?? '').toLowerCase(), employee);
  }

  const userOptions = users.map((user) => {
    const linkedEmployee = employeeByEmail.get(String(user.email ?? '').toLowerCase());
    return {
      id: String(user._id),
      name: String(user.name ?? ''),
      email: String(user.email ?? ''),
      role: String(user.role ?? ''),
      employeeCode: linkedEmployee ? String(linkedEmployee.employeeCode ?? '') : ''
    };
  });

  const supportOwners = userOptions.filter((item) => supportOwnerRoles.has(item.role));
  const hrApprovers = userOptions.filter((item) => hrManagerRoles.has(item.role));
  const appreciationRecipients = userOptions.filter((item) => item.id !== userId);

  const currentEmployeeName = `${String(currentEmployee.firstName ?? '')} ${String(currentEmployee.lastName ?? '')}`.trim();
  const reportingManagerId = currentEmployee.managerUser ? String(currentEmployee.managerUser) : '';
  const reportingManager =
    (reportingManagerId ? userOptions.find((item) => item.id === reportingManagerId) : null) ?? null;

  const leaveEncashmentMetaRows = await Promise.all(
    leaveEncashmentLeaveTypes.map(async (leaveType) => {
      const meta = await getLeaveEncashmentCurrentYearMeta({
        organizationId,
        employeeId: String(currentEmployee._id),
        leaveType
      });
      return {
        leaveType,
        ...meta
      };
    })
  );

  res.json({
    success: true,
    data: {
      context: {
        currentUserId: userId,
        employee: {
          id: String(currentEmployee._id),
          employeeCode: String(currentEmployee.employeeCode ?? ''),
          name: currentEmployeeName
        },
        reportingManager
      },
      helpDesk: {
        typeOptions: helpDeskTypeOptions,
        priorityOptions: [
          { value: 'high', label: 'High' },
          { value: 'medium', label: 'Medium' },
          { value: 'low', label: 'Low' }
        ],
        supportOwners
      },
      appreciation: {
        categoryOptions: appreciationCategoryOptions,
        recipients: appreciationRecipients,
        hrApprovers
      },
      resignation: {
        reasonOptions: resignationReasonOptions,
        noticePeriodDays: 90,
        hrApprovers
      },
      leaveEncashment: {
        leaveTypes: leaveEncashmentLeaveTypes,
        encashableDaysPerYear: leaveEncashmentYearlyCap,
        hrApprovers,
        summaryByLeaveType: leaveEncashmentMetaRows
      }
    }
  });
});

export const getLeaveEncashmentMeta = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  const currentEmployee = await resolveEmployeeForAuthenticatedUser(req);
  const leaveType = parseLeaveEncashmentLeaveType(req.query.leaveType);

  const meta = await getLeaveEncashmentCurrentYearMeta({
    organizationId,
    employeeId: String(currentEmployee._id),
    leaveType
  });

  res.json({
    success: true,
    data: {
      leaveType,
      encashableDaysPerYear: leaveEncashmentYearlyCap,
      leaveBalance: meta.leaveBalance,
      encashedDaysCurrentYear: meta.encashedDaysCurrentYear,
      availableToEncash: Number(
        Math.max(0, Math.min(meta.leaveBalance, leaveEncashmentYearlyCap - meta.encashedDaysCurrentYear)).toFixed(2)
      )
    }
  });
});

const populateHelpDeskRequest = async (organizationId: string, requestId: string): Promise<any> => {
  const row = await HelpDeskRequestModel.findOne({
    _id: requestId,
    organization: organizationId
  })
    .populate('employee', 'firstName lastName employeeCode')
    .populate('requestedBy', 'name email role')
    .populate('assignedToUser', 'name email role')
    .populate('respondedBy', 'name email role')
    .lean();

  if (!row) {
    throw createHttpError(404, 'HelpDesk request not found');
  }

  return row;
};

export const createHelpDeskRequest = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, userId } = requireTenantAndUser(req);
  const currentEmployee = await resolveEmployeeForAuthenticatedUser(req);

  const action = parseAction(req.body.action);
  const ticketType = String(req.body.ticketType ?? '').trim();
  if (!ticketType) {
    throw createHttpError(400, 'ticketType is required');
  }

  const priority = parseHelpDeskPriority(req.body.priority);
  const targetType = parseHelpDeskTarget(req.body.targetType);
  const subject = String(req.body.subject ?? '').trim();
  const description = String(req.body.description ?? '').trim();
  if (subject.length < 3) {
    throw createHttpError(400, 'subject must be at least 3 characters');
  }
  if (description.length < 5) {
    throw createHttpError(400, 'description must be at least 5 characters');
  }

  const attachments = Array.isArray(req.body.attachments)
    ? req.body.attachments.map((item: unknown) => String(item).trim()).filter(Boolean)
    : [];

  const employeeManagerUserId = currentEmployee.managerUser ? String(currentEmployee.managerUser) : '';
  let assignedToUserId = '';

  if (targetType === 'reporting_manager') {
    assignedToUserId = employeeManagerUserId;
  } else {
    assignedToUserId = String(req.body.assignedToUserId ?? '').trim();
  }

  if (action === 'submit' && !assignedToUserId) {
    throw createHttpError(400, 'Please select/assign ticket owner before submit');
  }

  if (assignedToUserId) {
    const assignedUser = await resolveUserIfValid({
      organizationId,
      userId: assignedToUserId,
      errorMessage: 'Assigned user not found'
    });

    if (!supportOwnerRoles.has(String(assignedUser.role ?? ''))) {
      throw createHttpError(400, 'Assigned user must be manager/hr/admin');
    }
  }

  const requestId = String(req.body.requestId ?? '').trim();
  let row: any;

  if (requestId) {
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      throw createHttpError(400, 'Invalid helpdesk request id');
    }

    row = await HelpDeskRequestModel.findOne({
      _id: requestId,
      organization: organizationId,
      requestedBy: userId
    }).exec();
    if (!row) {
      throw createHttpError(404, 'HelpDesk request not found');
    }
    if (row.status !== 'pending') {
      throw createHttpError(400, 'Only pending request can be edited');
    }
  } else {
    row = new HelpDeskRequestModel({
      organization: organizationId,
      employee: currentEmployee._id,
      requestedBy: userId,
      auditTrail: [buildAuditRow({ action: 'created', byUser: userId, comment: 'Draft created' })]
    });
  }

  row.ticketType = ticketType;
  row.priority = priority;
  row.targetType = targetType;
  row.assignedToUser = assignedToUserId && mongoose.Types.ObjectId.isValid(assignedToUserId)
    ? new mongoose.Types.ObjectId(assignedToUserId)
    : null;
  row.subject = subject;
  row.description = description;
  row.attachments = attachments;
  row.status = action === 'submit' ? 'submitted' : 'pending';
  row.submittedAt = action === 'submit' ? new Date() : null;
  row.respondedAt = null;
  row.respondedBy = null;
  row.response = '';
  row.auditTrail.push(
    buildAuditRow({
      action: action === 'submit' ? 'submitted' : 'saved',
      byUser: userId,
      comment: subject
    })
  );

  await row.save();
  const populated = await populateHelpDeskRequest(organizationId, String(row._id));

  res.status(requestId ? 200 : 201).json({
    success: true,
    message: action === 'submit' ? 'HelpDesk request submitted' : 'HelpDesk request saved',
    data: mapHelpDeskPayload(populated)
  });
});

export const listHelpDeskRequests = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, userId } = requireTenantAndUser(req);
  const scope = String(req.query.scope ?? 'mine').trim().toLowerCase();
  const status = parseHelpDeskStatus(req.query.status);
  const dateRange = parseDateRangeFilter(req);

  const query: Record<string, unknown> = {
    organization: organizationId
  };

  if (scope === 'assigned') {
    requireApproverRole(req);
    query.assignedToUser = userId;
    if (status === 'all') {
      query.status = 'submitted';
    }
  } else if (scope === 'all') {
    requireApproverRole(req);
  } else {
    query.requestedBy = userId;
  }

  if (status !== 'all') {
    query.status = status;
  }

  if (dateRange) {
    query.createdAt = dateRange;
  }

  const rows = await HelpDeskRequestModel.find(query)
    .populate('employee', 'firstName lastName employeeCode')
    .populate('requestedBy', 'name email role')
    .populate('assignedToUser', 'name email role')
    .populate('respondedBy', 'name email role')
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: rows.map((row) => mapHelpDeskPayload(row))
  });
});

export const cancelHelpDeskRequest = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, userId } = requireTenantAndUser(req);
  const requestId = String(req.params.id ?? '').trim();

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw createHttpError(400, 'Invalid helpdesk request id');
  }

  const row = await HelpDeskRequestModel.findOne({
    _id: requestId,
    organization: organizationId,
    requestedBy: userId
  }).exec();

  if (!row) {
    throw createHttpError(404, 'HelpDesk request not found');
  }

  if (!['pending', 'submitted'].includes(String(row.status))) {
    throw createHttpError(400, 'Only pending/submitted request can be cancelled');
  }

  const comment = String(req.body.comment ?? '').trim();
  row.status = 'cancelled';
  row.auditTrail.push(buildAuditRow({ action: 'cancelled', byUser: userId, comment }));
  await row.save();

  res.json({
    success: true,
    message: 'HelpDesk request cancelled'
  });
});

export const respondHelpDeskRequest = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, userId } = requireTenantAndUser(req);
  const requestId = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw createHttpError(400, 'Invalid helpdesk request id');
  }

  const row = await HelpDeskRequestModel.findOne({
    _id: requestId,
    organization: organizationId
  }).exec();
  if (!row) {
    throw createHttpError(404, 'HelpDesk request not found');
  }

  if (row.status !== 'submitted') {
    throw createHttpError(400, 'Only submitted request can be responded');
  }

  const approverUserId = String(row.assignedToUser ?? '');
  if (!approverUserId) {
    throw createHttpError(400, 'No assignee configured for this request');
  }

  ensureCanActAsApprover({
    req,
    approverUserId,
    errorMessage: 'Only assigned owner can respond to this request'
  });

  const responseText = String(req.body.response ?? '').trim();
  if (responseText.length < 3) {
    throw createHttpError(400, 'response must be at least 3 characters');
  }

  row.status = 'responded';
  row.response = responseText;
  row.respondedAt = new Date();
  row.respondedBy = new mongoose.Types.ObjectId(userId);
  row.auditTrail.push(buildAuditRow({ action: 'responded', byUser: userId, comment: responseText }));
  await row.save();

  const populated = await populateHelpDeskRequest(organizationId, requestId);

  res.json({
    success: true,
    message: 'HelpDesk request responded',
    data: mapHelpDeskPayload(populated)
  });
});

const populateAppreciationRequest = async (organizationId: string, requestId: string): Promise<any> => {
  const row = await AppreciationRequestModel.findOne({
    _id: requestId,
    organization: organizationId
  })
    .populate('employee', 'firstName lastName employeeCode')
    .populate('requestedBy', 'name email role')
    .populate('appreciationToUser', 'name email role')
    .populate('appreciationToEmployee', 'firstName lastName employeeCode')
    .populate('approverUser', 'name email role')
    .populate('decidedBy', 'name email role')
    .lean();

  if (!row) {
    throw createHttpError(404, 'Appreciation request not found');
  }

  return row;
};

export const createAppreciationRequest = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, userId } = requireTenantAndUser(req);
  const currentEmployee = await resolveEmployeeForAuthenticatedUser(req);

  const action = parseAction(req.body.action);
  const appreciationToUserId = String(req.body.appreciationToUserId ?? '').trim();
  if (!appreciationToUserId) {
    throw createHttpError(400, 'appreciationToUserId is required');
  }
  if (appreciationToUserId === userId) {
    throw createHttpError(400, 'You cannot create appreciation for yourself');
  }

  const appreciationToUser = await resolveUserIfValid({
    organizationId,
    userId: appreciationToUserId,
    errorMessage: 'Appreciation target user not found'
  });

  const targetEmployee = await EmployeeModel.findOne({
    organization: organizationId,
    workEmail: String(appreciationToUser.email ?? '').toLowerCase(),
    status: 'active'
  })
    .select({ _id: 1 })
    .lean();

  const appreciationCategory = String(req.body.appreciationCategory ?? '').trim();
  const appreciationTitle = String(req.body.appreciationTitle ?? '').trim();
  const description = String(req.body.description ?? '').trim();

  if (!appreciationCategory) {
    throw createHttpError(400, 'appreciationCategory is required');
  }
  if (appreciationTitle.length < 3) {
    throw createHttpError(400, 'appreciationTitle must be at least 3 characters');
  }
  if (description.length < 5) {
    throw createHttpError(400, 'description must be at least 5 characters');
  }

  let approverUserId = String(req.body.approverUserId ?? '').trim();
  if (!approverUserId) {
    const defaultApprover = await UserModel.findOne({
      organization: organizationId,
      isActive: true,
      role: { $in: Array.from(hrManagerRoles) },
      _id: { $ne: userId }
    })
      .sort({ role: 1, name: 1 })
      .select({ _id: 1 })
      .lean();
    approverUserId = defaultApprover?._id ? String(defaultApprover._id) : '';
  }

  if (action === 'submit' && !approverUserId) {
    throw createHttpError(400, 'Please select approver HR manager before submit');
  }

  if (approverUserId) {
    const approverUser = await resolveUserIfValid({
      organizationId,
      userId: approverUserId,
      errorMessage: 'Approver user not found'
    });

    if (!hrManagerRoles.has(String(approverUser.role ?? ''))) {
      throw createHttpError(400, 'Approver must be HR/Admin user');
    }
  }

  const requestId = String(req.body.requestId ?? '').trim();
  let row: any;
  if (requestId) {
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      throw createHttpError(400, 'Invalid appreciation request id');
    }

    row = await AppreciationRequestModel.findOne({
      _id: requestId,
      organization: organizationId,
      requestedBy: userId
    }).exec();
    if (!row) {
      throw createHttpError(404, 'Appreciation request not found');
    }
    if (row.status !== 'pending') {
      throw createHttpError(400, 'Only pending request can be edited');
    }
  } else {
    row = new AppreciationRequestModel({
      organization: organizationId,
      employee: currentEmployee._id,
      requestedBy: userId,
      auditTrail: [buildAuditRow({ action: 'created', byUser: userId, comment: 'Draft created' })]
    });
  }

  row.appreciationToUser = new mongoose.Types.ObjectId(appreciationToUserId);
  row.appreciationToEmployee = targetEmployee?._id ? new mongoose.Types.ObjectId(String(targetEmployee._id)) : null;
  row.appreciationCategory = appreciationCategory;
  row.appreciationTitle = appreciationTitle;
  row.description = description;
  row.approverUser = approverUserId && mongoose.Types.ObjectId.isValid(approverUserId)
    ? new mongoose.Types.ObjectId(approverUserId)
    : null;
  row.status = action === 'submit' ? 'submitted' : 'pending';
  row.submittedAt = action === 'submit' ? new Date() : null;
  row.decidedAt = null;
  row.decidedBy = null;
  row.decisionComment = '';
  row.auditTrail.push(
    buildAuditRow({
      action: action === 'submit' ? 'submitted' : 'saved',
      byUser: userId,
      comment: appreciationTitle
    })
  );
  await row.save();

  const populated = await populateAppreciationRequest(organizationId, String(row._id));

  res.status(requestId ? 200 : 201).json({
    success: true,
    message: action === 'submit' ? 'Appreciation request submitted' : 'Appreciation request saved',
    data: mapAppreciationPayload(populated)
  });
});

export const listAppreciationRequests = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, userId } = requireTenantAndUser(req);
  const scope = String(req.query.scope ?? 'mine').trim().toLowerCase();
  const status = parseAppreciationStatus(req.query.status);
  const dateRange = parseDateRangeFilter(req);

  const query: Record<string, unknown> = {
    organization: organizationId
  };

  if (scope === 'assigned') {
    requireApproverRole(req);
    query.approverUser = userId;
    if (status === 'all') {
      query.status = 'submitted';
    }
  } else if (scope === 'all') {
    requireApproverRole(req);
  } else {
    query.requestedBy = userId;
  }

  if (status !== 'all') {
    query.status = status;
  }

  if (dateRange) {
    query.createdAt = dateRange;
  }

  const rows = await AppreciationRequestModel.find(query)
    .populate('employee', 'firstName lastName employeeCode')
    .populate('requestedBy', 'name email role')
    .populate('appreciationToUser', 'name email role')
    .populate('appreciationToEmployee', 'firstName lastName employeeCode')
    .populate('approverUser', 'name email role')
    .populate('decidedBy', 'name email role')
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: rows.map((row) => mapAppreciationPayload(row))
  });
});

export const cancelAppreciationRequest = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, userId } = requireTenantAndUser(req);
  const requestId = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw createHttpError(400, 'Invalid appreciation request id');
  }

  const row = await AppreciationRequestModel.findOne({
    _id: requestId,
    organization: organizationId,
    requestedBy: userId
  }).exec();

  if (!row) {
    throw createHttpError(404, 'Appreciation request not found');
  }

  if (!['pending', 'submitted'].includes(String(row.status))) {
    throw createHttpError(400, 'Only pending/submitted request can be cancelled');
  }

  const comment = String(req.body.comment ?? '').trim();
  row.status = 'cancelled';
  row.decidedAt = new Date();
  row.decidedBy = new mongoose.Types.ObjectId(userId);
  row.decisionComment = comment;
  row.auditTrail.push(buildAuditRow({ action: 'cancelled', byUser: userId, comment }));
  await row.save();

  res.json({
    success: true,
    message: 'Appreciation request cancelled'
  });
});

const applyAppreciationDecision = async (params: {
  req: Request;
  approve: boolean;
}): Promise<any> => {
  const { organizationId, userId } = requireTenantAndUser(params.req);
  const requestId = String(params.req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw createHttpError(400, 'Invalid appreciation request id');
  }

  const row = await AppreciationRequestModel.findOne({
    _id: requestId,
    organization: organizationId
  }).exec();

  if (!row) {
    throw createHttpError(404, 'Appreciation request not found');
  }
  if (row.status !== 'submitted') {
    throw createHttpError(400, 'Only submitted request can be approved/rejected');
  }

  const approverUserId = String(row.approverUser ?? '');
  if (!approverUserId) {
    throw createHttpError(400, 'No approver configured for this request');
  }

  ensureCanActAsApprover({
    req: params.req,
    approverUserId,
    errorMessage: 'Only assigned approver can process this request'
  });

  const comment = String(params.req.body.comment ?? '').trim();
  row.status = params.approve ? 'approved' : 'rejected';
  row.decidedAt = new Date();
  row.decidedBy = new mongoose.Types.ObjectId(userId);
  row.decisionComment = comment;
  row.auditTrail.push(
    buildAuditRow({
      action: params.approve ? 'approved' : 'rejected',
      byUser: userId,
      comment
    })
  );
  await row.save();

  return populateAppreciationRequest(organizationId, requestId);
};

export const approveAppreciationRequest = asyncHandler(async (req: Request, res: Response) => {
  const row = await applyAppreciationDecision({ req, approve: true });
  res.json({
    success: true,
    message: 'Appreciation request approved',
    data: mapAppreciationPayload(row)
  });
});

export const rejectAppreciationRequest = asyncHandler(async (req: Request, res: Response) => {
  const row = await applyAppreciationDecision({ req, approve: false });
  res.json({
    success: true,
    message: 'Appreciation request rejected',
    data: mapAppreciationPayload(row)
  });
});

const populateResignationRequest = async (organizationId: string, requestId: string): Promise<any> => {
  const row = await ResignationRequestModel.findOne({
    _id: requestId,
    organization: organizationId
  })
    .populate('employee', 'firstName lastName employeeCode')
    .populate('requestedBy', 'name email role')
    .populate('reportingManagerUser', 'name email role')
    .populate('hrManagerUser', 'name email role')
    .populate('decidedBy', 'name email role')
    .lean();

  if (!row) {
    throw createHttpError(404, 'Resignation note not found');
  }

  return row;
};

export const createResignationRequest = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, userId } = requireTenantAndUser(req);
  const currentEmployee = await resolveEmployeeForAuthenticatedUser(req);

  const dateOfResignation = parseIsoDateStrict(
    req.body.dateOfResignation ?? DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-LL-dd'),
    'dateOfResignation'
  );
  const noticePeriodDaysRaw = Number(req.body.noticePeriodDays ?? 90);
  const noticePeriodDays = Number.isFinite(noticePeriodDaysRaw) && noticePeriodDaysRaw >= 0
    ? Math.floor(noticePeriodDaysRaw)
    : 90;
  const lastDateAsPerPolicy = DateTime.fromISO(dateOfResignation, { zone: 'Asia/Kolkata' })
    .plus({ days: noticePeriodDays })
    .toFormat('yyyy-LL-dd');
  const expectedLastDate = parseIsoDateStrict(
    req.body.expectedLastDate ?? lastDateAsPerPolicy,
    'expectedLastDate'
  );
  const reasonForExit = String(req.body.reasonForExit ?? '').trim();
  const description = String(req.body.description ?? '').trim();

  if (!reasonForExit) {
    throw createHttpError(400, 'reasonForExit is required');
  }
  if (description.length < 5) {
    throw createHttpError(400, 'description must be at least 5 characters');
  }

  let hrManagerUserId = String(req.body.hrManagerUserId ?? '').trim();
  if (!hrManagerUserId) {
    const defaultHr = await UserModel.findOne({
      organization: organizationId,
      isActive: true,
      role: { $in: Array.from(hrManagerRoles) },
      _id: { $ne: userId }
    })
      .sort({ role: 1, name: 1 })
      .select({ _id: 1 })
      .lean();
    hrManagerUserId = defaultHr?._id ? String(defaultHr._id) : '';
  }

  if (hrManagerUserId) {
    const hrUser = await resolveUserIfValid({
      organizationId,
      userId: hrManagerUserId,
      errorMessage: 'HR manager user not found'
    });
    if (!hrManagerRoles.has(String(hrUser.role ?? ''))) {
      throw createHttpError(400, 'HR manager must be HR/Admin user');
    }
  }

  const row = await ResignationRequestModel.create({
    organization: organizationId,
    employee: currentEmployee._id,
    requestedBy: userId,
    dateOfResignation,
    noticePeriodDays,
    lastDateAsPerPolicy,
    expectedLastDate,
    reportingManagerUser: currentEmployee.managerUser ? new mongoose.Types.ObjectId(String(currentEmployee.managerUser)) : null,
    hrManagerUser: hrManagerUserId && mongoose.Types.ObjectId.isValid(hrManagerUserId)
      ? new mongoose.Types.ObjectId(hrManagerUserId)
      : null,
    reasonForExit,
    description,
    status: 'submitted',
    submittedAt: new Date(),
    auditTrail: [buildAuditRow({ action: 'submitted', byUser: userId, comment: reasonForExit })]
  });

  const populated = await populateResignationRequest(organizationId, String(row._id));
  res.status(201).json({
    success: true,
    message: 'Resignation note submitted',
    data: mapResignationPayload(populated)
  });
});

export const listResignationRequests = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, userId } = requireTenantAndUser(req);
  const scope = String(req.query.scope ?? 'mine').trim().toLowerCase();
  const status = parseResignationStatus(req.query.status);
  const dateRange = parseDateRangeFilter(req);

  const query: Record<string, unknown> = {
    organization: organizationId
  };

  if (scope === 'assigned') {
    requireApproverRole(req);
    query.$or = [{ hrManagerUser: userId }, { reportingManagerUser: userId }];
    if (status === 'all') {
      query.status = 'submitted';
    }
  } else if (scope === 'all') {
    requireApproverRole(req);
  } else {
    query.requestedBy = userId;
  }

  if (status !== 'all') {
    query.status = status;
  }

  if (dateRange) {
    query.createdAt = dateRange;
  }

  const rows = await ResignationRequestModel.find(query)
    .populate('employee', 'firstName lastName employeeCode')
    .populate('requestedBy', 'name email role')
    .populate('reportingManagerUser', 'name email role')
    .populate('hrManagerUser', 'name email role')
    .populate('decidedBy', 'name email role')
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: rows.map((row) => mapResignationPayload(row))
  });
});

export const cancelResignationRequest = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, userId } = requireTenantAndUser(req);
  const requestId = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw createHttpError(400, 'Invalid resignation request id');
  }

  const row = await ResignationRequestModel.findOne({
    _id: requestId,
    organization: organizationId,
    requestedBy: userId
  }).exec();
  if (!row) {
    throw createHttpError(404, 'Resignation note not found');
  }
  if (row.status !== 'submitted') {
    throw createHttpError(400, 'Only submitted resignation can be cancelled');
  }

  const comment = String(req.body.comment ?? '').trim();
  row.status = 'cancelled';
  row.decidedAt = new Date();
  row.decidedBy = new mongoose.Types.ObjectId(userId);
  row.decisionComment = comment;
  row.auditTrail.push(buildAuditRow({ action: 'cancelled', byUser: userId, comment }));
  await row.save();

  res.json({
    success: true,
    message: 'Resignation note cancelled'
  });
});

const applyResignationDecision = async (params: {
  req: Request;
  approve: boolean;
}): Promise<any> => {
  const { organizationId, userId } = requireTenantAndUser(params.req);
  const requestId = String(params.req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw createHttpError(400, 'Invalid resignation request id');
  }

  const row = await ResignationRequestModel.findOne({
    _id: requestId,
    organization: organizationId
  }).exec();
  if (!row) {
    throw createHttpError(404, 'Resignation note not found');
  }
  if (row.status !== 'submitted') {
    throw createHttpError(400, 'Only submitted resignation can be approved/rejected');
  }

  const role = String(params.req.user?.role ?? '');
  const reportingManagerUserId = String(row.reportingManagerUser ?? '');
  const hrManagerUserId = String(row.hrManagerUser ?? '');
  const canPrivileged = privilegedApproverRoles.has(role);
  const canAsReportingManager = reportingManagerUserId && reportingManagerUserId === userId;
  const canAsHrManager = hrManagerUserId && hrManagerUserId === userId;

  if (!canPrivileged && !canAsReportingManager && !canAsHrManager) {
    throw createHttpError(403, 'Only reporting manager/HR manager can process this resignation');
  }

  const comment = String(params.req.body.comment ?? '').trim();
  row.status = params.approve ? 'approved' : 'rejected';
  row.decidedAt = new Date();
  row.decidedBy = new mongoose.Types.ObjectId(userId);
  row.decisionComment = comment;
  row.auditTrail.push(
    buildAuditRow({
      action: params.approve ? 'approved' : 'rejected',
      byUser: userId,
      comment
    })
  );
  await row.save();

  return populateResignationRequest(organizationId, requestId);
};

export const approveResignationRequest = asyncHandler(async (req: Request, res: Response) => {
  const row = await applyResignationDecision({ req, approve: true });
  res.json({
    success: true,
    message: 'Resignation note approved',
    data: mapResignationPayload(row)
  });
});

export const rejectResignationRequest = asyncHandler(async (req: Request, res: Response) => {
  const row = await applyResignationDecision({ req, approve: false });
  res.json({
    success: true,
    message: 'Resignation note rejected',
    data: mapResignationPayload(row)
  });
});

const populateLeaveEncashmentRequest = async (organizationId: string, requestId: string): Promise<any> => {
  const row = await LeaveEncashmentRequestModel.findOne({
    _id: requestId,
    organization: organizationId
  })
    .populate('employee', 'firstName lastName employeeCode')
    .populate('requestedBy', 'name email role')
    .populate('approverUser', 'name email role')
    .populate('decidedBy', 'name email role')
    .lean();

  if (!row) {
    throw createHttpError(404, 'Leave encashment request not found');
  }

  return row;
};

export const createLeaveEncashmentRequest = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, userId } = requireTenantAndUser(req);
  const currentEmployee = await resolveEmployeeForAuthenticatedUser(req);

  const action = parseAction(req.body.action);
  const leaveType = parseLeaveEncashmentLeaveType(req.body.leaveType);
  const daysToEncash = Number(req.body.daysToEncash ?? 0);
  if (!Number.isFinite(daysToEncash) || daysToEncash <= 0) {
    throw createHttpError(400, 'daysToEncash must be a positive number');
  }

  const purpose = String(req.body.purpose ?? '').trim();
  if (purpose.length < 5) {
    throw createHttpError(400, 'purpose must be at least 5 characters');
  }

  let approverUserId = String(req.body.approverUserId ?? '').trim();
  if (!approverUserId) {
    const defaultApprover = await UserModel.findOne({
      organization: organizationId,
      isActive: true,
      role: { $in: Array.from(hrManagerRoles) },
      _id: { $ne: userId }
    })
      .sort({ role: 1, name: 1 })
      .select({ _id: 1 })
      .lean();
    approverUserId = defaultApprover?._id ? String(defaultApprover._id) : '';
  }

  if (action === 'submit' && !approverUserId) {
    throw createHttpError(400, 'Please select HR manager before submit');
  }

  if (approverUserId) {
    const approverUser = await resolveUserIfValid({
      organizationId,
      userId: approverUserId,
      errorMessage: 'Approver user not found'
    });

    if (!hrManagerRoles.has(String(approverUser.role ?? ''))) {
      throw createHttpError(400, 'Approver must be HR/Admin user');
    }
  }

  const requestId = String(req.body.requestId ?? '').trim();
  const meta = await getLeaveEncashmentCurrentYearMeta({
    organizationId,
    employeeId: String(currentEmployee._id),
    leaveType,
    excludeRequestId: requestId || undefined
  });

  const availableToEncash = Number(
    Math.max(0, Math.min(meta.leaveBalance, leaveEncashmentYearlyCap - meta.encashedDaysCurrentYear)).toFixed(2)
  );

  if (action === 'submit' && daysToEncash > availableToEncash) {
    throw createHttpError(
      400,
      `Days to encash exceeds available balance (${availableToEncash.toFixed(2)})`
    );
  }

  let row: any;
  if (requestId) {
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      throw createHttpError(400, 'Invalid leave encashment request id');
    }

    row = await LeaveEncashmentRequestModel.findOne({
      _id: requestId,
      organization: organizationId,
      requestedBy: userId
    }).exec();

    if (!row) {
      throw createHttpError(404, 'Leave encashment request not found');
    }
    if (row.status !== 'pending') {
      throw createHttpError(400, 'Only pending request can be edited');
    }
  } else {
    row = new LeaveEncashmentRequestModel({
      organization: organizationId,
      employee: currentEmployee._id,
      requestedBy: userId,
      auditTrail: [buildAuditRow({ action: 'created', byUser: userId, comment: 'Draft created' })]
    });
  }

  row.leaveType = leaveType;
  row.daysToEncash = Number(daysToEncash.toFixed(2));
  row.approverUser = approverUserId && mongoose.Types.ObjectId.isValid(approverUserId)
    ? new mongoose.Types.ObjectId(approverUserId)
    : null;
  row.purpose = purpose;
  row.encashableDaysPerYear = leaveEncashmentYearlyCap;
  row.encashedDaysCurrentYear = meta.encashedDaysCurrentYear;
  row.currentLeaveBalance = meta.leaveBalance;
  row.status = action === 'submit' ? 'submitted' : 'pending';
  row.submittedAt = action === 'submit' ? new Date() : null;
  row.decidedAt = null;
  row.decidedBy = null;
  row.decisionComment = '';
  row.auditTrail.push(
    buildAuditRow({
      action: action === 'submit' ? 'submitted' : 'saved',
      byUser: userId,
      comment: purpose
    })
  );
  await row.save();

  const populated = await populateLeaveEncashmentRequest(organizationId, String(row._id));
  res.status(requestId ? 200 : 201).json({
    success: true,
    message: action === 'submit' ? 'Leave encashment request submitted' : 'Leave encashment request saved',
    data: mapLeaveEncashmentPayload(populated)
  });
});

export const listLeaveEncashmentRequests = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, userId } = requireTenantAndUser(req);
  const scope = String(req.query.scope ?? 'mine').trim().toLowerCase();
  const status = parseLeaveEncashmentStatus(req.query.status);
  const dateRange = parseDateRangeFilter(req);

  const query: Record<string, unknown> = {
    organization: organizationId
  };

  if (scope === 'assigned') {
    requireApproverRole(req);
    query.approverUser = userId;
    if (status === 'all') {
      query.status = 'submitted';
    }
  } else if (scope === 'all') {
    requireApproverRole(req);
  } else {
    query.requestedBy = userId;
  }

  if (status !== 'all') {
    query.status = status;
  }

  if (dateRange) {
    query.createdAt = dateRange;
  }

  const rows = await LeaveEncashmentRequestModel.find(query)
    .populate('employee', 'firstName lastName employeeCode')
    .populate('requestedBy', 'name email role')
    .populate('approverUser', 'name email role')
    .populate('decidedBy', 'name email role')
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: rows.map((row) => mapLeaveEncashmentPayload(row))
  });
});

export const cancelLeaveEncashmentRequest = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, userId } = requireTenantAndUser(req);
  const requestId = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw createHttpError(400, 'Invalid leave encashment request id');
  }

  const row = await LeaveEncashmentRequestModel.findOne({
    _id: requestId,
    organization: organizationId,
    requestedBy: userId
  }).exec();
  if (!row) {
    throw createHttpError(404, 'Leave encashment request not found');
  }
  if (!['pending', 'submitted'].includes(String(row.status))) {
    throw createHttpError(400, 'Only pending/submitted request can be cancelled');
  }

  const comment = String(req.body.comment ?? '').trim();
  row.status = 'cancelled';
  row.decidedAt = new Date();
  row.decidedBy = new mongoose.Types.ObjectId(userId);
  row.decisionComment = comment;
  row.auditTrail.push(buildAuditRow({ action: 'cancelled', byUser: userId, comment }));
  await row.save();

  res.json({
    success: true,
    message: 'Leave encashment request cancelled'
  });
});

const applyLeaveEncashmentDecision = async (params: {
  req: Request;
  approve: boolean;
}): Promise<any> => {
  const { organizationId, userId } = requireTenantAndUser(params.req);
  const requestId = String(params.req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw createHttpError(400, 'Invalid leave encashment request id');
  }

  const row = await LeaveEncashmentRequestModel.findOne({
    _id: requestId,
    organization: organizationId
  }).exec();
  if (!row) {
    throw createHttpError(404, 'Leave encashment request not found');
  }
  if (row.status !== 'submitted') {
    throw createHttpError(400, 'Only submitted request can be approved/rejected');
  }

  const approverUserId = String(row.approverUser ?? '');
  if (!approverUserId) {
    throw createHttpError(400, 'No approver configured for this request');
  }

  ensureCanActAsApprover({
    req: params.req,
    approverUserId,
    errorMessage: 'Only assigned approver can process this request'
  });

  if (params.approve) {
    const meta = await getLeaveEncashmentCurrentYearMeta({
      organizationId,
      employeeId: String(row.employee),
      leaveType: row.leaveType as LeaveEncashmentLeaveTypeCode,
      excludeRequestId: requestId
    });

    const availableToEncash = Math.max(
      0,
      Math.min(meta.leaveBalance, leaveEncashmentYearlyCap - meta.encashedDaysCurrentYear)
    );
    if (Number(row.daysToEncash ?? 0) > availableToEncash) {
      throw createHttpError(
        400,
        `Leave balance changed. Available to encash is ${availableToEncash.toFixed(2)}`
      );
    }
  }

  const comment = String(params.req.body.comment ?? '').trim();
  row.status = params.approve ? 'approved' : 'rejected';
  row.decidedAt = new Date();
  row.decidedBy = new mongoose.Types.ObjectId(userId);
  row.decisionComment = comment;
  row.auditTrail.push(
    buildAuditRow({
      action: params.approve ? 'approved' : 'rejected',
      byUser: userId,
      comment
    })
  );
  await row.save();

  return populateLeaveEncashmentRequest(organizationId, requestId);
};

export const approveLeaveEncashmentRequest = asyncHandler(async (req: Request, res: Response) => {
  const row = await applyLeaveEncashmentDecision({ req, approve: true });
  res.json({
    success: true,
    message: 'Leave encashment request approved',
    data: mapLeaveEncashmentPayload(row)
  });
});

export const rejectLeaveEncashmentRequest = asyncHandler(async (req: Request, res: Response) => {
  const row = await applyLeaveEncashmentDecision({ req, approve: false });
  res.json({
    success: true,
    message: 'Leave encashment request rejected',
    data: mapLeaveEncashmentPayload(row)
  });
});
