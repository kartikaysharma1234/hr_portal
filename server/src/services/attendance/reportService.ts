import { DateTime } from 'luxon';

import { AttendancePunchModel } from '../../models/AttendancePunch';
import { EmployeeModel } from '../../models/Employee';
import { buildAttendanceDaySummaries } from './attendanceQueryService';
import { getDayRange, getMonthRange } from '../../utils/dateTimeUtils';

export const buildDailyAttendanceReport = async (params: {
  organizationId: string;
  date: string;
  timezone: string;
}): Promise<Array<Record<string, unknown>>> => {
  const range = getDayRange(params.date, params.timezone);

  const punches = (await AttendancePunchModel.find({
    organization: params.organizationId,
    punchTime: {
      $gte: range.start,
      $lte: range.end
    }
  })
    .sort({ punchTime: 1 })
    .lean()) as any[];

  const summaries = buildAttendanceDaySummaries(punches as never, params.timezone);
  const employees = await EmployeeModel.find({ organization: params.organizationId, status: 'active' })
    .select({ firstName: 1, lastName: 1, _id: 1, department: 1 })
    .lean();

  const byEmployee = new Map<string, typeof punches>();
  for (const punch of punches) {
    const employeeId = punch.employee.toString();
    if (!byEmployee.has(employeeId)) {
      byEmployee.set(employeeId, []);
    }

    byEmployee.get(employeeId)?.push(punch);
  }

  return employees.map((employee) => {
    const dayPunches = byEmployee.get(employee._id.toString()) ?? [];
    const firstIn = dayPunches.find((item) => item.punchType === 'IN') ?? null;
    const lastOut = [...dayPunches].reverse().find((item) => item.punchType === 'OUT') ?? null;

    const summary = summaries.find((item) => item.date === params.date && firstIn);

    return {
      date: params.date,
      employeeId: employee._id.toString(),
      employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
      department: employee.department || 'Unassigned',
      inTime: firstIn?.punchTime ?? null,
      outTime: lastOut?.punchTime ?? null,
      workingHours: summary?.workingHoursText ?? '00:00',
      status: dayPunches.length ? summary?.status ?? 'present' : 'absent'
    };
  });
};

export const buildMonthlyAttendanceSummary = async (params: {
  organizationId: string;
  year: number;
  month: number;
  timezone: string;
}): Promise<Array<Record<string, unknown>>> => {
  const range = getMonthRange(params.year, params.month, params.timezone);

  const punches = (await AttendancePunchModel.find({
    organization: params.organizationId,
    punchTime: {
      $gte: range.start,
      $lte: range.end
    }
  })
    .sort({ punchTime: 1 })
    .lean()) as any[];

  const byEmployee = new Map<string, typeof punches>();
  for (const punch of punches) {
    const key = punch.employee.toString();
    if (!byEmployee.has(key)) {
      byEmployee.set(key, []);
    }

    byEmployee.get(key)?.push(punch);
  }

  const employees = await EmployeeModel.find({ organization: params.organizationId, status: 'active' })
    .select({ firstName: 1, lastName: 1, _id: 1, department: 1 })
    .lean();

  return employees.map((employee) => {
    const employeePunches = byEmployee.get(employee._id.toString()) ?? [];

    const byDate = new Map<string, typeof employeePunches>();
    for (const punch of employeePunches) {
      if (!byDate.has(punch.punchDate)) {
        byDate.set(punch.punchDate, []);
      }

      byDate.get(punch.punchDate)?.push(punch);
    }

    let presentDays = 0;
    let lateDays = 0;
    let earlyDays = 0;
    let invalidDays = 0;

    for (const dayPunches of byDate.values()) {
      const statusSet = new Set(dayPunches.map((item) => item.validation.status));
      if (statusSet.has('invalid')) {
        invalidDays += 1;
      }

      if (statusSet.has('warning') || dayPunches.some((item) => item.workMetrics.lateMinutes > 0)) {
        lateDays += 1;
      }

      if (dayPunches.some((item) => item.workMetrics.earlyExitMinutes > 0)) {
        earlyDays += 1;
      }

      if (dayPunches.some((item) => item.punchType === 'IN')) {
        presentDays += 1;
      }
    }

    return {
      employeeId: employee._id.toString(),
      employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
      department: employee.department || 'Unassigned',
      month: params.month,
      year: params.year,
      presentDays,
      lateDays,
      earlyDays,
      invalidDays
    };
  });
};

export const buildInvalidPunchMapReport = async (params: {
  organizationId: string;
  startDate: Date;
  endDate: Date;
}): Promise<Array<Record<string, unknown>>> => {
  const rows = (await AttendancePunchModel.find({
    organization: params.organizationId,
    punchTime: {
      $gte: params.startDate,
      $lte: params.endDate
    },
    'validation.status': { $in: ['invalid', 'pending_approval'] }
  })
    .sort({ punchTime: -1 })
    .populate('employee', 'firstName lastName department')
    .lean()) as any[];

  return rows.map((row) => ({
    punchId: row._id.toString(),
    employee: `${(row.employee as { firstName?: string; lastName?: string })?.firstName ?? ''} ${(row.employee as { firstName?: string; lastName?: string })?.lastName ?? ''}`.trim(),
    department: (row.employee as { department?: string })?.department ?? '',
    date: row.punchDate,
    punchType: row.punchType,
    latitude: row.gps.latitude,
    longitude: row.gps.longitude,
    distanceFromOfficeMeters: row.distanceFromOfficeMeters,
    status: row.validation.status,
    reasons: row.validation.reasons.map((reason: any) => reason.code).join('|')
  }));
};

