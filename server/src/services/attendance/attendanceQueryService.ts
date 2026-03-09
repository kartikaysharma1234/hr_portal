import { DateTime } from 'luxon';

import { AttendancePunchModel } from '../../models/AttendancePunch';
import { EmployeeModel } from '../../models/Employee';
import { UserModel } from '../../models/User';
import type { AttendancePunch } from '../../models/AttendancePunch';
import { calculateWorkingHours } from '../../utils/dateTimeUtils';

export interface EmployeeContext {
  employeeId: string;
  employeeName: string;
  department: string;
  shiftCode: string;
}

type EmployeeLookupRecord = {
  _id: { toString(): string };
  employeeCode: string;
  firstName: string;
  lastName: string;
  department?: string;
  status?: string;
};

type UserLookupRecord = {
  _id: { toString(): string };
  name?: string;
  email?: string;
  isActive?: boolean;
};

const splitNameParts = (rawName: string, fallbackEmail: string): {
  firstName: string;
  lastName: string;
} => {
  const trimmed = rawName.trim();
  if (trimmed) {
    const pieces = trimmed.split(/\s+/).filter(Boolean);
    const firstName = pieces[0] || 'Employee';
    const lastName = pieces.slice(1).join(' ') || 'User';
    return { firstName, lastName };
  }

  const localPart = fallbackEmail.split('@')[0]?.trim() || '';
  const fallbackPieces = localPart
    .replace(/[._-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (fallbackPieces.length) {
    const firstName = fallbackPieces[0] || 'Employee';
    const lastName = fallbackPieces.slice(1).join(' ') || 'User';
    return { firstName, lastName };
  }

  return {
    firstName: 'Employee',
    lastName: 'User'
  };
};

const normalizeCodeFragment = (value: string): string => {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

const buildEmployeeCodeBase = (email: string, userId: string): string => {
  const localPart = email.split('@')[0] || '';
  const prefix = normalizeCodeFragment(localPart).slice(0, 4) || 'EMP';
  const suffix = normalizeCodeFragment(userId).slice(-4) || Date.now().toString().slice(-4);
  return `${prefix}${suffix}`;
};

const isDuplicateKeyError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  return (error as { code?: number }).code === 11000;
};

const ensureEmployeeForUser = async (params: {
  organizationId: string;
  userId: string;
  userEmail: string;
  userName: string;
}): Promise<EmployeeLookupRecord> => {
  const existing = (await EmployeeModel.findOne({
    organization: params.organizationId,
    workEmail: params.userEmail
  })
    .sort({ createdAt: 1 })
    .lean()) as EmployeeLookupRecord | null;

  if (existing) {
    return existing;
  }

  const { firstName, lastName } = splitNameParts(params.userName, params.userEmail);
  const codeBase = buildEmployeeCodeBase(params.userEmail, params.userId);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const employeeCode = attempt === 0 ? codeBase : `${codeBase}${attempt}`;

    try {
      const created = await EmployeeModel.create({
        organization: params.organizationId,
        employeeCode,
        firstName,
        lastName,
        workEmail: params.userEmail,
        dateOfJoining: new Date(),
        status: 'active',
        employmentType: 'full_time',
        createdBy: params.userId
      });

      return created.toObject() as EmployeeLookupRecord;
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }

      const employeeByEmail = (await EmployeeModel.findOne({
        organization: params.organizationId,
        workEmail: params.userEmail
      })
        .sort({ createdAt: 1 })
        .lean()) as EmployeeLookupRecord | null;

      if (employeeByEmail) {
        return employeeByEmail;
      }
    }
  }

  throw new Error(
    'Unable to create linked employee profile automatically. Please contact administrator.'
  );
};

export const resolveEmployeeContextForUser = async (params: {
  organizationId: string;
  userId: string;
  userEmail: string;
}): Promise<EmployeeContext> => {
  const tokenEmail = String(params.userEmail ?? '').trim().toLowerCase();
  const user = (await UserModel.findOne({
    _id: params.userId,
    organization: params.organizationId
  })
    .select({ _id: 1, name: 1, email: 1, isActive: 1 })
    .lean()) as UserLookupRecord | null;

  const linkedEmail = String(user?.email ?? tokenEmail).trim().toLowerCase();
  if (!linkedEmail) {
    throw new Error(
      'No employee profile is linked with this account. Create employee record with same work email first.'
    );
  }

  let employee = (await EmployeeModel.findOne({
    organization: params.organizationId,
    workEmail: linkedEmail
  })
    .sort({ createdAt: 1 })
    .lean()) as EmployeeLookupRecord | null;

  if (!employee) {
    employee = await ensureEmployeeForUser({
      organizationId: params.organizationId,
      userId: params.userId,
      userEmail: linkedEmail,
      userName: String(user?.name ?? '')
    });
  }

  if (!employee) {
    throw new Error(
      'No employee profile is linked with this account. Create employee record with same work email first.'
    );
  }

  if (String(employee.status ?? '').toLowerCase() !== 'active') {
    throw new Error(
      `Linked employee profile (${employee.employeeCode}) is inactive. Contact HR/admin to activate it first.`
    );
  }

  return {
    employeeId: employee._id.toString(),
    employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
    department: employee.department || 'general',
    shiftCode: 'default'
  };
};

