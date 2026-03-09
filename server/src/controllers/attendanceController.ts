import type { Request, Response } from 'express';
import createHttpError from 'http-errors';
import mongoose from 'mongoose';
import { DateTime } from 'luxon';

import { AttendancePunchModel } from '../models/AttendancePunch';
import { AttendanceLeaveLedgerModel } from '../models/AttendanceLeaveLedger';
import { AttendanceLeaveRequestModel } from '../models/AttendanceLeaveRequest';
import { AttendanceRegularizationModel } from '../models/AttendanceRegularization';
import { AttendanceSettingsModel } from '../models/AttendanceSettings';
import { EmployeeModel } from '../models/Employee';
import { OfficeLocationModel } from '../models/OfficeLocation';
import { OrganizationModel } from '../models/Organization';
import { UserModel } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { getDefaultAttendanceSettings } from '../config/defaultAttendanceSettings';
import { calculateWorkingHours, getDayRange, getMonthRange, parseHHmm } from '../utils/dateTimeUtils';
import { exportRows, type ExportFormat } from '../utils/exportUtils';
import { dispatchAttendanceNotification } from '../services/attendance/attendanceNotificationService';
import { getAttendanceColorIndicator } from '../utils/attendanceColorUtils';
import {
  buildAttendanceDaySummaries,
  getCurrentOccupancy,
  resolveEmployeeContextForUser
} from '../services/attendance/attendanceQueryService';
import {
  ensureDefaultCompanyAttendanceSettings,
  getAttendanceSettingsById,
  getEffectiveAttendanceSettings,
  listAttendanceSettingsForOrganization
} from '../services/attendance/attendanceSettingsService';
import { importAttendancePunches, parseCsvPunchRows } from '../services/attendance/bulkImportService';
import { runMainPunchValidation } from '../services/attendance/punchValidationService';
import {
  buildDailyAttendanceReport,
  buildDepartmentWiseAttendance,
  buildDistanceTravelReport,
  buildInvalidPunchMapReport,
  buildLateArrivalTrend,
  buildMonthlyAttendanceSummary,
  buildPunchSourceAnalysis
} from '../services/attendance/reportService';
import { emitLivePunchEvent, emitOccupancyEvent } from '../services/attendance/realtimeService';
import type { PunchSource, PunchType } from '../types/attendance';

const attendanceAdminRoles = new Set(['super_admin', 'admin', 'hr']);
const attendanceApproverRoles = new Set(['super_admin', 'admin', 'hr', 'manager']);
const leaveTypeValues = ['PL', 'CL', 'SL', 'OH'] as const;
const leaveRequestTypeValues = [
  'CL',
  'HCL',
  'HPL',
  'PL',
  'HSL',
  'SL',
  'COF',
  'HCO',
  'HOD',
  'OD',
  'OH',
  'HWFH',
  'WFH',
  'SPL'
] as const;
const halfDayLeaveRequestTypeValues = ['HCL', 'HPL', 'HSL', 'HCO', 'HOD', 'HWFH'] as const;
const leaveRequestStatusValues = ['pending', 'submitted', 'approved', 'rejected', 'cancelled'] as const;
const leaveDurationTypeValues = ['full_day', 'first_half', 'second_half'] as const;
type LeaveTypeCode = (typeof leaveTypeValues)[number];
type LeaveRequestTypeCode = (typeof leaveRequestTypeValues)[number];
type HalfDayLeaveRequestTypeCode = (typeof halfDayLeaveRequestTypeValues)[number];
type LeaveRequestStatusCode = (typeof leaveRequestStatusValues)[number];
type LeaveDurationTypeCode = (typeof leaveDurationTypeValues)[number];

const openingBalanceFallbacks: Record<LeaveTypeCode, number> = {
  PL: 9.75,
  CL: 8,
  SL: 7,
  OH: 2
};

const monthlyCreditFallbacks: Record<LeaveTypeCode, number> = {
  PL: 1.25,
  CL: 0,
  SL: 0,
  OH: 0
};

const defaultUserPunchWindow = {
  punchInStartTime: '09:00',
  punchInEndTime: '10:00',
  punchOutStartTime: '17:00',
  punchOutEndTime: '19:00'
} as const;

type UserPunchWindow = {
  punchInStartTime: string;
  punchInEndTime: string;
  punchOutStartTime: string;
  punchOutEndTime: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const normalizeUserPunchWindow = (rawWindow: unknown): UserPunchWindow => {
  const source = isRecord(rawWindow) ? rawWindow : {};

  const punchInStartTime = String(source.punchInStartTime ?? defaultUserPunchWindow.punchInStartTime)
    .trim()
    .slice(0, 5);
  const punchInEndTime = String(source.punchInEndTime ?? defaultUserPunchWindow.punchInEndTime)
    .trim()
    .slice(0, 5);
  const punchOutStartTime = String(source.punchOutStartTime ?? defaultUserPunchWindow.punchOutStartTime)
    .trim()
    .slice(0, 5);
  const punchOutEndTime = String(source.punchOutEndTime ?? defaultUserPunchWindow.punchOutEndTime)
    .trim()
    .slice(0, 5);

  try {
    const inStartMinutes = parseHHmm(punchInStartTime);
    const inEndMinutes = parseHHmm(punchInEndTime);
    const outStartMinutes = parseHHmm(punchOutStartTime);
    const outEndMinutes = parseHHmm(punchOutEndTime);

    const inStartTotal = inStartMinutes.hour * 60 + inStartMinutes.minute;
    const inEndTotal = inEndMinutes.hour * 60 + inEndMinutes.minute;
    const outStartTotal = outStartMinutes.hour * 60 + outStartMinutes.minute;
    const outEndTotal = outEndMinutes.hour * 60 + outEndMinutes.minute;

    if (inStartTotal >= inEndTotal || outStartTotal >= outEndTotal) {
      return {
        ...defaultUserPunchWindow
      };
    }
  } catch {
    return {
      ...defaultUserPunchWindow
    };
  }

  return {
    punchInStartTime,
    punchInEndTime,
    punchOutStartTime,
    punchOutEndTime
  };
};

const pickFiniteNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const resolveMonthFromName = (rawValue: unknown): number => {
  const monthRaw = String(rawValue ?? '').trim();
  if (!monthRaw) {
    return 1;
  }

  const fullMatch = DateTime.fromFormat(monthRaw, 'LLLL');
  if (fullMatch.isValid && fullMatch.month) {
    return fullMatch.month;
  }

  const shortMatch = DateTime.fromFormat(monthRaw, 'LLL');
  if (shortMatch.isValid && shortMatch.month) {
    return shortMatch.month;
  }

  return 1;
};

const resolveLeaveAccrualDefaults = async (organizationId: string): Promise<{
  openingBalances: Record<LeaveTypeCode, number>;
  monthlyCredit: Record<LeaveTypeCode, number>;
  leaveYearStartMonth: number;
}> => {
  const organization = await OrganizationModel.findById(organizationId)
    .select({ settings: 1 })
    .lean();

  const settings = isRecord(organization?.settings) ? organization.settings : {};
  const leaveManagement = isRecord(settings.leaveManagement) ? settings.leaveManagement : {};
  const generalLeaveSettings = isRecord(leaveManagement.generalLeaveSettings)
    ? leaveManagement.generalLeaveSettings
    : {};
  const leaveAccrualDefaults = isRecord(leaveManagement.leaveAccrualDefaults)
    ? leaveManagement.leaveAccrualDefaults
    : {};
  const openingBalancesRaw = isRecord(leaveAccrualDefaults.openingBalances)
    ? leaveAccrualDefaults.openingBalances
    : {};
  const monthlyCreditRaw = isRecord(leaveAccrualDefaults.monthlyCredit)
    ? leaveAccrualDefaults.monthlyCredit
    : {};

  const openingBalances: Record<LeaveTypeCode, number> = {
    PL:
      pickFiniteNumber(
        openingBalancesRaw.PL,
        openingBalancesRaw.privilegeLeave,
        openingBalancesRaw.earnedLeave
      ) ?? openingBalanceFallbacks.PL,
    CL:
      pickFiniteNumber(openingBalancesRaw.CL, openingBalancesRaw.casualLeave) ??
      openingBalanceFallbacks.CL,
    SL:
      pickFiniteNumber(openingBalancesRaw.SL, openingBalancesRaw.sickLeave) ??
      openingBalanceFallbacks.SL,
    OH:
      pickFiniteNumber(openingBalancesRaw.OH, openingBalancesRaw.optionalHoliday) ??
      openingBalanceFallbacks.OH,
  };

  const monthlyCredit: Record<LeaveTypeCode, number> = {
    PL:
      pickFiniteNumber(
        monthlyCreditRaw.PL,
        monthlyCreditRaw.privilegeLeave,
        monthlyCreditRaw.earnedLeave
      ) ?? monthlyCreditFallbacks.PL,
    CL:
      pickFiniteNumber(monthlyCreditRaw.CL, monthlyCreditRaw.casualLeave) ??
      monthlyCreditFallbacks.CL,
    SL:
      pickFiniteNumber(monthlyCreditRaw.SL, monthlyCreditRaw.sickLeave) ??
      monthlyCreditFallbacks.SL,
    OH:
      pickFiniteNumber(monthlyCreditRaw.OH, monthlyCreditRaw.optionalHoliday) ??
      monthlyCreditFallbacks.OH,
  };

  const leaveYearStartMonth = resolveMonthFromName(generalLeaveSettings.leaveYearStartMonth);

  return {
    openingBalances,
    monthlyCredit,
    leaveYearStartMonth,
  };
};

const parseYear = (rawValue: unknown): number => {
  const year = Number(rawValue);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw createHttpError(400, 'year must be between 2000 and 2100');
  }

  return year;
};

const parseLeaveType = (rawValue: unknown): LeaveTypeCode => {
  const value = String(rawValue ?? 'PL').trim().toUpperCase();

  if (!leaveTypeValues.includes(value as LeaveTypeCode)) {
    throw createHttpError(400, 'leaveType must be one of PL/CL/SL/OH');
  }

  return value as LeaveTypeCode;
};

const parseLeaveRequestType = (rawValue: unknown): LeaveRequestTypeCode => {
  const value = String(rawValue ?? 'PL').trim().toUpperCase();

  if (!leaveRequestTypeValues.includes(value as LeaveRequestTypeCode)) {
    throw createHttpError(
      400,
      'leaveType must be one of CL/HCL/HPL/PL/HSL/SL/COF/HCO/HOD/OD/OH/HWFH/WFH/SPL'
    );
  }

  return value as LeaveRequestTypeCode;
};

