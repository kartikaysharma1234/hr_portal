import { DateTime } from 'luxon';

import { AttendancePunchModel } from '../../models/AttendancePunch';
import type {
  AttendanceValidationReason,
  PunchType,
  TimeValidationResult,
  UserPunchWindow
} from '../../types/attendance';
import {
  calculateLateEarlyMinutes,
  getDayRange,
  getShiftWindow,
  isHoliday,
  parseHHmm,
  isWeekend,
  isWithinShiftWindow,
  toDateTimeInZone
} from '../../utils/dateTimeUtils';

interface TimeValidationInput {
  organizationId: string;
  employeeId: string;
  punchType: PunchType;
  timestamp: Date;
  timingRules: {
    timezone: string;
    shiftStartTime: string;
    shiftEndTime: string;
    graceInMinutes: number;
    graceOutMinutes: number;
    lateMarkAfterMinutes: number;
    earlyExitAfterMinutes: number;
    halfDayAfterLateMinutes: number;
    absentAfterLateMinutes: number;
    minWorkingHoursForPresent: number;
    allowPunchBeforeShiftMinutes: number;
    allowPunchAfterShiftMinutes: number;
    preventOutsideShiftWindow: boolean;
    minMinutesBetweenPunches: number;
    weekendPunchAllowed: boolean;
    holidayPunchAllowed: boolean;
  };
  punchRules: {
    minTimeBetweenPunchesMinutes: number;
    maxPunchesPerDay: number;
    preventSequentialSamePunchType: boolean;
  };
  holidayDates?: string[];
  userPunchWindow?: UserPunchWindow | null;
}

const reason = (
  code: string,
  message: string,
  severity: 'info' | 'warning' | 'invalid',
  meta?: Record<string, unknown>
): AttendanceValidationReason => ({ code, message, severity, meta });

const isMinuteWithinWindow = (
  currentMinute: number,
  startMinute: number,
  endMinute: number
): boolean => {
  // Supports cross-midnight windows, for example 17:00 -> 08:00.
  if (startMinute <= endMinute) {
    return currentMinute >= startMinute && currentMinute <= endMinute;
  }

  return currentMinute >= startMinute || currentMinute <= endMinute;
};

