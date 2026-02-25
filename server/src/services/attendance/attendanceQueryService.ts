import { DateTime } from 'luxon';

import { AttendancePunchModel } from '../../models/AttendancePunch';
import { EmployeeModel } from '../../models/Employee';
import type { AttendancePunch } from '../../models/AttendancePunch';
import { calculateWorkingHours } from '../../utils/dateTimeUtils';

export interface EmployeeContext {
  employeeId: string;
  employeeName: string;
  department: string;
  shiftCode: string;
}

export const resolveEmployeeContextForUser = async (params: {
  organizationId: string;
  userId: string;
  userEmail: string;
}): Promise<EmployeeContext> => {
  const employee = await EmployeeModel.findOne({
    organization: params.organizationId,
    $or: [{ workEmail: params.userEmail.toLowerCase() }, { managerUser: params.userId }],
    status: 'active'
  })
    .sort({ createdAt: 1 })
    .lean();

  if (!employee) {
    throw new Error(
      'No employee profile is linked with this account. Create employee record with same work email first.'
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