const parseLeaveDurationType = (rawValue: unknown): LeaveDurationTypeCode => {
  const value = String(rawValue ?? 'full_day').trim().toLowerCase();
  if (!leaveDurationTypeValues.includes(value as LeaveDurationTypeCode)) {
    throw createHttpError(400, 'durationType must be full_day/first_half/second_half');
  }

  return value as LeaveDurationTypeCode;
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

const buildLeaveDateSlices = (params: {
  fromDate: string;
  toDate: string;
  leaveType: LeaveRequestTypeCode;
  durationType: LeaveDurationTypeCode;
}): Array<{ dateIso: string; units: number }> => {
  const start = DateTime.fromISO(params.fromDate, { zone: 'Asia/Kolkata' }).startOf('day');
  const end = DateTime.fromISO(params.toDate, { zone: 'Asia/Kolkata' }).startOf('day');

  if (!start.isValid || !end.isValid) {
    throw createHttpError(400, 'fromDate/toDate is invalid');
  }

  if (end < start) {
    throw createHttpError(400, 'toDate must be greater than or equal to fromDate');
  }

  const isHalfDayType = halfDayLeaveRequestTypeValues.includes(
    params.leaveType as HalfDayLeaveRequestTypeCode
  );
  const isHalfDayDuration = params.durationType !== 'full_day';
  const useHalfDay = isHalfDayType || isHalfDayDuration;

  if (useHalfDay && start.toISODate() !== end.toISODate()) {
    throw createHttpError(400, 'Half day leave is allowed only for a single date');
  }

  if (!useHalfDay) {
    const slices: Array<{ dateIso: string; units: number }> = [];
    let cursor = start;
    while (cursor <= end) {
      slices.push({
        dateIso: cursor.toFormat('yyyy-LL-dd'),
        units: 1
      });
      cursor = cursor.plus({ days: 1 });
    }
    return slices;
  }

  return [
    {
      dateIso: start.toFormat('yyyy-LL-dd'),
      units: 0.5
    }
  ];
};

const resolveLedgerLeaveType = (leaveType: LeaveRequestTypeCode): LeaveTypeCode | null => {
  if (leaveType === 'CL' || leaveType === 'HCL') {
    return 'CL';
  }

  if (leaveType === 'PL' || leaveType === 'HPL') {
    return 'PL';
  }

  if (leaveType === 'SL' || leaveType === 'HSL') {
    return 'SL';
  }

  if (leaveType === 'OH') {
    return 'OH';
  }

  return null;
};

const formatLeaveRequestDate = (isoDate: string): string => {
  const parsed = DateTime.fromISO(isoDate, { zone: 'Asia/Kolkata' });
  if (!parsed.isValid) {
    return isoDate;
  }

  return parsed.toFormat('dd-LLL-yy');
};

const buildDefaultMonthlyRows = (year: number, leaveType: LeaveTypeCode): Array<{
  month: number;
  days: number;
  credit: number;
  availed: number;
  availedDates: Date[];
}> => {
  const rows: Array<{
    month: number;
    days: number;
    credit: number;
    availed: number;
    availedDates: Date[];
  }> = [];

  const fallbackCredit = monthlyCreditFallbacks[leaveType] ?? 0;

  for (let month = 1; month <= 12; month += 1) {
    const monthStart = DateTime.fromObject({ year, month, day: 1 });
    rows.push({
      month,
      days: monthStart.daysInMonth ?? 30,
      credit: fallbackCredit,
      availed: 0,
      availedDates: []
    });
  }

  return rows;
};

const ensureLeaveLedgerDocument = async (params: {
  organizationId: string;
  employeeId: string;
  leaveType: LeaveTypeCode;
  year: number;
}) => {
  const existing = await AttendanceLeaveLedgerModel.findOne({
    organization: params.organizationId,
    employee: params.employeeId,
    leaveType: params.leaveType,
    year: params.year
  }).lean();

  if (existing) {
    return existing;
  }

  const defaults = await resolveLeaveAccrualDefaults(params.organizationId);
  const openingBalanceDate = DateTime.fromObject({
    year: params.year,
    month: defaults.leaveYearStartMonth,
    day: 1
  }).toJSDate();

  const monthlyRows = buildDefaultMonthlyRows(params.year, params.leaveType).map((row) => ({
    ...row,
    credit: defaults.monthlyCredit[params.leaveType] ?? row.credit,
  }));

  const created = await AttendanceLeaveLedgerModel.create({
    organization: params.organizationId,
    employee: params.employeeId,
    leaveType: params.leaveType,
    year: params.year,
    openingBalance: defaults.openingBalances[params.leaveType] ?? openingBalanceFallbacks[params.leaveType],
    openingBalanceDate,
    monthly: monthlyRows
  });

  return created.toObject();
};

const canManageLeaveLedger = (req: Request): boolean => {
  return Boolean(req.user && attendanceApproverRoles.has(req.user.role));
};

const parseLedgerDate = (rawValue: unknown, fieldName: string): Date => {
  const input = String(rawValue ?? '').trim();
  if (!input) {
    throw createHttpError(400, `${fieldName} is required`);
  }

  const isoDate = DateTime.fromISO(input);
  if (isoDate.isValid) {
    return isoDate.toJSDate();
  }

  const displayDate = DateTime.fromFormat(input, 'dd-LLL-yyyy');
  if (displayDate.isValid) {
    return displayDate.toJSDate();
  }

  throw createHttpError(400, `${fieldName} is invalid`);
};

const resolveLedgerEmployee = async (params: {
  req: Request;
  organizationId: string;
  explicitEmployeeId?: unknown;
}): Promise<any> => {
  const requestedEmployeeId = String(params.explicitEmployeeId ?? '').trim();

  if (requestedEmployeeId) {
    if (!mongoose.Types.ObjectId.isValid(requestedEmployeeId)) {
      throw createHttpError(400, 'employeeId is invalid');
    }

    if (!canManageLeaveLedger(params.req)) {
      throw createHttpError(403, 'Only manager/hr/admin can select employeeId');
    }

    const employeeById = await EmployeeModel.findOne({
      _id: requestedEmployeeId,
      organization: params.organizationId
    }).lean();

    if (!employeeById) {
      throw createHttpError(404, 'Employee profile not found');
    }

    return employeeById;
  }

  try {
    const employeeContext = await resolveEmployeeForAuthenticatedUser(params.req);
    const employeeDoc = await EmployeeModel.findOne({
      _id: employeeContext.employeeId,
      organization: params.organizationId
    }).lean();

    if (!employeeDoc) {
      throw createHttpError(404, 'Employee profile not found');
    }

    return employeeDoc;
  } catch (error) {
    if (canManageLeaveLedger(params.req)) {
      throw createHttpError(
        400,
        'employeeId is required for admin/manager users without linked employee profile'
      );
    }

    throw error;
  }
};

const normalizeLeaveLedgerPayload = (params: {
  ledger: any;
  employeeDoc: any;
  leaveType: LeaveTypeCode;
  year: number;
}) => {
  const monthRows = [...(params.ledger.monthly ?? [])]
    .sort((a: any, b: any) => Number(a.month) - Number(b.month))
    .map((item: any) => {
      const monthNumber = Number(item.month);
      const monthLabel = DateTime.fromObject({
        year: params.year,
        month: monthNumber,
        day: 1
      }).toFormat('LLL - yyyy');

      const availedDates = Array.isArray(item.availedDates)
        ? item.availedDates.map((date: Date) =>
            DateTime.fromJSDate(new Date(date)).toFormat('dd-LLL-yyyy')
          )
        : [];

      return {
        month: monthNumber,
        monthLabel,
        days: Number(item.days ?? 0),
        credit: Number(item.credit ?? 0),
        availed: Number(item.availed ?? 0),
        availedDates
      };
    });

  const totalCredit = monthRows.reduce((sum, row) => sum + row.credit, 0);
  const totalAvailed = monthRows.reduce((sum, row) => sum + row.availed, 0);
  const openingBalance = Number(params.ledger.openingBalance ?? 0);
  const ledgerBalance = openingBalance + totalCredit - totalAvailed;

  return {
    employee: {
      employeeId: params.employeeDoc._id.toString(),
      employeeCode: params.employeeDoc.employeeCode,
      employeeName: `${params.employeeDoc.firstName} ${params.employeeDoc.lastName}`.trim()
    },
    leaveType: params.leaveType,
    year: params.year,
    openingBalance,
    openingBalanceDate: DateTime.fromJSDate(new Date(params.ledger.openingBalanceDate)).toFormat(
      'dd-LLL-yyyy'
    ),
    months: monthRows,
    totals: {
      credit: Number(totalCredit.toFixed(2)),
      availed: Number(totalAvailed.toFixed(2))
    },
    balances: {
      ledgerBalance: Number(ledgerBalance.toFixed(2)),
      currentBalance: Number(ledgerBalance.toFixed(2)),
      discrepancy: 0
    }
  };
};

const leaveTypeLabelByCode: Record<LeaveRequestTypeCode, string> = {
  CL: 'Casual Leave',
  HCL: 'Half CL',
  HPL: 'Half PL',
  PL: 'Privilege Leave',
  HSL: 'Half SL',
  SL: 'Sick Leave',
  COF: 'Compensatory Off',
  HCO: 'Half Comp Off',
  HOD: 'Half Outdoor Duty',
  OD: 'Outdoor Duty',
  OH: 'Optional Holiday',
  HWFH: 'Half Day Work From Home',
  WFH: 'Work From Home',
  SPL: 'Special Leave'
};

const mapLeaveRequestPayload = (row: any) => ({
  id: row._id.toString(),
  leaveType: row.leaveType as LeaveRequestTypeCode,
  leaveTypeLabel: leaveTypeLabelByCode[row.leaveType as LeaveRequestTypeCode] ?? row.leaveType,
  durationType: row.durationType as LeaveDurationTypeCode,
  fromDate: row.fromDate,
  toDate: row.toDate,
  fromDateLabel: formatLeaveRequestDate(row.fromDate),
  toDateLabel: formatLeaveRequestDate(row.toDate),
  noOfDays: Number(row.noOfDays ?? 0),
  reason: row.reason ?? '',
  workLocation: row.workLocation ?? '',
  status: row.status as LeaveRequestStatusCode,
  appliedOn: row.createdAt,
  appliedOnLabel: DateTime.fromJSDate(new Date(row.createdAt)).toFormat('dd-LLL-yy'),
  submittedAt: row.submittedAt ?? null,
  decidedAt: row.decidedAt ?? null,
  decisionComment: row.decisionComment ?? '',
  employee: row.employee
    ? {
        id: row.employee._id?.toString?.() ?? String(row.employee._id ?? ''),
        employeeCode: row.employee.employeeCode ?? '',
        name: `${row.employee.firstName ?? ''} ${row.employee.lastName ?? ''}`.trim()
      }
    : null,
  approver: row.approverUser
    ? {
        id: row.approverUser._id?.toString?.() ?? String(row.approverUser._id ?? ''),
        name: row.approverUser.name ?? '',
        email: row.approverUser.email ?? ''
      }
    : null,
  proxyApprover: row.decidedBy
    ? {
        id: row.decidedBy._id?.toString?.() ?? String(row.decidedBy._id ?? ''),
        name: row.decidedBy.name ?? '',
        email: row.decidedBy.email ?? ''
      }
    : null,
  auditTrail: Array.isArray(row.auditTrail)
    ? row.auditTrail.map((audit: any) => ({
        action: String(audit.action ?? ''),
        at: audit.at ?? null,
        comment: String(audit.comment ?? ''),
        byUser: audit.byUser?.toString?.() ?? String(audit.byUser ?? '')
      }))
    : []
});

const applyApprovedLeaveToLedger = async (params: {
  organizationId: string;
  employeeId: string;
  leaveType: LeaveTypeCode;
  fromDate: string;
  toDate: string;
  durationType: LeaveDurationTypeCode;
}): Promise<void> => {
  const slices = buildLeaveDateSlices({
    fromDate: params.fromDate,
    toDate: params.toDate,
    leaveType: params.leaveType,
    durationType: params.durationType
  });

  const ledgerByYear = new Map<number, any>();

  for (const slice of slices) {
    const date = DateTime.fromISO(slice.dateIso, { zone: 'Asia/Kolkata' }).startOf('day');
    const year = date.year;
    const month = date.month;

    let ledger = ledgerByYear.get(year);
    if (!ledger) {
      const ensured = await ensureLeaveLedgerDocument({
        organizationId: params.organizationId,
        employeeId: params.employeeId,
        leaveType: params.leaveType,
        year
      });

      ledger = await AttendanceLeaveLedgerModel.findOne({
        organization: params.organizationId,
        employee: params.employeeId,
        leaveType: params.leaveType,
        year
      }).exec();

      if (!ledger) {
        throw createHttpError(
          500,
          `Unable to update leave ledger for ${params.leaveType} (${ensured?.year ?? year})`
        );
      }

      ledgerByYear.set(year, ledger);
    }

    let monthRow = (ledger.monthly ?? []).find((item: any) => Number(item.month) === month);
    if (!monthRow) {
      monthRow = {
        month,
        days: date.daysInMonth ?? 30,
        credit: 0,
        availed: 0,
        availedDates: []
      };
      ledger.monthly.push(monthRow);
    }

    monthRow.availed = Number(monthRow.availed ?? 0) + slice.units;
    monthRow.availedDates = Array.isArray(monthRow.availedDates) ? monthRow.availedDates : [];
    monthRow.availedDates.push(date.toJSDate());
  }

  for (const ledger of ledgerByYear.values()) {
    ledger.monthly = [...(ledger.monthly ?? [])].sort(
      (a: { month: number }, b: { month: number }) => Number(a.month) - Number(b.month)
    );
    await ledger.save();
  }
};

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

const requireAdminRole = (req: Request): void => {
  if (!req.user || !attendanceAdminRoles.has(req.user.role)) {
    throw createHttpError(403, 'Only hr/admin/super admin can perform this action');
  }
};

const requireApproverRole = (req: Request): void => {
  if (!req.user || !attendanceApproverRoles.has(req.user.role)) {
    throw createHttpError(403, 'Only manager/hr/admin can perform this action');
  }
};

const toWindowMinutes = (hhmm: string): number => {
  const parsed = parseHHmm(hhmm);
  return parsed.hour * 60 + parsed.minute;
};

const isCurrentTimeInWindow = (now: DateTime, startHHmm: string, endHHmm: string): boolean => {
  const minuteOfDay = now.hour * 60 + now.minute;
  const start = toWindowMinutes(startHHmm);
  const end = toWindowMinutes(endHHmm);
  return minuteOfDay >= start && minuteOfDay <= end;
};

const resolveUserPunchWindow = async (params: {
  organizationId: string;
  userId: string;
}): Promise<UserPunchWindow> => {
  const user = await UserModel.findOne({
    _id: params.userId,
    organization: params.organizationId
  })
    .select({ punchWindow: 1 })
    .lean();

  return normalizeUserPunchWindow(user?.punchWindow);
};

const getPhotoPayload = (
  body: Request['body']
): { url: string; mimeType: string; sizeBytes: number; capturedAt: Date | null } => {
  const photo = body.photo ?? {};
  const url = String(photo.url ?? '').trim();
  const mimeType = String(photo.mimeType ?? '').trim();
  const sizeBytes = Number(photo.sizeBytes ?? 0);

  return {
    url,
    mimeType,
    sizeBytes: Number.isFinite(sizeBytes) && sizeBytes > 0 ? sizeBytes : 0,
    capturedAt: url ? new Date() : null
  };
};

const parsePunchInput = (req: Request): {
  punchType: PunchType;
  punchTime: Date;
  source: PunchSource;
  location: { latitude: number; longitude: number; accuracy: number };
  device: {
    deviceId: string;
    macAddress?: string;
    ipAddress?: string;
    userAgent?: string;
    platform?: string;
    appVersion?: string;
    isRooted?: boolean;
    isJailBroken?: boolean;
    fingerprint?: string;
  };
  photo: { url: string; mimeType: string; sizeBytes: number; capturedAt: Date | null };
} => {
  const punchTypeRaw = String(req.body.punchType ?? '').trim().toUpperCase();
  const punchType = (punchTypeRaw || 'IN') as PunchType;

  if (punchType !== 'IN' && punchType !== 'OUT') {
    throw createHttpError(400, 'punchType must be IN or OUT');
  }

  const punchTime = req.body.timestamp ? new Date(String(req.body.timestamp)) : new Date();
  if (Number.isNaN(punchTime.getTime())) {
    throw createHttpError(400, 'Invalid timestamp');
  }

  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  const accuracy = Number(req.body.accuracy);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy)) {
    throw createHttpError(400, 'latitude, longitude and accuracy are required numeric values');
  }

  const source = String(req.body.source ?? 'web') as PunchSource;
  if (!['mobile_app', 'web', 'biometric', 'csv_import', 'api_sync'].includes(source)) {
    throw createHttpError(400, 'source must be one of mobile_app/web/biometric/csv_import/api_sync');
  }

  const device = req.body.device ?? {};
  const deviceId = String(device.deviceId ?? '').trim();
  if (!deviceId) {
    throw createHttpError(400, 'device.deviceId is required');
  }

  return {
    punchType,
    punchTime,
    source,
    location: { latitude, longitude, accuracy },
    device: {
      deviceId,
      macAddress: String(device.macAddress ?? '').trim(),
      ipAddress:
        String(device.ipAddress ?? '').trim() ||
        req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.ip,
      userAgent: String(device.userAgent ?? '').trim() || req.header('user-agent') || '',
      platform: String(device.platform ?? '').trim(),
      appVersion: String(device.appVersion ?? '').trim(),
      isRooted: Boolean(device.isRooted),
      isJailBroken: Boolean(device.isJailBroken),
      fingerprint: String(device.fingerprint ?? '').trim()
    },
    photo: getPhotoPayload(req.body)
  };
};