export const validatePunchTime = async (
  input: TimeValidationInput
): Promise<TimeValidationResult> => {
  const timezone = input.timingRules.timezone || 'UTC';
  const localTs = toDateTimeInZone(input.timestamp, timezone);
  const localDate = localTs.toFormat('yyyy-LL-dd');

  const window = getShiftWindow(localTs.toISO() as string, timezone, input.timingRules.shiftStartTime, input.timingRules.shiftEndTime);

  const reasons: AttendanceValidationReason[] = [];

  if (input.userPunchWindow) {
    const localMinute = localTs.hour * 60 + localTs.minute;
    const inStart = parseHHmm(input.userPunchWindow.punchInStartTime);
    const inEnd = parseHHmm(input.userPunchWindow.punchInEndTime);
    const outStart = parseHHmm(input.userPunchWindow.punchOutStartTime);
    const outEnd = parseHHmm(input.userPunchWindow.punchOutEndTime);

    const inStartMinutes = inStart.hour * 60 + inStart.minute;
    const inEndMinutes = inEnd.hour * 60 + inEnd.minute;
    const outStartMinutes = outStart.hour * 60 + outStart.minute;
    const outEndMinutes = outEnd.hour * 60 + outEnd.minute;

    if (input.punchType === 'IN' && !isMinuteWithinWindow(localMinute, inStartMinutes, inEndMinutes)) {
      reasons.push(
        reason(
          'OUTSIDE_PUNCH_IN_WINDOW',
          `Punch-in allowed between ${input.userPunchWindow.punchInStartTime} and ${input.userPunchWindow.punchInEndTime} (${timezone})`,
          'invalid',
          {
            currentTime: localTs.toFormat('HH:mm'),
            timezone
          }
        )
      );
    }

    if (input.punchType === 'OUT' && !isMinuteWithinWindow(localMinute, outStartMinutes, outEndMinutes)) {
      reasons.push(
        reason(
          'OUTSIDE_PUNCH_OUT_WINDOW',
          `Punch-out allowed between ${input.userPunchWindow.punchOutStartTime} and ${input.userPunchWindow.punchOutEndTime} (${timezone})`,
          'invalid',
          {
            currentTime: localTs.toFormat('HH:mm'),
            timezone
          }
        )
      );
    }
  }

  const weekend = isWeekend(input.timestamp, timezone);
  if (weekend && !input.timingRules.weekendPunchAllowed) {
    reasons.push(reason('WEEKEND_PUNCH_NOT_ALLOWED', 'Punch on weekend is not allowed', 'invalid'));
  }

  const holidays = input.holidayDates ?? [];
  const holiday = isHoliday(input.timestamp, timezone, holidays);
  if (holiday && !input.timingRules.holidayPunchAllowed) {
    reasons.push(reason('HOLIDAY_PUNCH_NOT_ALLOWED', 'Punch on holiday is not allowed', 'invalid'));
  }

  if (
    input.timingRules.preventOutsideShiftWindow &&
    !isWithinShiftWindow(
      input.timestamp,
      window,
      input.timingRules.allowPunchBeforeShiftMinutes,
      input.timingRules.allowPunchAfterShiftMinutes
    )
  ) {
    reasons.push(
      reason(
        'OUTSIDE_SHIFT_WINDOW',
        'Punch is outside allowed shift window',
        'invalid',
        {
          shiftStart: window.shiftStart.toISO(),
          shiftEnd: window.shiftEnd.toISO()
        }
      )
    );
  }

  const dayRange = getDayRange(localDate, timezone);
  const todayPunches = await AttendancePunchModel.find({
    organization: input.organizationId,
    employee: input.employeeId,
    punchTime: {
      $gte: dayRange.start,
      $lte: dayRange.end
    }
  })
    .sort({ punchTime: 1 })
    .select({ punchType: 1, punchTime: 1 })
    .lean();

  if (todayPunches.length >= input.punchRules.maxPunchesPerDay) {
    reasons.push(
      reason(
        'MAX_PUNCH_LIMIT_REACHED',
        `Maximum punches reached for the day (${input.punchRules.maxPunchesPerDay})`,
        'invalid'
      )
    );
  }

  const lastPunch = todayPunches[todayPunches.length - 1] ?? null;
  if (lastPunch) {
    const minutesSinceLast = Math.floor(
      localTs
        .diff(toDateTimeInZone(lastPunch.punchTime, timezone), 'minutes')
        .minutes
    );

    const minGap = Math.max(
      input.timingRules.minMinutesBetweenPunches,
      input.punchRules.minTimeBetweenPunchesMinutes
    );

    if (minutesSinceLast < minGap) {
      reasons.push(
        reason(
          'MIN_TIME_BETWEEN_PUNCHES',
          `Minimum ${minGap} minutes required between punches`,
          'invalid',
          {
            minutesSinceLast
          }
        )
      );
    }

    if (input.punchRules.preventSequentialSamePunchType && lastPunch.punchType === input.punchType) {
      reasons.push(
        reason(
          'SEQUENTIAL_SAME_PUNCH_TYPE',
          `Consecutive ${input.punchType} punches are not allowed`,
          'invalid'
        )
      );
    }
  }

  const diff = calculateLateEarlyMinutes({
    timestamp: input.timestamp,
    type: input.punchType,
    window,
    graceInMinutes: input.timingRules.graceInMinutes,
    graceOutMinutes: input.timingRules.graceOutMinutes
  });

  let statusTag: TimeValidationResult['statusTag'] = 'on_time';

  if (input.punchType === 'IN') {
    if (diff.lateMinutes > 0) {
      statusTag = 'late';
      reasons.push(
        reason('LATE_PUNCH_IN', `Late by ${diff.lateMinutes} minutes`, 'warning', {
          lateMinutes: diff.lateMinutes
        })
      );

      if (diff.lateMinutes >= input.timingRules.absentAfterLateMinutes) {
        statusTag = 'absent';
        reasons.push(
          reason(
            'ABSENT_THRESHOLD_BREACHED',
            `Late beyond absent threshold (${input.timingRules.absentAfterLateMinutes} minutes)`,
            'invalid'
          )
        );
      } else if (diff.lateMinutes >= input.timingRules.halfDayAfterLateMinutes) {
        statusTag = 'half_day';
        reasons.push(
          reason(
            'HALF_DAY_THRESHOLD_BREACHED',
            `Late beyond half-day threshold (${input.timingRules.halfDayAfterLateMinutes} minutes)`,
            'warning'
          )
        );
      }
    }
  } else if (diff.earlyMinutes > 0) {
    statusTag = 'early';
    reasons.push(
      reason('EARLY_PUNCH_OUT', `Early by ${diff.earlyMinutes} minutes`, 'warning', {
        earlyMinutes: diff.earlyMinutes
      })
    );
  }

  if (!reasons.length) {
    reasons.push(reason('TIME_VALID', 'Punch is within allowed timing rules', 'info'));
  }

  if (weekend && input.timingRules.weekendPunchAllowed) {
    statusTag = 'weekend';
  }

  if (holiday && input.timingRules.holidayPunchAllowed) {
    statusTag = 'holiday';
  }

  const hasInvalid = reasons.some((entry) => entry.severity === 'invalid');

  return {
    isWithinWindow: !hasInvalid,
    lateMinutes: diff.lateMinutes,
    earlyExitMinutes: diff.earlyMinutes,
    statusTag,
    reasons,
    shiftStartIso: window.shiftStart.toISO() ?? '',
    shiftEndIso: window.shiftEnd.toISO() ?? ''
  };
};