export const buildDepartmentWiseAttendance = async (params: {
  organizationId: string;
  startDate: Date;
  endDate: Date;
}): Promise<Array<Record<string, unknown>>> => {
  const rows = await AttendancePunchModel.aggregate([
    {
      $match: {
        organization: params.organizationId,
        punchTime: {
          $gte: params.startDate,
          $lte: params.endDate
        }
      }
    },
    {
      $lookup: {
        from: 'employees',
        localField: 'employee',
        foreignField: '_id',
        as: 'employeeDoc'
      }
    },
    {
      $unwind: '$employeeDoc'
    },
    {
      $group: {
        _id: '$employeeDoc.department',
        totalPunches: { $sum: 1 },
        validPunches: {
          $sum: {
            $cond: [{ $eq: ['$validation.status', 'valid'] }, 1, 0]
          }
        },
        invalidPunches: {
          $sum: {
            $cond: [{ $in: ['$validation.status', ['invalid', 'pending_approval']] }, 1, 0]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        department: { $ifNull: ['$_id', 'Unassigned'] },
        totalPunches: 1,
        validPunches: 1,
        invalidPunches: 1,
        validityPercent: {
          $cond: [
            { $eq: ['$totalPunches', 0] },
            0,
            {
              $round: [
                {
                  $multiply: [{ $divide: ['$validPunches', '$totalPunches'] }, 100]
                },
                2
              ]
            }
          ]
        }
      }
    },
    {
      $sort: {
        department: 1
      }
    }
  ]);

  return rows;
};

export const buildLateArrivalTrend = async (params: {
  organizationId: string;
  days: number;
  timezone: string;
}): Promise<Array<Record<string, unknown>>> => {
  const end = DateTime.now().setZone(params.timezone).endOf('day');
  const start = end.minus({ days: Math.max(1, params.days - 1) }).startOf('day');

  const rows = await AttendancePunchModel.aggregate([
    {
      $match: {
        organization: params.organizationId,
        punchTime: {
          $gte: start.toJSDate(),
          $lte: end.toJSDate()
        },
        punchType: 'IN',
        'workMetrics.lateMinutes': { $gt: 0 }
      }
    },
    {
      $group: {
        _id: '$punchDate',
        lateCount: { $sum: 1 },
        avgLateMinutes: { $avg: '$workMetrics.lateMinutes' }
      }
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        lateCount: 1,
        avgLateMinutes: { $round: ['$avgLateMinutes', 2] }
      }
    },
    {
      $sort: {
        date: 1
      }
    }
  ]);

  return rows;
};

export const buildDistanceTravelReport = async (params: {
  organizationId: string;
  startDate: Date;
  endDate: Date;
}): Promise<Array<Record<string, unknown>>> => {
  const rows = await AttendancePunchModel.aggregate([
    {
      $match: {
        organization: params.organizationId,
        punchTime: {
          $gte: params.startDate,
          $lte: params.endDate
        },
        distanceFromOfficeMeters: { $ne: null }
      }
    },
    {
      $lookup: {
        from: 'employees',
        localField: 'employee',
        foreignField: '_id',
        as: 'employeeDoc'
      }
    },
    {
      $unwind: '$employeeDoc'
    },
    {
      $group: {
        _id: '$employee',
        employeeName: {
          $first: {
            $concat: ['$employeeDoc.firstName', ' ', '$employeeDoc.lastName']
          }
        },
        avgDistanceMeters: { $avg: '$distanceFromOfficeMeters' },
        maxDistanceMeters: { $max: '$distanceFromOfficeMeters' },
        punchCount: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        employeeId: '$_id',
        employeeName: 1,
        avgDistanceMeters: { $round: ['$avgDistanceMeters', 2] },
        maxDistanceMeters: { $round: ['$maxDistanceMeters', 2] },
        punchCount: 1
      }
    },
    {
      $sort: {
        avgDistanceMeters: -1
      }
    }
  ]);

  return rows;
};

export const buildPunchSourceAnalysis = async (params: {
  organizationId: string;
  startDate: Date;
  endDate: Date;
}): Promise<Array<Record<string, unknown>>> => {
  const rows = await AttendancePunchModel.aggregate([
    {
      $match: {
        organization: params.organizationId,
        punchTime: {
          $gte: params.startDate,
          $lte: params.endDate
        }
      }
    },
    {
      $group: {
        _id: '$punchSource',
        count: { $sum: 1 },
        invalidCount: {
          $sum: {
            $cond: [{ $in: ['$validation.status', ['invalid', 'pending_approval']] }, 1, 0]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        source: '$_id',
        count: 1,
        invalidCount: 1,
        invalidPercent: {
          $cond: [
            { $eq: ['$count', 0] },
            0,
            {
              $round: [{ $multiply: [{ $divide: ['$invalidCount', '$count'] }, 100] }, 2]
            }
          ]
        }
      }
    },
    {
      $sort: {
        count: -1
      }
    }
  ]);

  return rows;
};