const resolveEmployeeForAuthenticatedUser = async (req: Request): Promise<{
  employeeId: string;
  employeeName: string;
  department: string;
  shiftCode: string;
}> => {
  const context = requireTenantAndUser(req);

  try {
    const employee = await resolveEmployeeContextForUser({
      organizationId: context.organizationId,
      userId: context.userId,
      userEmail: req.user?.email ?? ''
    });

    return employee;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Employee profile not found';
    throw createHttpError(404, message);
  }
};

const upsertPunch = async (params: {
  req: Request;
  punchType: PunchType;
}): Promise<{
  punchId: string;
  status: string;
  colorHex: string;
  colorClass: string;
  reasons: Array<{ code: string; message: string; severity: string }>;
  workingHours?: string;
}> => {
  const { organizationId } = requireTenantAndUser(params.req);
  const employeeContext = await resolveEmployeeForAuthenticatedUser(params.req);
  const userPunchWindow = await resolveUserPunchWindow({
    organizationId,
    userId: params.req.user?.sub ?? ''
  });

  const parsed = parsePunchInput(params.req);
  if (parsed.punchType !== params.punchType) {
    throw createHttpError(400, `This endpoint only accepts punchType ${params.punchType}`);
  }

  const validationContext = await runMainPunchValidation({
    organizationId,
    employeeId: employeeContext.employeeId,
    employeeDepartment: employeeContext.department,
    shiftCode: employeeContext.shiftCode,
    punchType: parsed.punchType,
    punchTime: parsed.punchTime,
    source: parsed.source,
    location: parsed.location,
    device: parsed.device,
    photo: parsed.photo,
    userPunchWindow
  });

  const outsideUserWindowReason = validationContext.result.time.reasons.find((item) =>
    ['OUTSIDE_PUNCH_IN_WINDOW', 'OUTSIDE_PUNCH_OUT_WINDOW'].includes(item.code)
  );

  if (outsideUserWindowReason) {
    throw createHttpError(422, outsideUserWindowReason.message, {
      details: validationContext.result
    });
  }

  if (validationContext.result.blockPunch) {
    throw createHttpError(422, 'Punch blocked by attendance policy', {
      details: validationContext.result
    });
  }

  const timezone = validationContext.settings.settings.timingRules.timezone;
  const punchDate = DateTime.fromJSDate(parsed.punchTime, { zone: timezone }).toFormat('yyyy-LL-dd');

  const createdPunch = await AttendancePunchModel.create({
    organization: organizationId,
    employee: employeeContext.employeeId,
    user: params.req.user?.sub,
    punchDate,
    punchTime: parsed.punchTime,
    punchType: parsed.punchType,
    gps: {
      latitude: parsed.location.latitude,
      longitude: parsed.location.longitude,
      accuracy: parsed.location.accuracy,
      address: ''
    },
    gpsPoint: {
      type: 'Point',
      coordinates: [parsed.location.longitude, parsed.location.latitude]
    },
    nearestOfficeLocation: validationContext.result.nearestLocationId,
    distanceFromOfficeMeters: validationContext.result.distanceMeters,
    punchSource: parsed.source,
    device: parsed.device,
    photo: parsed.photo,
    validation: {
      status: validationContext.result.finalStatus,
      reasons: validationContext.result.reasons,
      colorHex: validationContext.result.finalColor.hex,
      colorClass: validationContext.result.finalColor.cssClass,
      modeApplied: validationContext.settings.settings.invalidPunchHandling.mode,
      checks: {
        geofence: validationContext.result.geofence.isWithinGeofence ? 'pass' : 'fail',
        time: validationContext.result.time.isWithinWindow ? 'pass' : 'fail',
        device: validationContext.result.device.isAllowed ? 'pass' : 'fail',
        photo: validationContext.result.photo.isValid ? 'pass' : 'fail'
      },
      evaluatedAt: new Date()
    },
    approvalWorkflow: {
      required: validationContext.result.requiresApproval,
      status: validationContext.result.requiresApproval ? 'pending' : 'not_required',
      requestedAt: validationContext.result.requiresApproval ? new Date() : null,
      requestedBy: validationContext.result.requiresApproval ? params.req.user?.sub : null,
      auditTrail: [
        {
          action: 'created',
          byUser: params.req.user?.sub,
          at: new Date(),
          comment: 'Punch created'
        }
      ]
    },
    workMetrics: {
      workingMinutes: 0,
      overtimeMinutes: 0,
      lateMinutes: validationContext.result.time.lateMinutes,
      earlyExitMinutes: validationContext.result.time.earlyExitMinutes,
      dayStatus: validationContext.result.time.statusTag,
      computedAt: null
    }
  });

  let workingHours: string | undefined;

  if (parsed.punchType === 'OUT') {
    const nearestPunchIn = await AttendancePunchModel.findOne({
      organization: organizationId,
      employee: employeeContext.employeeId,
      punchType: 'IN',
      punchTime: { $lt: parsed.punchTime },
      'workMetrics.pairedPunch': null
    })
      .sort({ punchTime: -1 })
      .exec();

    if (nearestPunchIn) {
      const working = calculateWorkingHours(nearestPunchIn.punchTime, parsed.punchTime, timezone);
      workingHours = working.formatted;

      const overtimeMinutes = Math.max(
        0,
        working.totalMinutes -
          Math.round(validationContext.settings.settings.timingRules.minWorkingHoursForPresent * 60)
      );

      createdPunch.workMetrics = {
        pairedPunch: nearestPunchIn._id,
        workingMinutes: working.totalMinutes,
        overtimeMinutes,
        lateMinutes: createdPunch.workMetrics.lateMinutes,
        earlyExitMinutes: createdPunch.workMetrics.earlyExitMinutes,
        dayStatus: createdPunch.workMetrics.dayStatus,
        computedAt: new Date()
      };
      await createdPunch.save();

      nearestPunchIn.workMetrics.pairedPunch = createdPunch._id;
      nearestPunchIn.workMetrics.workingMinutes = working.totalMinutes;
      nearestPunchIn.workMetrics.overtimeMinutes = overtimeMinutes;
      nearestPunchIn.workMetrics.computedAt = new Date();
      await nearestPunchIn.save();
    }
  }

  emitLivePunchEvent({
    organizationId,
    employeeId: employeeContext.employeeId,
    employeeName: employeeContext.employeeName,
    punchType: parsed.punchType,
    punchTime: createdPunch.punchTime.toISOString(),
    validationStatus: createdPunch.validation.status,
    colorHex: createdPunch.validation.colorHex,
    location: {
      latitude: createdPunch.gps.latitude,
      longitude: createdPunch.gps.longitude,
      distanceMeters: createdPunch.distanceFromOfficeMeters
    }
  });

  const occupancy = await getCurrentOccupancy(organizationId, punchDate);
  emitOccupancyEvent({
    organizationId,
    currentOccupancy: occupancy,
    checkedInEmployees: occupancy,
    checkedOutEmployees: 0,
    generatedAt: new Date().toISOString()
  });

  if (createdPunch.validation.status === 'invalid' || createdPunch.validation.status === 'pending_approval') {
    await dispatchAttendanceNotification({
      template: 'invalid_punch',
      channels: validationContext.settings.settings.notifications.invalidPunchToEmployee,
      recipient: {
        userId: params.req.user?.sub,
        email: params.req.user?.email,
        name: employeeContext.employeeName
      },
      payload: {
        employeeName: employeeContext.employeeName,
        date: punchDate,
        time: DateTime.fromJSDate(createdPunch.punchTime, { zone: timezone }).toFormat('HH:mm'),
        status: createdPunch.validation.status,
        reason: createdPunch.validation.reasons.map((item: any) => item.message).join('; ')
      }
    });
  }

  return {
    punchId: createdPunch._id.toString(),
    status: createdPunch.validation.status,
    colorHex: createdPunch.validation.colorHex,
    colorClass: createdPunch.validation.colorClass,
    reasons: createdPunch.validation.reasons.map((item: any) => ({
      code: item.code,
      message: item.message,
      severity: item.severity
    })),
    ...(workingHours ? { workingHours } : {})
  };
};

