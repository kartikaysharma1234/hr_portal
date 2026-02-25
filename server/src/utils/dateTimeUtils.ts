import { DateTime } from 'luxon';

export interface ShiftWindow {
  shiftStart: DateTime;
  shiftEnd: DateTime;
  isOvernight: boolean;
}

export interface WorkingHoursResult {
  totalMinutes: number;
  totalHours: number;
  formatted: string;
}

export const parseHHmm = (value: string): { hour: number; minute: number } => {
  const matched = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!matched) {
    throw new Error(`Invalid time format: ${value}. Expected HH:mm`);
  }

  const hour = Number(matched[1]);
  const minute = Number(matched[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid time range: ${value}`);
  }

  return { hour, minute };
};

export const toDateTimeInZone = (value: Date | string | number, timezone: string): DateTime => {
  if (value instanceof Date) {
    return DateTime.fromJSDate(value, { zone: timezone });
  }

  if (typeof value === 'number') {
    return DateTime.fromMillis(value, { zone: timezone });
  }

  return DateTime.fromISO(value, { zone: timezone });
};

export const getShiftWindow = (
  date: Date | string,
  timezone: string,
  shiftStartHHmm: string,
  shiftEndHHmm: string
): ShiftWindow => {
  const dateInZone = toDateTimeInZone(date, timezone);
  const start = parseHHmm(shiftStartHHmm);
  const end = parseHHmm(shiftEndHHmm);

  let shiftStart = dateInZone.set({ hour: start.hour, minute: start.minute, second: 0, millisecond: 0 });
  let shiftEnd = dateInZone.set({ hour: end.hour, minute: end.minute, second: 0, millisecond: 0 });

  const isOvernight = shiftEnd <= shiftStart;
  if (isOvernight) {
    shiftEnd = shiftEnd.plus({ days: 1 });
  }

  return {
    shiftStart,
    shiftEnd,
    isOvernight
  };
};

export const isWithinShiftWindow = (
  timestamp: Date | string,
  window: ShiftWindow,
  allowedEarlyMinutes: number,
  allowedLateMinutes: number
): boolean => {
  const zone = window.shiftStart.zoneName || 'UTC';
  const ts = toDateTimeInZone(timestamp, zone);
  const startBoundary = window.shiftStart.minus({ minutes: allowedEarlyMinutes });
  const endBoundary = window.shiftEnd.plus({ minutes: allowedLateMinutes });

  return ts >= startBoundary && ts <= endBoundary;
};

export const calculateLateEarlyMinutes = (params: {
  timestamp: Date | string;
  type: 'IN' | 'OUT';
  window: ShiftWindow;
  graceInMinutes: number;
  graceOutMinutes: number;
}): { lateMinutes: number; earlyMinutes: number } => {
  const zone = params.window.shiftStart.zoneName || 'UTC';
  const ts = toDateTimeInZone(params.timestamp, zone);

  if (params.type === 'IN') {
    const lateBase = params.window.shiftStart.plus({ minutes: params.graceInMinutes });
    const lateMinutes = Math.max(0, Math.floor(ts.diff(lateBase, 'minutes').minutes));
    return { lateMinutes, earlyMinutes: 0 };
  }

  const earlyBase = params.window.shiftEnd.minus({ minutes: params.graceOutMinutes });
  const earlyMinutes = Math.max(0, Math.floor(earlyBase.diff(ts, 'minutes').minutes));
  return { lateMinutes: 0, earlyMinutes };
};

export const calculateWorkingHours = (
  punchInAt: Date | string,
  punchOutAt: Date | string,
  timezone: string
): WorkingHoursResult => {
  const start = toDateTimeInZone(punchInAt, timezone);
  const end = toDateTimeInZone(punchOutAt, timezone);

  if (end <= start) {
    return {
      totalMinutes: 0,
      totalHours: 0,
      formatted: '00:00'
    };
  }

  const totalMinutes = Math.floor(end.diff(start, 'minutes').minutes);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return {
    totalMinutes,
    totalHours: Number((totalMinutes / 60).toFixed(2)),
    formatted: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  };
};

export const isWeekend = (date: Date | string, timezone: string): boolean => {
  const d = toDateTimeInZone(date, timezone);
  return d.weekday === 6 || d.weekday === 7;
};

export const isHoliday = (
  date: Date | string,
  timezone: string,
  holidayDates: string[]
): boolean => {
  if (!holidayDates.length) {
    return false;
  }

  const key = toDateTimeInZone(date, timezone).toFormat('yyyy-LL-dd');
  return holidayDates.includes(key);
};

export const applyGracePeriod = (minutes: number, grace: number): number => {
  if (minutes <= grace) {
    return 0;
  }

  return minutes - grace;
};

export const formatDateForTimezone = (
  date: Date | string,
  timezone: string,
  format = 'yyyy-LL-dd HH:mm:ss'
): string => {
  return toDateTimeInZone(date, timezone).toFormat(format);
};

export const getMonthRange = (
  year: number,
  month: number,
  timezone: string
): { start: Date; end: Date } => {
  const start = DateTime.fromObject({ year, month, day: 1 }, { zone: timezone }).startOf('day');
  const end = start.endOf('month').endOf('day');

  return {
    start: start.toJSDate(),
    end: end.toJSDate()
  };
};

export const getDayRange = (
  date: string,
  timezone: string
): { start: Date; end: Date } => {
  const dt = DateTime.fromISO(date, { zone: timezone });
  if (!dt.isValid) {
    throw new Error(`Invalid date: ${date}`);
  }

  return {
    start: dt.startOf('day').toJSDate(),
    end: dt.endOf('day').toJSDate()
  };
};