export interface AttendanceDaySummary {
  date: string;
  inTime: Date | null;
  outTime: Date | null;
  workingMinutes: number;
  workingHoursText: string;
  status: 'present' | 'absent' | 'half_day' | 'invalid' | 'warning' | 'pending_approval';
  colorHex: string;
  colorClass: string;
  distanceFromOfficeMeters: number | null;
  validationReasons: Array<{ code: string; message: string; severity: string }>;
}

const groupByDate = (punches: Array<AttendancePunch & { _id: unknown }>): Map<string, AttendancePunch[]> => {
  const map = new Map<string, AttendancePunch[]>();

  for (const punch of punches) {
    if (!map.has(punch.punchDate)) {
      map.set(punch.punchDate, []);
    }

    map.get(punch.punchDate)?.push(punch);
  }

  return map;
};

export const buildAttendanceDaySummaries = (
  punches: Array<AttendancePunch & { _id: unknown }>,
  timezone: string
): AttendanceDaySummary[] => {
  const grouped = groupByDate(punches);

  const rows: AttendanceDaySummary[] = [];

  for (const [date, dayPunches] of grouped.entries()) {
    dayPunches.sort((a, b) => new Date(a.punchTime).getTime() - new Date(b.punchTime).getTime());

    const firstIn = dayPunches.find((item) => item.punchType === 'IN') ?? null;
    const lastOut = [...dayPunches].reverse().find((item) => item.punchType === 'OUT') ?? null;

    let workingMinutes = 0;
    let workingHoursText = '00:00';

    if (firstIn && lastOut) {
      const work = calculateWorkingHours(firstIn.punchTime, lastOut.punchTime, timezone);
      workingMinutes = work.totalMinutes;
      workingHoursText = work.formatted;
    }

    const priorities = {
      invalid: 4,
      pending_approval: 3,
      warning: 2,
      valid: 1
    } as const;

    const topPunch = [...dayPunches].sort((a, b) => {
      const scoreA = priorities[a.validation.status as keyof typeof priorities] ?? 0;
      const scoreB = priorities[b.validation.status as keyof typeof priorities] ?? 0;
      return scoreB - scoreA;
    })[0];

    rows.push({
      date,
      inTime: firstIn?.punchTime ?? null,
      outTime: lastOut?.punchTime ?? null,
      workingMinutes,
      workingHoursText,
      status:
        topPunch.validation.status === 'valid'
          ? 'present'
          : (topPunch.validation.status as AttendanceDaySummary['status']),
      colorHex: topPunch.validation.colorHex,
      colorClass: topPunch.validation.colorClass,
      distanceFromOfficeMeters: topPunch.distanceFromOfficeMeters,
      validationReasons: (topPunch.validation.reasons ?? []).map((item: any) => ({
        code: item.code,
        message: item.message,
        severity: item.severity
      }))
    });
  }

  rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  return rows;
};

export const getCurrentOccupancy = async (organizationId: string, date: string): Promise<number> => {
  const punches = await AttendancePunchModel.find({
    organization: organizationId,
    punchDate: date
  })
    .sort({ punchTime: 1 })
    .select({ employee: 1, punchType: 1 })
    .lean();

  const lastPunchByEmployee = new Map<string, 'IN' | 'OUT'>();

  for (const punch of punches) {
    lastPunchByEmployee.set(String(punch.employee), punch.punchType as 'IN' | 'OUT');
  }

  let inCount = 0;
  for (const type of lastPunchByEmployee.values()) {
    if (type === 'IN') {
      inCount += 1;
    }
  }

  return inCount;
};

export const buildTodayDateKey = (timezone: string): string => {
  return DateTime.now().setZone(timezone).toFormat('yyyy-LL-dd');
};