export const punchIn = asyncHandler(async (req: Request, res: Response) => {
  const result = await upsertPunch({ req, punchType: 'IN' });

  res.status(201).json({
    success: true,
    message: 'Punch in captured',
    data: result
  });
});

export const punchOut = asyncHandler(async (req: Request, res: Response) => {
  const result = await upsertPunch({ req, punchType: 'OUT' });

  res.status(201).json({
    success: true,
    message: 'Punch out captured',
    data: result
  });
});

export const getMyAttendance = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  const employee = await resolveEmployeeForAuthenticatedUser(req);

  const effectiveSettings = await getEffectiveAttendanceSettings({
    organizationId,
    departmentId: employee.department,
    shiftCode: employee.shiftCode
  });

  const timezone = effectiveSettings.settings.timingRules.timezone;

  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  const monthlyView = String(req.query.view ?? '').toLowerCase() === 'monthly';

  let startDate: Date;
  let endDate: Date;

  const queryStartDate = String(req.query.startDate ?? '').trim();
  const queryEndDate = String(req.query.endDate ?? '').trim();

  if (queryStartDate && queryEndDate) {
    startDate = new Date(queryStartDate);
    endDate = new Date(queryEndDate);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw createHttpError(400, 'Invalid date range');
    }
  } else {
    const now = DateTime.now().setZone(timezone);
    const range = getMonthRange(now.year, now.month, timezone);
    startDate = range.start;
    endDate = range.end;
  }

  const punches = await AttendancePunchModel.find({
    organization: organizationId,
    employee: employee.employeeId,
    punchTime: {
      $gte: startDate,
      $lte: endDate
    }
  })
    .sort({ punchTime: -1 })
    .lean();

  const dayRows = buildAttendanceDaySummaries(punches as never, timezone);

  if (monthlyView) {
    const byMonth = new Map<string, { present: number; invalid: number; warning: number; pending: number }>();

    for (const row of dayRows) {
      const key = row.date.slice(0, 7);
      if (!byMonth.has(key)) {
        byMonth.set(key, { present: 0, invalid: 0, warning: 0, pending: 0 });
      }

      const aggregate = byMonth.get(key);
      if (!aggregate) {
        continue;
      }

      if (row.status === 'present') {
        aggregate.present += 1;
      }
      if (row.status === 'invalid') {
        aggregate.invalid += 1;
      }
      if (row.status === 'warning') {
        aggregate.warning += 1;
      }
      if (row.status === 'pending_approval') {
        aggregate.pending += 1;
      }
    }

    res.json({
      success: true,
      data: {
        view: 'monthly',
        rows: Array.from(byMonth.entries()).map(([month, stats]) => ({ month, ...stats }))
      }
    });
    return;
  }

  const total = dayRows.length;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const pagedRows = dayRows.slice(startIndex, endIndex);

  res.json({
    success: true,
    data: {
      view: 'daily',
      page,
      limit,
      total,
      rows: pagedRows
    }
  });
});

export const getDailyAttendanceDetail = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  const employee = await resolveEmployeeForAuthenticatedUser(req);

  const targetDate = String(req.params.date ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw createHttpError(400, 'Date must be YYYY-MM-DD');
  }

  const effectiveSettings = await getEffectiveAttendanceSettings({
    organizationId,
    departmentId: employee.department,
    shiftCode: employee.shiftCode
  });

  const timezone = effectiveSettings.settings.timingRules.timezone;
  const range = getDayRange(targetDate, timezone);

  const punches = await AttendancePunchModel.find({
    organization: organizationId,
    employee: employee.employeeId,
    punchTime: {
      $gte: range.start,
      $lte: range.end
    }
  })
    .populate('nearestOfficeLocation')
    .sort({ punchTime: 1 })
    .lean();

  const officeLocations = await OfficeLocationModel.find({
    organization: organizationId,
    isActive: true
  }).lean();

  res.json({
    success: true,
    data: {
      date: targetDate,
      timezone,
      punches: punches.map((item) => ({
        id: item._id,
        time: item.punchTime,
        punchType: item.punchType,
        photoUrl: item.photo.url,
        location: {
          latitude: item.gps.latitude,
          longitude: item.gps.longitude,
          accuracy: item.gps.accuracy
        },
        companyLocation: item.nearestOfficeLocation
          ? {
              id: (item.nearestOfficeLocation as { _id: unknown })._id,
              name: (item.nearestOfficeLocation as { name?: string }).name,
              latitude: (item.nearestOfficeLocation as { geoPoint?: { coordinates?: number[] } }).geoPoint
                ?.coordinates?.[1],
              longitude: (item.nearestOfficeLocation as { geoPoint?: { coordinates?: number[] } }).geoPoint
                ?.coordinates?.[0]
            }
          : null,
        distanceFromOfficeMeters: item.distanceFromOfficeMeters,
        source: item.punchSource,
        macAddress: item.device.macAddress,
        notes: item.validation.reasons.map((reason: any) => reason.message),
        validationStatus: item.validation.status,
        colorHex: item.validation.colorHex
      })),
      mapView: {
        officeLocations: officeLocations.map((location) => ({
          id: location._id,
          name: location.name,
          latitude: location.geoPoint.coordinates[1],
          longitude: location.geoPoint.coordinates[0],
          radiusMeters: location.geofenceRadiusMeters
        })),
        punchPoints: punches.map((item) => ({
          id: item._id,
          punchType: item.punchType,
          latitude: item.gps.latitude,
          longitude: item.gps.longitude,
          distanceMeters: item.distanceFromOfficeMeters,
          colorHex: item.validation.colorHex
        }))
      }
    }
  });
});

export const getMyAttendanceContext = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  const employeeContext = await resolveEmployeeForAuthenticatedUser(req);
  const effectiveSettings = await getEffectiveAttendanceSettings({
    organizationId,
    departmentId: employeeContext.department,
    shiftCode: employeeContext.shiftCode
  });

  const employeeDoc = await EmployeeModel.findOne({
    _id: employeeContext.employeeId,
    organization: organizationId
  }).lean();

  if (!employeeDoc) {
    throw createHttpError(404, 'Employee profile not found');
  }

  const punchWindow = await resolveUserPunchWindow({
    organizationId,
    userId: req.user?.sub ?? ''
  });
  const timezone = effectiveSettings.settings.timingRules.timezone;
  const now = DateTime.now().setZone(timezone);

  res.json({
    success: true,
    data: {
      employeeId: employeeDoc._id.toString(),
      employeeCode: employeeDoc.employeeCode,
      employeeName: `${employeeDoc.firstName} ${employeeDoc.lastName}`.trim(),
      department: employeeDoc.department || '',
      designation: employeeDoc.designation || '',
      dateOfJoining: employeeDoc.dateOfJoining,
      punchWindow: {
        ...punchWindow,
        timezone,
        currentLocalTime: now.toFormat('HH:mm'),
        isPunchInAllowedNow: isCurrentTimeInWindow(
          now,
          punchWindow.punchInStartTime,
          punchWindow.punchInEndTime
        ),
        isPunchOutAllowedNow: isCurrentTimeInWindow(
          now,
          punchWindow.punchOutStartTime,
          punchWindow.punchOutEndTime
        )
      }
    }
  });
});

export const getMyLeaveLedger = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);

  const leaveType = parseLeaveType(req.query.leaveType);
  const year = parseYear(req.query.year ?? DateTime.now().year);
  const employeeDoc = await resolveLedgerEmployee({
    req,
    organizationId,
    explicitEmployeeId: req.query.employeeId
  });

  const ledger = await ensureLeaveLedgerDocument({
    organizationId,
    employeeId: employeeDoc._id.toString(),
    leaveType,
    year
  });

  res.json({
    success: true,
    data: normalizeLeaveLedgerPayload({ ledger, employeeDoc, leaveType, year })
  });
});

export const listLeaveLedgerEmployees = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireApproverRole(req);

  const search = String(req.query.search ?? '').trim();
  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 100)));

  const filters: Record<string, unknown> = {
    organization: organizationId,
    status: 'active'
  };

  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filters.$or = [
      { firstName: regex },
      { lastName: regex },
      { employeeCode: regex },
      { workEmail: regex }
    ];
  }

  const rows = await EmployeeModel.find(filters)
    .select({ _id: 1, employeeCode: 1, firstName: 1, lastName: 1, department: 1, designation: 1 })
    .sort({ firstName: 1, lastName: 1 })
    .limit(limit)
    .lean();

  res.json({
    success: true,
    data: rows.map((employee) => ({
      employeeId: employee._id.toString(),
      employeeCode: employee.employeeCode,
      employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
      department: employee.department || '',
      designation: employee.designation || ''
    }))
  });
});

export const upsertLeaveLedger = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireApproverRole(req);

  const leaveType = parseLeaveType(req.body.leaveType);
  const year = parseYear(req.body.year ?? DateTime.now().year);
  const employeeDoc = await resolveLedgerEmployee({
    req,
    organizationId,
    explicitEmployeeId: req.body.employeeId
  });

  const ledger = await ensureLeaveLedgerDocument({
    organizationId,
    employeeId: employeeDoc._id.toString(),
    leaveType,
    year
  });

  const updates: Record<string, unknown> = {};

  if (req.body.openingBalance !== undefined) {
    const openingBalance = Number(req.body.openingBalance);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      throw createHttpError(400, 'openingBalance must be a non-negative number');
    }
    updates.openingBalance = openingBalance;
  }

  if (req.body.openingBalanceDate !== undefined) {
    updates.openingBalanceDate = parseLedgerDate(req.body.openingBalanceDate, 'openingBalanceDate');
  }

  if (req.body.monthly !== undefined) {
    if (!Array.isArray(req.body.monthly)) {
      throw createHttpError(400, 'monthly must be an array');
    }

    const byMonth = new Map<number, any>();
    for (const monthRow of ledger.monthly ?? []) {
      byMonth.set(Number(monthRow.month), {
        month: Number(monthRow.month),
        days: Number(monthRow.days),
        credit: Number(monthRow.credit ?? 0),
        availed: Number(monthRow.availed ?? 0),
        availedDates: Array.isArray(monthRow.availedDates)
          ? monthRow.availedDates.map((date: Date) => new Date(date))
          : []
      });
    }

    for (const rawItem of req.body.monthly as Array<Record<string, unknown>>) {
      const month = Number(rawItem.month);
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw createHttpError(400, 'monthly.month must be between 1 and 12');
      }

      const current = byMonth.get(month) ?? {
        month,
        days: DateTime.fromObject({ year, month, day: 1 }).daysInMonth ?? 30,
        credit: 0,
        availed: 0,
        availedDates: []
      };

      if (rawItem.credit !== undefined) {
        const credit = Number(rawItem.credit);
        if (!Number.isFinite(credit) || credit < 0) {
          throw createHttpError(400, 'monthly.credit must be a non-negative number');
        }
        current.credit = credit;
      }

      if (rawItem.availed !== undefined) {
        const availed = Number(rawItem.availed);
        if (!Number.isFinite(availed) || availed < 0) {
          throw createHttpError(400, 'monthly.availed must be a non-negative number');
        }
        current.availed = availed;
      }

      if (rawItem.days !== undefined) {
        const days = Number(rawItem.days);
        if (!Number.isInteger(days) || days < 1 || days > 31) {
          throw createHttpError(400, 'monthly.days must be between 1 and 31');
        }
        current.days = days;
      }

      if (rawItem.availedDates !== undefined) {
        if (!Array.isArray(rawItem.availedDates)) {
          throw createHttpError(400, 'monthly.availedDates must be an array');
        }

        current.availedDates = rawItem.availedDates.map((date, index) =>
          parseLedgerDate(date, `monthly.availedDates[${index}]`)
        );
      }

      byMonth.set(month, current);
    }

    updates.monthly = Array.from(byMonth.values()).sort((a, b) => a.month - b.month);
  }

  const updated = await AttendanceLeaveLedgerModel.findOneAndUpdate(
    {
      organization: organizationId,
      employee: employeeDoc._id,
      leaveType,
      year
    },
    {
      $set: updates
    },
    {
      new: true
    }
  ).lean();

  if (!updated) {
    throw createHttpError(500, 'Failed to update leave ledger');
  }

  res.json({
    success: true,
    message: 'Leave ledger updated successfully',
    data: normalizeLeaveLedgerPayload({
      ledger: updated,
      employeeDoc,
      leaveType,
      year
    })
  });
});

export const createLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, userId } = requireTenantAndUser(req);
  const employeeContext = await resolveEmployeeForAuthenticatedUser(req);

  const action = String(req.body.action ?? 'save').trim().toLowerCase();
  if (!['save', 'submit'].includes(action)) {
    throw createHttpError(400, 'action must be save or submit');
  }

  const leaveType = parseLeaveRequestType(req.body.leaveType);
  const requestedDurationType = parseLeaveDurationType(req.body.durationType);
  const durationType = halfDayLeaveRequestTypeValues.includes(
    leaveType as HalfDayLeaveRequestTypeCode
  )
    ? 'first_half'
    : requestedDurationType;
  const fromDate = parseIsoDateStrict(req.body.fromDate, 'fromDate');
  const toDate = parseIsoDateStrict(req.body.toDate, 'toDate');
  const slices = buildLeaveDateSlices({ fromDate, toDate, leaveType, durationType });
  const noOfDays = Number(slices.reduce((sum, item) => sum + item.units, 0).toFixed(2));
  const reason = String(req.body.reason ?? '').trim();
  if (reason.length < 5) {
    throw createHttpError(400, 'reason is required (min 5 chars)');
  }

  const workLocation = String(req.body.workLocation ?? '').trim().slice(0, 120);

  const employeeDoc = await EmployeeModel.findOne({
    _id: employeeContext.employeeId,
    organization: organizationId
  })
    .select({ managerUser: 1 })
    .lean();

  if (!employeeDoc) {
    throw createHttpError(404, 'Employee profile not found');
  }

  const managerUserId = employeeDoc.managerUser?.toString() ?? '';
  let approverUserRef: mongoose.Types.ObjectId | null = null;
  if (managerUserId && mongoose.Types.ObjectId.isValid(managerUserId)) {
    approverUserRef = new mongoose.Types.ObjectId(managerUserId);
  }

  if (action === 'submit' && req.user?.role === 'employee' && !approverUserRef) {
    throw createHttpError(400, 'No manager is assigned for this employee');
  }

  const requestId = String(req.body.requestId ?? '').trim();
  let leaveRequestDoc: any;

  if (requestId) {
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      throw createHttpError(400, 'Invalid leave request id');
    }

    leaveRequestDoc = await AttendanceLeaveRequestModel.findOne({
      _id: requestId,
      organization: organizationId,
      requestedBy: userId
    }).exec();

    if (!leaveRequestDoc) {
      throw createHttpError(404, 'Leave request not found');
    }

    if (leaveRequestDoc.status !== 'pending') {
      throw createHttpError(400, 'Only pending/draft request can be edited');
    }
  } else {
    leaveRequestDoc = new AttendanceLeaveRequestModel({
      organization: organizationId,
      employee: employeeContext.employeeId,
      requestedBy: userId,
      auditTrail: [
        {
          action: 'created',
          byUser: new mongoose.Types.ObjectId(userId),
          at: new Date(),
          comment: 'Draft created'
        }
      ]
    });
  }

  leaveRequestDoc.leaveType = leaveType;
  leaveRequestDoc.durationType = durationType;
  leaveRequestDoc.fromDate = fromDate;
  leaveRequestDoc.toDate = toDate;
  leaveRequestDoc.noOfDays = noOfDays;
  leaveRequestDoc.reason = reason;
  leaveRequestDoc.workLocation = workLocation;
  leaveRequestDoc.approverUser = approverUserRef;
  leaveRequestDoc.status = action === 'submit' ? 'submitted' : 'pending';
  leaveRequestDoc.submittedAt = action === 'submit' ? new Date() : null;
  leaveRequestDoc.decidedAt = null;
  leaveRequestDoc.decidedBy = null;
  leaveRequestDoc.decisionComment = '';
  leaveRequestDoc.auditTrail.push({
    action: action === 'submit' ? 'submitted' : 'saved',
    byUser: new mongoose.Types.ObjectId(userId),
    at: new Date(),
    comment: reason
  });

  await leaveRequestDoc.save();

  const populated = await AttendanceLeaveRequestModel.findOne({
    _id: leaveRequestDoc._id,
    organization: organizationId
  })
    .populate('employee', 'firstName lastName employeeCode')
    .populate('approverUser', 'name email')
    .populate('decidedBy', 'name email')
    .lean();

  if (!populated) {
    throw createHttpError(500, 'Failed to load leave request');
  }

  res.status(requestId ? 200 : 201).json({
    success: true,
    message: action === 'submit' ? 'Leave request submitted' : 'Leave request saved',
    data: mapLeaveRequestPayload(populated)
  });
});

export const listLeaveRequests = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);

  const scope = String(req.query.scope ?? 'mine').trim().toLowerCase();
  const statusQuery = String(req.query.status ?? '').trim().toLowerCase();

  const query: Record<string, unknown> = {
    organization: organizationId
  };

  if (scope === 'assigned') {
    requireApproverRole(req);
    if (req.user?.role === 'manager') {
      query.approverUser = req.user.sub;
    }

    if (!statusQuery) {
      query.status = 'submitted';
    }
  } else if (scope === 'all') {
    requireApproverRole(req);
  } else {
    query.requestedBy = req.user?.sub;
  }

  if (statusQuery && statusQuery !== 'all') {
    if (!leaveRequestStatusValues.includes(statusQuery as LeaveRequestStatusCode)) {
      throw createHttpError(400, 'Invalid leave request status');
    }

    query.status = statusQuery;
  }

  const rows = await AttendanceLeaveRequestModel.find(query)
    .populate('employee', 'firstName lastName employeeCode')
    .populate('approverUser', 'name email')
    .populate('decidedBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: rows.map((row) => mapLeaveRequestPayload(row))
  });
});

export const cancelLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, userId } = requireTenantAndUser(req);

  const requestId = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw createHttpError(400, 'Invalid leave request id');
  }

  const leaveRequestDoc = await AttendanceLeaveRequestModel.findOne({
    _id: requestId,
    organization: organizationId,
    requestedBy: userId
  }).exec();

  if (!leaveRequestDoc) {
    throw createHttpError(404, 'Leave request not found');
  }

  if (!['pending', 'submitted'].includes(leaveRequestDoc.status)) {
    throw createHttpError(400, 'Only pending/submitted request can be cancelled');
  }

  const comment = String(req.body.comment ?? '').trim();

  leaveRequestDoc.status = 'cancelled';
  leaveRequestDoc.decidedAt = new Date();
  leaveRequestDoc.decidedBy = new mongoose.Types.ObjectId(userId);
  leaveRequestDoc.decisionComment = comment;
  leaveRequestDoc.auditTrail.push({
    action: 'cancelled',
    byUser: new mongoose.Types.ObjectId(userId),
    at: new Date(),
    comment
  });

  await leaveRequestDoc.save();

  res.json({
    success: true,
    message: 'Leave request cancelled'
  });
});

const applyLeaveRequestDecision = async (params: {
  req: Request;
  approve: boolean;
}): Promise<void> => {
  const { organizationId, userId } = requireTenantAndUser(params.req);
  requireApproverRole(params.req);

  const requestId = String(params.req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw createHttpError(400, 'Invalid leave request id');
  }

  const leaveRequestDoc = await AttendanceLeaveRequestModel.findOne({
    _id: requestId,
    organization: organizationId
  }).exec();

  if (!leaveRequestDoc) {
    throw createHttpError(404, 'Leave request not found');
  }

  if (leaveRequestDoc.status !== 'submitted') {
    throw createHttpError(400, 'Leave request is not in submitted state');
  }

  if (
    params.req.user?.role === 'manager' &&
    String(leaveRequestDoc.approverUser ?? '') !== userId
  ) {
    throw createHttpError(403, 'Only mapped manager can approve this request');
  }

  const comment = String(params.req.body.comment ?? '').trim();
  const leaveType = leaveRequestDoc.leaveType as LeaveRequestTypeCode;
  const ledgerLeaveType = resolveLedgerLeaveType(leaveType);
  const isHalfType = halfDayLeaveRequestTypeValues.includes(
    leaveType as HalfDayLeaveRequestTypeCode
  );
  const ledgerDurationType = isHalfType
    ? 'first_half'
    : ((leaveRequestDoc.durationType as LeaveDurationTypeCode) ?? 'full_day');

  if (params.approve && ledgerLeaveType) {
    await applyApprovedLeaveToLedger({
      organizationId,
      employeeId: leaveRequestDoc.employee.toString(),
      leaveType: ledgerLeaveType,
      fromDate: leaveRequestDoc.fromDate,
      toDate: leaveRequestDoc.toDate,
      durationType: ledgerDurationType
    });
  }

  leaveRequestDoc.status = params.approve ? 'approved' : 'rejected';
  leaveRequestDoc.decidedAt = new Date();
  leaveRequestDoc.decidedBy = new mongoose.Types.ObjectId(userId);
  leaveRequestDoc.decisionComment = comment;
  leaveRequestDoc.auditTrail.push({
    action: params.approve ? 'approved' : 'rejected',
    byUser: new mongoose.Types.ObjectId(userId),
    at: new Date(),
    comment
  });

  await leaveRequestDoc.save();
};

export const approveLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
  await applyLeaveRequestDecision({ req, approve: true });

  res.json({
    success: true,
    message: 'Leave request approved'
  });
});

export const rejectLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
  await applyLeaveRequestDecision({ req, approve: false });

  res.json({
    success: true,
    message: 'Leave request rejected'
  });
});

export const getAttendanceSettings = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  const settings = await listAttendanceSettingsForOrganization(organizationId);

  res.json({
    success: true,
    data: settings
  });
});

export const createAttendanceSettings = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireAdminRole(req);

  const scopeType = String(req.body.scopeType ?? 'company').trim();
  const scopeRef = String(req.body.scopeRef ?? 'company').trim();
  const inheritFromSettingsId = req.body.inheritFromSettingsId
    ? String(req.body.inheritFromSettingsId)
    : null;

  const existing = await AttendanceSettingsModel.findOne({
    organization: organizationId,
    scopeType,
    scopeRef
  }).lean();

  if (existing) {
    throw createHttpError(409, 'Settings already exist for this scope');
  }

  const base = getDefaultAttendanceSettings(organizationId);

  const payload = {
    ...base,
    ...req.body,
    organization: organizationId,
    scopeType,
    scopeRef,
    inheritFromSettingsId
  };

  const created = await AttendanceSettingsModel.create(payload);

  res.status(201).json({
    success: true,
    data: created
  });
});

export const updateAttendanceSettings = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireAdminRole(req);

  const settingsId = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(settingsId)) {
    throw createHttpError(400, 'Invalid settings id');
  }

  const settings = await getAttendanceSettingsById(organizationId, settingsId);
  if (!settings) {
    throw createHttpError(404, 'Settings not found');
  }

  const updates = req.body;
  delete updates.organization;

  Object.assign(settings, updates);
  await settings.save();

  res.json({
    success: true,
    message: 'Attendance settings updated',
    data: settings
  });
});

export const deleteAttendanceSettings = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireAdminRole(req);

  const settingsId = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(settingsId)) {
    throw createHttpError(400, 'Invalid settings id');
  }

  const settings = await getAttendanceSettingsById(organizationId, settingsId);
  if (!settings) {
    throw createHttpError(404, 'Settings not found');
  }

  if (settings.scopeType === 'company' && settings.scopeRef === 'company') {
    const defaults = getDefaultAttendanceSettings(organizationId);
    Object.assign(settings, defaults);
    await settings.save();

    res.json({
      success: true,
      message: 'Default company settings reset'
    });
    return;
  }

  await settings.deleteOne();

  res.json({
    success: true,
    message: 'Attendance settings deleted'
  });
});

export const listOfficeLocations = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);

  const rows = await OfficeLocationModel.find({ organization: organizationId })
    .sort({ isPrimary: -1, name: 1 })
    .lean();

  res.json({
    success: true,
    data: rows.map((item) => ({
      id: item._id,
      name: item.name,
      addressLine1: item.addressLine1,
      addressLine2: item.addressLine2,
      city: item.city,
      state: item.state,
      postalCode: item.postalCode,
      country: item.country,
      latitude: item.geoPoint.coordinates[1],
      longitude: item.geoPoint.coordinates[0],
      geofenceRadiusMeters: item.geofenceRadiusMeters,
      departmentRestrictions: item.departmentRestrictions,
      shiftRestrictions: item.shiftRestrictions,
      isPrimary: item.isPrimary,
      isActive: item.isActive
    }))
  });
});

export const createOfficeLocation = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireAdminRole(req);

  const name = String(req.body.name ?? '').trim();
  const addressLine1 = String(req.body.addressLine1 ?? '').trim();
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  const geofenceRadiusMeters = Number(req.body.geofenceRadiusMeters ?? 150);

  if (!name || !addressLine1 || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw createHttpError(400, 'name, addressLine1, latitude and longitude are required');
  }

  const payload = {
    organization: organizationId,
    name,
    addressLine1,
    addressLine2: String(req.body.addressLine2 ?? ''),
    city: String(req.body.city ?? ''),
    state: String(req.body.state ?? ''),
    postalCode: String(req.body.postalCode ?? ''),
    country: String(req.body.country ?? ''),
    geoPoint: {
      type: 'Point' as const,
      coordinates: [longitude, latitude]
    },
    geofenceRadiusMeters,
    geofenceMode: String(req.body.geofenceMode ?? 'strict'),
    departmentRestrictions: Array.isArray(req.body.departmentRestrictions)
      ? req.body.departmentRestrictions.map(String)
      : [],
    shiftRestrictions: Array.isArray(req.body.shiftRestrictions)
      ? req.body.shiftRestrictions.map(String)
      : [],
    isPrimary: Boolean(req.body.isPrimary),
    isActive: req.body.isActive !== false
  };

  if (payload.isPrimary) {
    await OfficeLocationModel.updateMany({ organization: organizationId }, { $set: { isPrimary: false } });
  }

  const created = await OfficeLocationModel.create(payload);

  res.status(201).json({
    success: true,
    data: created
  });
});

export const updateOfficeLocation = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireAdminRole(req);

  const locationId = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(locationId)) {
    throw createHttpError(400, 'Invalid location id');
  }

  const location = await OfficeLocationModel.findOne({ _id: locationId, organization: organizationId }).exec();
  if (!location) {
    throw createHttpError(404, 'Location not found');
  }

  if (req.body.name !== undefined) {
    location.name = String(req.body.name).trim();
  }
  if (req.body.addressLine1 !== undefined) {
    location.addressLine1 = String(req.body.addressLine1).trim();
  }
  if (req.body.addressLine2 !== undefined) {
    location.addressLine2 = String(req.body.addressLine2).trim();
  }
  if (req.body.city !== undefined) {
    location.city = String(req.body.city).trim();
  }
  if (req.body.state !== undefined) {
    location.state = String(req.body.state).trim();
  }
  if (req.body.postalCode !== undefined) {
    location.postalCode = String(req.body.postalCode).trim();
  }
  if (req.body.country !== undefined) {
    location.country = String(req.body.country).trim();
  }
  if (req.body.latitude !== undefined && req.body.longitude !== undefined) {
    location.geoPoint.coordinates = [Number(req.body.longitude), Number(req.body.latitude)];
  }
  if (req.body.geofenceRadiusMeters !== undefined) {
    location.geofenceRadiusMeters = Number(req.body.geofenceRadiusMeters);
  }
  if (req.body.geofenceMode !== undefined) {
    location.geofenceMode = String(req.body.geofenceMode) as never;
  }
  if (req.body.departmentRestrictions !== undefined && Array.isArray(req.body.departmentRestrictions)) {
    location.departmentRestrictions = req.body.departmentRestrictions.map(String);
  }
  if (req.body.shiftRestrictions !== undefined && Array.isArray(req.body.shiftRestrictions)) {
    location.shiftRestrictions = req.body.shiftRestrictions.map(String);
  }
  if (req.body.isPrimary !== undefined) {
    const isPrimary = Boolean(req.body.isPrimary);
    if (isPrimary) {
      await OfficeLocationModel.updateMany(
        { organization: organizationId, _id: { $ne: location._id } },
        { $set: { isPrimary: false } }
      );
    }
    location.isPrimary = isPrimary;
  }
  if (req.body.isActive !== undefined) {
    location.isActive = Boolean(req.body.isActive);
  }

  await location.save();

  res.json({
    success: true,
    data: location
  });
});

export const deleteOfficeLocation = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireAdminRole(req);

  const locationId = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(locationId)) {
    throw createHttpError(400, 'Invalid location id');
  }

  const deleted = await OfficeLocationModel.findOneAndDelete({ _id: locationId, organization: organizationId }).lean();
  if (!deleted) {
    throw createHttpError(404, 'Location not found');
  }

  res.json({
    success: true,
    message: 'Office location deleted'
  });
});

export const getPendingApprovals = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireApproverRole(req);

  const query: Record<string, unknown> = {
    organization: organizationId,
    'approvalWorkflow.status': 'pending'
  };

  if (req.user?.role === 'manager') {
    const managedEmployees = await EmployeeModel.find({
      organization: organizationId,
      managerUser: req.user.sub,
      status: 'active'
    })
      .select({ _id: 1 })
      .lean();

    query.employee = {
      $in: managedEmployees.map((item) => item._id)
    };
  }

  const rows = await AttendancePunchModel.find(query)
    .populate('employee', 'firstName lastName department')
    .sort({ punchTime: -1 })
    .lean();

  res.json({
    success: true,
    data: rows.map((item) => ({
      id: item._id,
      employee: item.employee,
      punchDate: item.punchDate,
      punchTime: item.punchTime,
      punchType: item.punchType,
      status: item.validation.status,
      colorHex: item.validation.colorHex,
      reasons: item.validation.reasons,
      approval: item.approvalWorkflow
    }))
  });
});

const updatePunchApproval = async (params: {
  req: Request;
  approved: boolean;
}): Promise<void> => {
  const { organizationId } = requireTenantAndUser(params.req);
  requireApproverRole(params.req);

  const punchId = String(params.req.params.punchId ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(punchId)) {
    throw createHttpError(400, 'Invalid punch id');
  }

  const punch = await AttendancePunchModel.findOne({
    _id: punchId,
    organization: organizationId
  })
    .populate('employee')
    .exec();

  if (!punch) {
    throw createHttpError(404, 'Punch not found');
  }

  if (punch.approvalWorkflow.status !== 'pending') {
    throw createHttpError(400, 'Punch is not pending approval');
  }

  const comment = String(params.req.body.comment ?? '').trim();

  punch.approvalWorkflow.status = params.approved ? 'approved' : 'rejected';
  punch.approvalWorkflow.decidedAt = new Date();
  punch.approvalWorkflow.decidedBy = new mongoose.Types.ObjectId(params.req.user?.sub);
  punch.approvalWorkflow.decisionComment = comment;
  punch.approvalWorkflow.auditTrail.push({
    action: params.approved ? 'approved' : 'rejected',
    byUser: new mongoose.Types.ObjectId(params.req.user?.sub),
    at: new Date(),
    comment
  });

  if (params.approved) {
    const color = getAttendanceColorIndicator({
      status: 'valid',
      reasons: [],
      isApprovedRegularization: true
    });

    punch.validation.status = 'valid';
    punch.validation.colorHex = color.hex;
    punch.validation.colorClass = color.cssClass;
  } else {
    punch.validation.status = 'invalid';
    punch.validation.colorHex = punch.validation.colorHex || '#ef4444';
  }

  await punch.save();

  const employeeDoc = await EmployeeModel.findById(punch.employee).lean();
  if (!employeeDoc) {
    return;
  }

  const employeeUser = await UserModel.findOne({
    organization: organizationId,
    email: employeeDoc.workEmail.toLowerCase(),
    isActive: true
  }).lean();

  if (!employeeUser) {
    return;
  }

  await dispatchAttendanceNotification({
    template: 'approval_decision',
    channels: {
      email: true,
      sms: false,
      push: true,
      inApp: true
    },
    recipient: {
      userId: employeeUser._id.toString(),
      email: employeeUser.email,
      name: employeeUser.name
    },
    payload: {
      employeeName: employeeUser.name,
      status: params.approved ? 'approved' : 'rejected',
      actionBy: params.req.user?.email,
      reason: comment || 'N/A'
    }
  });
};

export const approvePunch = asyncHandler(async (req: Request, res: Response) => {
  await updatePunchApproval({ req, approved: true });

  res.json({
    success: true,
    message: 'Punch approved'
  });
});

export const rejectPunch = asyncHandler(async (req: Request, res: Response) => {
  await updatePunchApproval({ req, approved: false });

  res.json({
    success: true,
    message: 'Punch rejected'
  });
});

export const bulkApprovePunches = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireApproverRole(req);

  const action = String(req.body.action ?? '').trim().toLowerCase();
  if (!['approve', 'reject'].includes(action)) {
    throw createHttpError(400, 'action must be approve or reject');
  }

  const comment = String(req.body.comment ?? '').trim();
  const punchIds = Array.isArray(req.body.punchIds) ? req.body.punchIds.map(String) : [];
  if (!punchIds.length) {
    throw createHttpError(400, 'punchIds is required');
  }

  const validIds = punchIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id));
  const rows = await AttendancePunchModel.find({
    _id: { $in: validIds },
    organization: organizationId,
    'approvalWorkflow.status': 'pending'
  }).exec();

  for (const row of rows) {
    row.approvalWorkflow.status = action === 'approve' ? 'approved' : 'rejected';
    row.approvalWorkflow.decidedAt = new Date();
    row.approvalWorkflow.decidedBy = new mongoose.Types.ObjectId(req.user?.sub);
    row.approvalWorkflow.decisionComment = comment;
    row.approvalWorkflow.auditTrail.push({
      action: action === 'approve' ? 'approved' : 'rejected',
      byUser: new mongoose.Types.ObjectId(req.user?.sub),
      at: new Date(),
      comment
    });

    if (action === 'approve') {
      const color = getAttendanceColorIndicator({
        status: 'valid',
        reasons: [],
        isApprovedRegularization: true
      });
      row.validation.status = 'valid';
      row.validation.colorHex = color.hex;
      row.validation.colorClass = color.cssClass;
    } else {
      row.validation.status = 'invalid';
    }

    await row.save();
  }

  res.json({
    success: true,
    message: `Bulk ${action} completed`,
    data: {
      requested: punchIds.length,
      updated: rows.length
    }
  });
});

export const createRegularization = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  const employee = await resolveEmployeeForAuthenticatedUser(req);

  const effectiveSettings = await getEffectiveAttendanceSettings({
    organizationId,
    departmentId: employee.department,
    shiftCode: employee.shiftCode
  });

  if (!effectiveSettings.settings.regularization.enabled) {
    throw createHttpError(403, 'Regularization is disabled for this organization');
  }

  const targetDate = String(req.body.targetDate ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw createHttpError(400, 'targetDate must be YYYY-MM-DD');
  }

  const reason = String(req.body.reason ?? '').trim();
  if (reason.length < 5) {
    throw createHttpError(400, 'reason is required (min 5 chars)');
  }

  const timezone = effectiveSettings.settings.timingRules.timezone;
  const target = DateTime.fromISO(targetDate, { zone: timezone });
  const oldestAllowed = DateTime.now()
    .setZone(timezone)
    .minus({ days: effectiveSettings.settings.regularization.maxDaysPast });
  if (target < oldestAllowed.startOf('day')) {
    throw createHttpError(
      400,
      `Cannot regularize older than ${effectiveSettings.settings.regularization.maxDaysPast} days`
    );
  }

  const monthStart = target.startOf('month').toJSDate();
  const monthEnd = target.endOf('month').toJSDate();

  const requestsThisMonth = await AttendanceRegularizationModel.countDocuments({
    organization: organizationId,
    requestedBy: req.user?.sub,
    createdAt: { $gte: monthStart, $lte: monthEnd }
  });

  if (requestsThisMonth >= effectiveSettings.settings.regularization.maxRequestsPerMonth) {
    throw createHttpError(400, 'Monthly regularization limit reached');
  }

  const relatedPunch = req.body.relatedPunchId ? String(req.body.relatedPunchId) : null;

  const created = await AttendanceRegularizationModel.create({
    organization: organizationId,
    employee: employee.employeeId,
    requestedBy: req.user?.sub,
    relatedPunch: relatedPunch && mongoose.Types.ObjectId.isValid(relatedPunch) ? relatedPunch : null,
    requestType: String(req.body.requestType ?? 'invalid_punch'),
    targetDate,
    requestedPunchType: req.body.requestedPunchType
      ? String(req.body.requestedPunchType).toUpperCase()
      : null,
    requestedPunchTime: req.body.requestedPunchTime ? new Date(String(req.body.requestedPunchTime)) : null,
    reason,
    supportingDocuments: Array.isArray(req.body.supportingDocuments)
      ? req.body.supportingDocuments.map(String)
      : [],
    status: 'pending',
    managerApproval: {
      required: effectiveSettings.settings.regularization.requireManagerApproval,
      status: effectiveSettings.settings.regularization.requireManagerApproval
        ? 'pending'
        : 'not_required'
    },
    hrApproval: {
      required: effectiveSettings.settings.regularization.requireHrApproval,
      status: effectiveSettings.settings.regularization.requireHrApproval ? 'pending' : 'not_required'
    },
    auditTrail: [
      {
        action: 'created',
        byUser: req.user?.sub,
        at: new Date(),
        comment: reason
      }
    ]
  });

  if (effectiveSettings.settings.notifications.approvalPendingToManager) {
    const employeeDoc = await EmployeeModel.findById(employee.employeeId).lean();
    const managerUserId = employeeDoc?.managerUser?.toString();
    if (managerUserId) {
      const manager = await UserModel.findById(managerUserId).lean();
      if (manager) {
        await dispatchAttendanceNotification({
          template: 'approval_pending',
          channels: effectiveSettings.settings.notifications.approvalPendingToManager,
          recipient: {
            userId: manager._id.toString(),
            email: manager.email,
            name: manager.name
          },
          payload: {
            managerName: manager.name,
            count: 1
          }
        });
      }
    }
  }

  res.status(201).json({
    success: true,
    message: 'Regularization request submitted',
    data: created
  });
});

export const listRegularizationRequests = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);

  const query: Record<string, unknown> = {
    organization: organizationId
  };

  if (req.user?.role === 'employee') {
    query.requestedBy = req.user.sub;
  }

  const status = String(req.query.status ?? '').trim();
  if (status) {
    query.status = status;
  }

  const rows = await AttendanceRegularizationModel.find(query)
    .populate('employee', 'firstName lastName department employeeCode')
    .populate('requestedBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: rows
  });
});

const applyRegularizationDecision = async (params: {
  req: Request;
  approve: boolean;
}): Promise<void> => {
  const { organizationId } = requireTenantAndUser(params.req);
  requireApproverRole(params.req);

  const requestId = String(params.req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw createHttpError(400, 'Invalid regularization id');
  }

  const regularization = await AttendanceRegularizationModel.findOne({
    _id: requestId,
    organization: organizationId
  }).exec();

  if (!regularization) {
    throw createHttpError(404, 'Regularization request not found');
  }

  if (regularization.status !== 'pending') {
    throw createHttpError(400, 'Regularization request already processed');
  }

  const comment = String(params.req.body.comment ?? '').trim();

  const isManagerFlow =
    regularization.managerApproval.required && regularization.managerApproval.status === 'pending';
  const isHrFlow =
    regularization.hrApproval.required &&
    regularization.managerApproval.status === 'approved' &&
    regularization.hrApproval.status === 'pending';

  if (!isManagerFlow && !isHrFlow) {
    throw createHttpError(400, 'No pending step to approve/reject');
  }

  if (isManagerFlow) {
    regularization.managerApproval.status = params.approve ? 'approved' : 'rejected';
    regularization.managerApproval.actedBy = new mongoose.Types.ObjectId(params.req.user?.sub);
    regularization.managerApproval.actedAt = new Date();
    regularization.managerApproval.comment = comment;
    regularization.auditTrail.push({
      action: params.approve ? 'manager_approved' : 'manager_rejected',
      byUser: new mongoose.Types.ObjectId(params.req.user?.sub),
      at: new Date(),
      comment
    });

    if (!params.approve) {
      regularization.status = 'rejected';
      regularization.finalDecisionBy = new mongoose.Types.ObjectId(params.req.user?.sub);
      regularization.finalDecisionAt = new Date();
      regularization.finalDecisionComment = comment;
    }
  } else if (isHrFlow) {
    regularization.hrApproval.status = params.approve ? 'approved' : 'rejected';
    regularization.hrApproval.actedBy = new mongoose.Types.ObjectId(params.req.user?.sub);
    regularization.hrApproval.actedAt = new Date();
    regularization.hrApproval.comment = comment;
    regularization.auditTrail.push({
      action: params.approve ? 'hr_approved' : 'hr_rejected',
      byUser: new mongoose.Types.ObjectId(params.req.user?.sub),
      at: new Date(),
      comment
    });

    if (!params.approve) {
      regularization.status = 'rejected';
      regularization.finalDecisionBy = new mongoose.Types.ObjectId(params.req.user?.sub);
      regularization.finalDecisionAt = new Date();
      regularization.finalDecisionComment = comment;
    }
  }

  const managerDone =
    regularization.managerApproval.status === 'approved' ||
    regularization.managerApproval.status === 'not_required';
  const hrDone =
    regularization.hrApproval.status === 'approved' || regularization.hrApproval.status === 'not_required';

  if (params.approve && managerDone && hrDone) {
    regularization.status = 'approved';
    regularization.finalDecisionBy = new mongoose.Types.ObjectId(params.req.user?.sub);
    regularization.finalDecisionAt = new Date();
    regularization.finalDecisionComment = comment;
    regularization.auditTrail.push({
      action: 'closed',
      byUser: new mongoose.Types.ObjectId(params.req.user?.sub),
      at: new Date(),
      comment: 'Regularization approved'
    });

    if (regularization.relatedPunch) {
      const punch = await AttendancePunchModel.findOne({
        _id: regularization.relatedPunch,
        organization: organizationId
      }).exec();

      if (punch) {
        const color = getAttendanceColorIndicator({
          status: 'valid',
          reasons: [],
          isApprovedRegularization: true
        });

        punch.validation.status = 'valid';
        punch.validation.colorHex = color.hex;
        punch.validation.colorClass = color.cssClass;
        punch.regularization.isRegularized = true;
        punch.regularization.requestId = regularization._id;
        punch.regularization.regularizedAt = new Date();
        punch.regularization.regularizedBy = new mongoose.Types.ObjectId(params.req.user?.sub);
        punch.regularization.comment = comment;

        punch.approvalWorkflow.auditTrail.push({
          action: 'regularized',
          byUser: new mongoose.Types.ObjectId(params.req.user?.sub),
          at: new Date(),
          comment
        });

        await punch.save();
      }
    }
  }

  await regularization.save();
};

export const approveRegularization = asyncHandler(async (req: Request, res: Response) => {
  await applyRegularizationDecision({ req, approve: true });

  res.json({
    success: true,
    message: 'Regularization approved'
  });
});

export const rejectRegularization = asyncHandler(async (req: Request, res: Response) => {
  await applyRegularizationDecision({ req, approve: false });

  res.json({
    success: true,
    message: 'Regularization rejected'
  });
});

export const getDailyReport = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireAdminRole(req);

  const date = String(req.query.date ?? DateTime.now().toFormat('yyyy-LL-dd'));
  const timezone = String(req.query.timezone ?? 'Asia/Kolkata');

  const rows = await buildDailyAttendanceReport({ organizationId, date, timezone });

  res.json({
    success: true,
    data: rows
  });
});

export const getMonthlySummaryReport = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireAdminRole(req);

  const now = DateTime.now();
  const year = Number(req.query.year ?? now.year);
  const month = Number(req.query.month ?? now.month);
  const timezone = String(req.query.timezone ?? 'Asia/Kolkata');

  const rows = await buildMonthlyAttendanceSummary({
    organizationId,
    year,
    month,
    timezone
  });

  res.json({
    success: true,
    data: rows
  });
});

export const getInvalidPunchReport = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireAdminRole(req);

  const start = req.query.startDate
    ? new Date(String(req.query.startDate))
    : DateTime.now().minus({ days: 30 }).toJSDate();
  const end = req.query.endDate ? new Date(String(req.query.endDate)) : new Date();

  const rows = await buildInvalidPunchMapReport({
    organizationId,
    startDate: start,
    endDate: end
  });

  res.json({
    success: true,
    data: rows
  });
});

export const getDepartmentWiseReport = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireAdminRole(req);

  const start = req.query.startDate
    ? new Date(String(req.query.startDate))
    : DateTime.now().minus({ days: 30 }).toJSDate();
  const end = req.query.endDate ? new Date(String(req.query.endDate)) : new Date();

  const rows = await buildDepartmentWiseAttendance({
    organizationId,
    startDate: start,
    endDate: end
  });

  res.json({
    success: true,
    data: rows
  });
});

export const getLateTrendReport = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireAdminRole(req);

  const days = Number(req.query.days ?? 30);
  const timezone = String(req.query.timezone ?? 'Asia/Kolkata');

  const rows = await buildLateArrivalTrend({
    organizationId,
    days,
    timezone
  });

  res.json({
    success: true,
    data: rows
  });
});

export const getDistanceReport = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireAdminRole(req);

  const start = req.query.startDate
    ? new Date(String(req.query.startDate))
    : DateTime.now().minus({ days: 30 }).toJSDate();
  const end = req.query.endDate ? new Date(String(req.query.endDate)) : new Date();

  const rows = await buildDistanceTravelReport({
    organizationId,
    startDate: start,
    endDate: end
  });

  res.json({
    success: true,
    data: rows
  });
});

export const getSourceAnalysisReport = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireAdminRole(req);

  const start = req.query.startDate
    ? new Date(String(req.query.startDate))
    : DateTime.now().minus({ days: 30 }).toJSDate();
  const end = req.query.endDate ? new Date(String(req.query.endDate)) : new Date();

  const rows = await buildPunchSourceAnalysis({
    organizationId,
    startDate: start,
    endDate: end
  });

  res.json({
    success: true,
    data: rows
  });
});

const buildReportByType = async (params: {
  organizationId: string;
  reportType: string;
  timezone: string;
  startDate?: Date;
  endDate?: Date;
  date?: string;
  month?: number;
  year?: number;
}): Promise<Array<Record<string, unknown>>> => {
  switch (params.reportType) {
    case 'daily':
      return buildDailyAttendanceReport({
        organizationId: params.organizationId,
        date: params.date ?? DateTime.now().toFormat('yyyy-LL-dd'),
        timezone: params.timezone
      });
    case 'monthly':
      return buildMonthlyAttendanceSummary({
        organizationId: params.organizationId,
        month: params.month ?? DateTime.now().month,
        year: params.year ?? DateTime.now().year,
        timezone: params.timezone
      });
    case 'invalid':
      return buildInvalidPunchMapReport({
        organizationId: params.organizationId,
        startDate: params.startDate ?? DateTime.now().minus({ days: 30 }).toJSDate(),
        endDate: params.endDate ?? new Date()
      });
    case 'department':
      return buildDepartmentWiseAttendance({
        organizationId: params.organizationId,
        startDate: params.startDate ?? DateTime.now().minus({ days: 30 }).toJSDate(),
        endDate: params.endDate ?? new Date()
      });
    case 'late-trend':
      return buildLateArrivalTrend({
        organizationId: params.organizationId,
        days: 30,
        timezone: params.timezone
      });
    case 'distance':
      return buildDistanceTravelReport({
        organizationId: params.organizationId,
        startDate: params.startDate ?? DateTime.now().minus({ days: 30 }).toJSDate(),
        endDate: params.endDate ?? new Date()
      });
    case 'source-analysis':
      return buildPunchSourceAnalysis({
        organizationId: params.organizationId,
        startDate: params.startDate ?? DateTime.now().minus({ days: 30 }).toJSDate(),
        endDate: params.endDate ?? new Date()
      });
    default:
      throw createHttpError(400, 'Unsupported reportType');
  }
};

export const exportAttendanceReport = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireAdminRole(req);

  const reportType = String(req.query.reportType ?? '').trim();
  const format = String(req.query.format ?? 'csv').trim() as ExportFormat;
  const timezone = String(req.query.timezone ?? 'Asia/Kolkata');

  if (!['csv', 'excel', 'pdf'].includes(format)) {
    throw createHttpError(400, 'format must be csv, excel or pdf');
  }

  const rows = await buildReportByType({
    organizationId,
    reportType,
    timezone,
    date: req.query.date ? String(req.query.date) : undefined,
    month: req.query.month ? Number(req.query.month) : undefined,
    year: req.query.year ? Number(req.query.year) : undefined,
    startDate: req.query.startDate ? new Date(String(req.query.startDate)) : undefined,
    endDate: req.query.endDate ? new Date(String(req.query.endDate)) : undefined
  });

  const exported = await exportRows(format, `attendance-${reportType}`, rows);

  res.setHeader('Content-Type', exported.mimeType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="attendance-${reportType}-${Date.now()}.${exported.extension}"`
  );

  res.send(exported.buffer);
});

export const getRealtimeAttendanceSnapshot = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireAdminRole(req);

  const settings = await ensureDefaultCompanyAttendanceSettings(organizationId);
  const timezone = settings.timingRules.timezone;
  const today = DateTime.now().setZone(timezone).toFormat('yyyy-LL-dd');

  const [recentPunches, latePunches, invalidPunches, activeEmployees, inPunches] = await Promise.all([
    AttendancePunchModel.find({ organization: organizationId })
      .populate('employee', 'firstName lastName department')
      .sort({ punchTime: -1 })
      .limit(30)
      .lean(),
    AttendancePunchModel.find({
      organization: organizationId,
      punchDate: today,
      punchType: 'IN',
      'workMetrics.lateMinutes': { $gt: 0 }
    })
      .populate('employee', 'firstName lastName department')
      .sort({ punchTime: -1 })
      .lean(),
    AttendancePunchModel.find({
      organization: organizationId,
      punchDate: today,
      'validation.status': { $in: ['invalid', 'pending_approval'] }
    })
      .populate('employee', 'firstName lastName department')
      .sort({ punchTime: -1 })
      .lean(),
    EmployeeModel.find({ organization: organizationId, status: 'active' })
      .select({ _id: 1, firstName: 1, lastName: 1, department: 1 })
      .lean(),
    AttendancePunchModel.find({
      organization: organizationId,
      punchDate: today,
      punchType: 'IN'
    })
      .select({ employee: 1 })
      .lean()
  ]);

  const occupancy = await getCurrentOccupancy(organizationId, today);

  const employeePunchedIn = new Set(inPunches.map((item) => item.employee.toString()));
  const absenteeList = activeEmployees
    .filter((employee) => !employeePunchedIn.has(employee._id.toString()))
    .map((employee) => ({
      employeeId: employee._id,
      name: `${employee.firstName} ${employee.lastName}`.trim(),
      department: employee.department || 'Unassigned'
    }));

  res.json({
    success: true,
    data: {
      generatedAt: new Date().toISOString(),
      currentOccupancy: occupancy,
      liveFeed: recentPunches.map((item) => ({
        id: item._id,
        employee: item.employee,
        punchType: item.punchType,
        punchTime: item.punchTime,
        status: item.validation.status,
        colorHex: item.validation.colorHex,
        location: {
          latitude: item.gps.latitude,
          longitude: item.gps.longitude,
          distance: item.distanceFromOfficeMeters
        }
      })),
      invalidAlerts: invalidPunches.map((item) => ({
        id: item._id,
        employee: item.employee,
        punchTime: item.punchTime,
        reasons: item.validation.reasons,
        colorHex: item.validation.colorHex
      })),
      lateArrivals: latePunches.map((item) => ({
        id: item._id,
        employee: item.employee,
        punchTime: item.punchTime,
        lateMinutes: item.workMetrics.lateMinutes
      })),
      absenteeList
    }
  });
});

export const importAttendanceCsv = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireAdminRole(req);

  const csv = String(req.body.csv ?? '').trim();
  const rowsFromBody = Array.isArray(req.body.rows) ? req.body.rows : null;

  const rows = rowsFromBody ? rowsFromBody : csv ? parseCsvPunchRows(csv) : [];

  if (!rows.length) {
    throw createHttpError(400, 'No rows provided for import');
  }

  const summary = await importAttendancePunches({
    organizationId,
    importedByUserId: req.user?.sub ?? '',
    rows,
    cutoffTimeHHmm: String(req.body.cutoffTime ?? '').trim() || undefined
  });

  await dispatchAttendanceNotification({
    template: 'bulk_sync_completed',
    channels: {
      email: true,
      sms: false,
      push: false,
      inApp: true
    },
    recipient: {
      userId: req.user?.sub,
      email: req.user?.email,
      name: req.user?.email
    },
    payload: {
      count: summary.saved
    }
  });

  res.json({
    success: true,
    data: summary
  });
});

export const importAttendanceBiometric = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndUser(req);
  requireAdminRole(req);

  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) {
    throw createHttpError(400, 'rows are required');
  }

  const normalized = rows.map((item: any) => ({
    ...item,
    source: 'biometric'
  }));

  const summary = await importAttendancePunches({
    organizationId,
    importedByUserId: req.user?.sub ?? '',
    rows: normalized,
    cutoffTimeHHmm: String(req.body.cutoffTime ?? '').trim() || undefined
  });

  res.json({
    success: true,
    data: summary
  });
});
