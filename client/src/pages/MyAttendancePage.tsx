import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { attendanceApi } from '../api/attendanceApi';
import { useAuth } from '../context/AuthContext';
import type {
  AttendanceDailyDetail,
  AttendanceLedgerEmployee,
  AttendanceHistoryRow,
  AttendanceLeaveLedger,
  AttendanceProfileContext,
  AttendanceValidationReason,
  LeaveTypeCode,
} from '../types/attendance';
import type { LeaveRequestRecord } from '../types/leaveRequest';
import '../styles/attendance_glossy.css';

type AttendanceView = 'daily' | 'monthly' | 'yearly' | 'leave-ledger';
type UiStatusCode = string;

interface MyAttendancePageProps {
  view: AttendanceView;
}

interface MonthlyDisplayRow {
  dateKey: string;
  dateLabel: string;
  dayNumber: number;
  weekday: string;
  planned: string;
  inTime: string;
  outTime: string;
  totalHr: string;
  status: UiStatusCode;
  late: string;
  early: string;
  canRegularizeSubmit: boolean;
  regularizeBlockedReason: string;
  weeklyHours: string;
}

interface YearlyDetailRow {
  dateKey: string;
  dayNumber: number;
  weekday: string;
  planned: string;
  inTime: string;
  outTime: string;
  status: string;
  totalHr: string;
  late: string;
  early: string;
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const leaveLabelByCode: Record<LeaveTypeCode, string> = {
  PL: 'Privilege Leave',
  CL: 'Casual Leave',
  SL: 'Sick Leave',
  OH: 'Optional Holiday',
};

const baseStatusClass: Record<string, string> = {
  P: 'attx-status--p',
  A: 'attx-status--a',
  LWP: 'attx-status--a',
  HDP: 'attx-status--a',
  WO: 'attx-status--wo',
  W: 'attx-status--w',
  I: 'attx-status--i',
  PA: 'attx-status--pa',
  PL: 'attx-status--pl',
  CL: 'attx-status--cl',
  SL: 'attx-status--sl',
  HSL: 'attx-status--hsl',
  PH: 'attx-status--ph',
  OH: 'attx-status--ph',
};

const halfDayLeaveCodes = new Set(['HCL', 'HPL', 'HSL', 'HCO', 'HOD', 'HWFH', 'HDP', 'HTL']);

const isHalfDayCode = (statusCode: string): boolean => {
  const normalized = statusCode.trim().toUpperCase();
  if (!normalized) {
    return false;
  }

  if (normalized.includes('+')) {
    return true;
  }

  return halfDayLeaveCodes.has(normalized) || normalized.startsWith('H');
};

const getStatusClass = (statusCode: string): string => {
  const normalized = statusCode.trim().toUpperCase();
  if (!normalized || normalized === '-') {
    return '';
  }

  if (baseStatusClass[normalized]) {
    return baseStatusClass[normalized];
  }

  if (normalized.includes('+')) {
    return 'attx-status--half-combo';
  }

  if (normalized === 'WFH') {
    return 'attx-status--wfh';
  }

  if (normalized === 'OD') {
    return 'attx-status--od';
  }

  if (normalized === 'COF') {
    return 'attx-status--cof';
  }

  if (
    normalized === 'SPL' ||
    normalized === 'PTL' ||
    normalized === 'TL' ||
    normalized === 'ML' ||
    normalized === 'EW'
  ) {
    return 'attx-status--leave-alt';
  }

  if (isHalfDayCode(normalized)) {
    return 'attx-status--half-leave';
  }

  return 'attx-status--leave';
};

const yearlyStatusLegend = [
  ['Present', 'P'],
  ['Absent / L.W.P', 'LWP'],
  ['Week Off', 'WO'],
  ['Warning', 'W'],
  ['Invalid', 'I'],
  ['Pending Approval', 'PA'],
  ['Casual Leave', 'CL'],
  ['Privilege Leave', 'PL'],
  ['Maternity Leave', 'ML'],
  ['Sick Leave', 'SL'],
  ['Public Holiday', 'PH'],
  ['Compensatory Off', 'COF'],
  ['Outdoor Duty', 'OD'],
  ['Optional Holiday', 'OH'],
  ['Extra Working', 'EW'],
  ['Paternity Leave', 'PTL'],
  ['Work From Home', 'WFH'],
  ['Trainee Leave', 'TL'],
  ['Special Leave', 'SPL'],
  ['Half Day Absent/LWP', 'HDP'],
  ['Half Compensatory Off', 'HCO'],
];

const yearlyHalfDayLegend = [
  ['Half Casual Leave', 'HCL'],
  ['Half Privilege Leave', 'HPL'],
  ['Half Sick Leave', 'HSL'],
  ['Half Compensatory Off', 'HCO'],
  ['Half Outdoor Duty', 'HOD'],
  ['Half Trainee Leave', 'HTL'],
  ['Half Work From Home', 'HWFH'],
  ['Half PL + Half OD', 'HPL+HOD'],
  ['Half CL + Half OD', 'HCL+HOD'],
  ['Half SL + Half OD', 'HSL+HOD'],
  ['Half CO + Half OD', 'HCO+HOD'],
  ['Half PL + Half LWP', 'HPL+HDP'],
  ['Half CL + Half LWP', 'HCL+HDP'],
  ['Half SL + Half LWP', 'HSL+HDP'],
  ['Half CO + Half LWP', 'HCO+HDP'],
  ['Half Day LWP + Half OD', 'HDP+HOD'],
  ['Half OD + Half OD', 'HOD+HOD'],
  ['Half TL + Half OD', 'HTL+HOD'],
  ['Half TL + Half LWP', 'HTL+HDP'],
  ['Half PL + Half WFH', 'HPL+HWFH'],
  ['Half CL + Half WFH', 'HCL+HWFH'],
  ['Half SL + Half WFH', 'HSL+HWFH'],
  ['Half CO + Half WFH', 'HCO+HWFH'],
  ['Half LWP + Half WFH', 'HDP+HWFH'],
  ['Half OD + Half WFH', 'HOD+HWFH'],
  ['Half TL + Half WFH', 'HTL+HWFH'],
  ['Half WFH + Half WFH', 'HWFH+HWFH'],
];

const halfDayCodePriority = ['HPL', 'HCL', 'HSL', 'HCO', 'HTL', 'HDP', 'HOD', 'HWFH'] as const;

const normalizeHalfDayCombo = (codes: string[]): string => {
  const cleaned = codes.map((item) => item.trim().toUpperCase()).filter(Boolean);
  if (!cleaned.length) {
    return '';
  }

  if (cleaned.length >= 2 && cleaned[0] === cleaned[1]) {
    return `${cleaned[0]}+${cleaned[1]}`;
  }

  const unique = Array.from(new Set(cleaned));
  if (unique.length === 1) {
    return unique[0];
  }

  const priorityOf = (code: string): number => {
    const index = halfDayCodePriority.indexOf(code as (typeof halfDayCodePriority)[number]);
    return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
  };

  const ordered = unique
    .slice(0, 2)
    .sort((left, right) => {
      const leftPriority = priorityOf(left);
      const rightPriority = priorityOf(right);
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return left.localeCompare(right);
    });

  return ordered.join('+');
};

const buildLeaveDateCodeMap = (params: {
  rows: LeaveRequestRecord[];
  year: number;
}): Map<string, string> => {
  const map = new Map<string, string>();
  const yearStart = `${params.year}-01-01`;
  const yearEnd = `${params.year}-12-31`;

  const upsertHalfDayCode = (dateKey: string, leaveCode: string): void => {
    const existing = map.get(dateKey);
    if (!existing) {
      map.set(dateKey, leaveCode);
      return;
    }

    if (!isHalfDayCode(existing)) {
      return;
    }

    const existingCodes = existing
      .split('+')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

    if (existingCodes.includes(leaveCode)) {
      if (existingCodes.length === 1 && existingCodes[0] === leaveCode) {
        map.set(dateKey, `${leaveCode}+${leaveCode}`);
      }
      return;
    }

    const merged = normalizeHalfDayCombo([...existingCodes, leaveCode]);
    if (merged) {
      map.set(dateKey, merged);
    }
  };

  for (const row of params.rows) {
    if (row.status !== 'approved') {
      continue;
    }

    const leaveCode = String(row.leaveType ?? '').trim().toUpperCase();
    if (!leaveCode) {
      continue;
    }

    const start = parseIsoDate(row.fromDate);
    const end = parseIsoDate(row.toDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      continue;
    }

    const isHalfDayLeave = row.durationType !== 'full_day' || isHalfDayCode(leaveCode);
    let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const lastDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    while (cursor <= lastDate) {
      const dateKey = toIsoDate(cursor);
      if (dateKey >= yearStart && dateKey <= yearEnd) {
        if (isHalfDayLeave) {
          upsertHalfDayCode(dateKey, leaveCode);
        } else {
          map.set(dateKey, leaveCode);
        }
      }

      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }
  }

  return map;
};

const pad = (value: number): string => String(value).padStart(2, '0');

const toIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseIsoDate = (isoDate: string): Date => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const formatDisplayDate = (isoDate: string): string => {
  const date = parseIsoDate(isoDate);
  return `${pad(date.getDate())}-${monthNames[date.getMonth()]}-${date.getFullYear()}`;
};

const toIsoFromDisplayDate = (displayDate: string): string => {
  const trimmed = displayDate.trim();
  const matcher = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(trimmed);
  if (!matcher) {
    return trimmed;
  }

  const [, day, monAbbr, year] = matcher;
  const monthIndex = monthNames.findIndex(
    (monthName) => monthName.toLowerCase() === monAbbr.toLowerCase()
  );
  if (monthIndex < 0) {
    return trimmed;
  }

  return `${year}-${pad(monthIndex + 1)}-${day}`;
};

const formatInputMonth = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

const monthRangeFromInput = (monthInput: string): {
  year: number;
  month: number;
  daysInMonth: number;
  startDate: string;
  endDate: string;
} => {
  const [yearRaw, monthRaw] = monthInput.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  return {
    year,
    month,
    daysInMonth: end.getDate(),
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
};

const formatTime = (value: string | null): string => {
  if (!value) {
    return '--:--';
  }

  const date = new Date(value);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const formatMinutesAsHours = (value: number): string => {
  const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${pad(hours)}:${pad(minutes)}`;
};

const parseClockToMinutes = (value: string): number | null => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
};

const calculateRegularizeWorkingHours = (inTime: string, outTime: string): string => {
  const inMinutes = parseClockToMinutes(inTime);
  const outMinutes = parseClockToMinutes(outTime);
  if (inMinutes === null || outMinutes === null) {
    return '00:00';
  }

  let duration = outMinutes - inMinutes;
  if (duration < 0) {
    duration += 24 * 60;
  }

  return formatMinutesAsHours(duration);
};

const formatDistanceKm = (meters: number | null): string => {
  if (meters === null || !Number.isFinite(meters)) {
    return '--';
  }

  return `${(meters / 1000).toFixed(2)} km`;
};

const toUiStatusCode = (status?: string): UiStatusCode => {
  if (status === 'present') return 'P';
  if (status === 'warning') return 'W';
  if (status === 'invalid') return 'I';
  if (status === 'pending_approval') return 'PA';
  if (status === 'absent') return 'A';
  return '-';
};

const regularizeStatusLabelMap: Record<string, string> = {
  P: 'Present',
  A: 'Absent',
  LWP: 'Absent / L.W.P',
  WO: 'Weekly Off',
  PH: 'Public Holiday',
  OH: 'Optional Holiday',
  W: 'Warning',
  I: 'Invalid',
  PA: 'Pending Approval',
};

const formatRegularizeMarkedAs = (statusCode: string): string => {
  const normalized = statusCode.trim().toUpperCase();
  if (!normalized || normalized === '-') {
    return '-';
  }

  const label = regularizeStatusLabelMap[normalized] ?? normalized;
  return `${label} (${normalized})`;
};

const toPlannedCode = (statusCode: string): string => {
  const normalized = statusCode.trim().toUpperCase();
  if (!normalized || normalized === '-') {
    return '-';
  }

  const nonPlanned = new Set(['P', 'A', 'LWP', 'W', 'I', 'PA']);
  if (nonPlanned.has(normalized)) {
    return '-';
  }

  return normalized;
};

const toTimeOrZero = (value: string | null | undefined): string => {
  return value ? formatTime(value) : '00:00';
};

const extractDurationFromReasons = (
  reasons: AttendanceValidationReason[] | undefined,
  pattern: RegExp
): string => {
  if (!reasons?.length) {
    return '--';
  }

  const reason = reasons.find((item) => pattern.test(item.code));
  if (!reason) {
    return '--';
  }

  const numericMatch = reason.message.match(/(\d{1,3})/);
  if (!numericMatch) {
    return '--';
  }

  const minutes = Number(numericMatch[1]);
  return `00:${pad(Math.max(0, Math.min(59, minutes)))}`;
};

const normalizeDateOnly = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const isPastWorkingDay = (date: Date): boolean => {
  const target = normalizeDateOnly(date);
  const today = normalizeDateOnly(new Date());

  if (target >= today) {
    return false;
  }

  return target.getDay() !== 0 && target.getDay() !== 6;
};

const getMissingDayStatus = (date: Date): UiStatusCode => {
  const normalizedToday = normalizeDateOnly(new Date());
  const target = normalizeDateOnly(date);

  // Missing attendance should become absent from the next day onward.
  if (target >= normalizedToday) {
    return '-';
  }

  if (target.getDay() === 0 || target.getDay() === 6) {
    return 'WO';
  }

  return 'A';
};

const titleByView: Record<AttendanceView, string> = {
  daily: 'Daily',
  monthly: 'Monthly',
  yearly: 'Yearly',
  'leave-ledger': 'Leave Ledger',
};

export const MyAttendancePage = ({ view }: MyAttendancePageProps): JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isLedgerManager =
    user?.role === 'super_admin' ||
    user?.role === 'admin' ||
    user?.role === 'hr' ||
    user?.role === 'manager';

  const now = new Date();

  const [context, setContext] = useState<AttendanceProfileContext | null>(null);
  const [contextError, setContextError] = useState('');

  const [dailyDate, setDailyDate] = useState(toIsoDate(now));
  const [dailyDetail, setDailyDetail] = useState<AttendanceDailyDetail | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState('');

  const [monthlyInput, setMonthlyInput] = useState(formatInputMonth(now));
  const [monthlyRows, setMonthlyRows] = useState<AttendanceHistoryRow[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState('');
  const [monthlyDetailDate, setMonthlyDetailDate] = useState<string | null>(null);
  const [monthlyDetail, setMonthlyDetail] = useState<AttendanceDailyDetail | null>(null);
  const [monthlyDetailLoading, setMonthlyDetailLoading] = useState(false);
  const [monthlyDetailError, setMonthlyDetailError] = useState('');

  const [regularizeDate, setRegularizeDate] = useState<string | null>(null);
  const [regularizeType, setRegularizeType] = useState<'manual_correction' | 'missed_punch' | 'invalid_punch'>(
    'manual_correction'
  );
  const [regularizeInTime, setRegularizeInTime] = useState('09:30');
  const [regularizeOutTime, setRegularizeOutTime] = useState('18:00');
  const [regularizeReason, setRegularizeReason] = useState('');
  const [regularizeLoading, setRegularizeLoading] = useState(false);
  const [regularizeError, setRegularizeError] = useState('');
  const [regularizeSuccess, setRegularizeSuccess] = useState('');

  const [yearlyYear, setYearlyYear] = useState(String(now.getFullYear()));
  const [yearlyRows, setYearlyRows] = useState<AttendanceHistoryRow[]>([]);
  const [yearlyLeaveRows, setYearlyLeaveRows] = useState<LeaveRequestRecord[]>([]);
  const [yearlySelectedMonth, setYearlySelectedMonth] = useState<number>(now.getMonth() + 1);
  const [yearlyLoading, setYearlyLoading] = useState(false);
  const [yearlyError, setYearlyError] = useState('');
  const [yearlyBalances, setYearlyBalances] = useState<Record<LeaveTypeCode, number>>({
    CL: 0,
    PL: 0,
    SL: 0,
    OH: 0,
  });

  const [ledgerEmployees, setLedgerEmployees] = useState<AttendanceLedgerEmployee[]>([]);
  const [ledgerEmployeesLoading, setLedgerEmployeesLoading] = useState(false);

  const [ledgerFilters, setLedgerFilters] = useState<{
    leaveType: LeaveTypeCode;
    year: string;
    employeeId: string;
  }>({
    leaveType: 'PL',
    year: String(now.getFullYear()),
    employeeId: '',
  });
  const [ledgerApplied, setLedgerApplied] = useState<{
    leaveType: LeaveTypeCode;
    year: string;
    employeeId: string;
  }>({
    leaveType: 'PL',
    year: String(now.getFullYear()),
    employeeId: '',
  });
  const [ledger, setLedger] = useState<AttendanceLeaveLedger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');
  const [ledgerModalMonth, setLedgerModalMonth] = useState<number | null>(null);
  const [ledgerEditMode, setLedgerEditMode] = useState(false);
  const [ledgerDraftOpeningBalance, setLedgerDraftOpeningBalance] = useState('');
  const [ledgerDraftOpeningDate, setLedgerDraftOpeningDate] = useState('');
  const [ledgerDraftMonths, setLedgerDraftMonths] = useState<
    Array<{
      month: number;
      days: number;
      credit: string;
      availed: string;
      availedDates: string;
    }>
  >([]);
  const [ledgerSaveLoading, setLedgerSaveLoading] = useState(false);
  const [ledgerSaveError, setLedgerSaveError] = useState('');
  const [ledgerSaveSuccess, setLedgerSaveSuccess] = useState('');

  const employeeCode = context?.employeeCode ?? 'NA';
  const employeeName = context?.employeeName ?? user?.name ?? 'Employee';

  const loadContext = async (): Promise<void> => {
    try {
      const profile = await attendanceApi.getMyContext();
      setContext(profile);
      setContextError('');
    } catch (caught) {
      setContextError(caught instanceof Error ? caught.message : 'Failed to load employee context');
    }
  };

  const loadLedgerEmployees = async (): Promise<void> => {
    if (!isLedgerManager) {
      return;
    }

    setLedgerEmployeesLoading(true);

    try {
      const rows = await attendanceApi.listLeaveLedgerEmployees({ limit: 200 });
      setLedgerEmployees(rows);
      if (!ledgerFilters.employeeId && rows.length) {
        const fallbackId = rows[0].employeeId;
        setLedgerFilters((prev) => ({ ...prev, employeeId: fallbackId }));
        setLedgerApplied((prev) => ({ ...prev, employeeId: fallbackId }));
      }
    } catch {
      setLedgerEmployees([]);
    } finally {
      setLedgerEmployeesLoading(false);
    }
  };

  const loadDaily = async (date: string): Promise<void> => {
    setDailyLoading(true);
    setDailyError('');

    try {
      const detail = await attendanceApi.getDailyDetail(date);
      setDailyDetail(detail);
    } catch (caught) {
      setDailyDetail(null);
      setDailyError(caught instanceof Error ? caught.message : 'Failed to load daily attendance');
    } finally {
      setDailyLoading(false);
    }
  };

  const loadMonthly = async (monthInput: string): Promise<void> => {
    const range = monthRangeFromInput(monthInput);

    setMonthlyLoading(true);
    setMonthlyError('');

    try {
      const result = await attendanceApi.getMyAttendance({
        startDate: range.startDate,
        endDate: range.endDate,
        page: 1,
        limit: 400,
        view: 'daily',
      });
      setMonthlyRows(result.rows ?? []);
    } catch (caught) {
      setMonthlyRows([]);
      setMonthlyError(caught instanceof Error ? caught.message : 'Failed to load monthly attendance');
    } finally {
      setMonthlyLoading(false);
    }
  };

  const loadMonthlyDetail = async (date: string): Promise<void> => {
    setMonthlyDetailLoading(true);
    setMonthlyDetailError('');

    try {
      const detail = await attendanceApi.getDailyDetail(date);
      setMonthlyDetail(detail);
    } catch (caught) {
      setMonthlyDetail(null);
      setMonthlyDetailError(caught instanceof Error ? caught.message : 'Failed to load day punches');
    } finally {
      setMonthlyDetailLoading(false);
    }
  };

  const loadYearly = async (yearValue: string): Promise<void> => {
    const year = Number(yearValue);
    if (!Number.isInteger(year)) {
      setYearlyError('Year must be valid');
      return;
    }

    setYearlyLoading(true);
    setYearlyError('');

    try {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const [result, leaveRequests] = await Promise.all([
        attendanceApi.getMyAttendance({
          startDate: yearStart,
          endDate: yearEnd,
          page: 1,
          limit: 500,
          view: 'daily',
        }),
        attendanceApi.listLeaveRequests({
          scope: 'mine',
          status: 'approved',
          fromDate: yearStart,
          toDate: yearEnd,
        }),
      ]);
      setYearlyRows(result.rows ?? []);
      setYearlyLeaveRows(
        leaveRequests.filter((row) => {
          return row.status === 'approved' && row.toDate >= yearStart && row.fromDate <= yearEnd;
        })
      );

      const leaveTypes: LeaveTypeCode[] = ['CL', 'PL', 'SL', 'OH'];
      const leaveResponses = await Promise.all(
        leaveTypes.map((leaveType) =>
          attendanceApi
            .getLeaveLedger({ year, leaveType })
            .then((response) => ({ leaveType, value: response.balances.currentBalance }))
            .catch(() => ({ leaveType, value: 0 }))
        )
      );

      const nextBalances: Record<LeaveTypeCode, number> = {
        CL: 0,
        PL: 0,
        SL: 0,
        OH: 0,
      };
      for (const row of leaveResponses) {
        nextBalances[row.leaveType] = row.value;
      }
      setYearlyBalances(nextBalances);
    } catch (caught) {
      setYearlyRows([]);
      setYearlyLeaveRows([]);
      setYearlyError(caught instanceof Error ? caught.message : 'Failed to load yearly attendance');
    } finally {
      setYearlyLoading(false);
    }
  };

  const loadLeaveLedger = async (filters: {
    leaveType: LeaveTypeCode;
    year: string;
    employeeId: string;
  }): Promise<void> => {
    const year = Number(filters.year);
    if (!Number.isInteger(year)) {
      setLedgerError('Year must be valid');
      return;
    }

    setLedgerLoading(true);
    setLedgerError('');

    try {
      const response = await attendanceApi.getLeaveLedger({
        year,
        leaveType: filters.leaveType,
        employeeId: filters.employeeId || undefined,
      });
      setLedger(response);
      setLedgerEditMode(false);
      setLedgerSaveError('');
    } catch (caught) {
      setLedger(null);
      setLedgerError(caught instanceof Error ? caught.message : 'Failed to load leave ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  const beginLedgerEdit = (): void => {
    if (!ledger) {
      return;
    }

    setLedgerEditMode(true);
    setLedgerSaveError('');
    setLedgerSaveSuccess('');
    setLedgerDraftOpeningBalance(String(ledger.openingBalance));
    setLedgerDraftOpeningDate(toIsoFromDisplayDate(ledger.openingBalanceDate));
    setLedgerDraftMonths(
      ledger.months.map((monthRow) => ({
        month: monthRow.month,
        days: monthRow.days,
        credit: String(monthRow.credit),
        availed: String(monthRow.availed),
        availedDates: monthRow.availedDates.join(', '),
      }))
    );
  };

  const saveLedgerEdits = async (): Promise<void> => {
    if (!ledger || !ledgerFilters.employeeId) {
      setLedgerSaveError('Select an employee first.');
      return;
    }

    const year = Number(ledgerFilters.year);
    if (!Number.isInteger(year)) {
      setLedgerSaveError('Year must be valid.');
      return;
    }

    setLedgerSaveLoading(true);
    setLedgerSaveError('');
    setLedgerSaveSuccess('');

    try {
      const updated = await attendanceApi.updateLeaveLedger({
        employeeId: ledgerFilters.employeeId,
        leaveType: ledgerFilters.leaveType,
        year,
        openingBalance: Number(ledgerDraftOpeningBalance),
        openingBalanceDate: ledgerDraftOpeningDate,
        monthly: ledgerDraftMonths.map((monthRow) => ({
          month: monthRow.month,
          days: monthRow.days,
          credit: Number(monthRow.credit),
          availed: Number(monthRow.availed),
          availedDates: monthRow.availedDates
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        })),
      });

      setLedger(updated);
      setLedgerEditMode(false);
      setLedgerSaveSuccess('Leave ledger updated successfully.');
    } catch (caught) {
      setLedgerSaveError(caught instanceof Error ? caught.message : 'Failed to update leave ledger');
    } finally {
      setLedgerSaveLoading(false);
    }
  };

  const handleMainSearch = (): void => {
    if (view === 'daily') {
      void loadDaily(dailyDate);
      return;
    }

    if (view === 'monthly') {
      void loadMonthly(monthlyInput);
      return;
    }

    if (view === 'yearly') {
      void loadYearly(yearlyYear);
    }
  };

  const submitRegularization = async (): Promise<void> => {
    if (!regularizeDate) {
      setRegularizeError('Please select attendance date first.');
      return;
    }

    if (selectedRegularizeRow?.regularizeBlockedReason) {
      setRegularizeError(selectedRegularizeRow.regularizeBlockedReason);
      return;
    }

    if (!regularizeReason.trim()) {
      setRegularizeError('Reason is required before submitting regularization.');
      return;
    }

    setRegularizeLoading(true);
    setRegularizeError('');
    setRegularizeSuccess('');

    try {
      await attendanceApi.createRegularization({
        targetDate: regularizeDate,
        reason: `In: ${regularizeInTime}, Out: ${regularizeOutTime}. ${regularizeReason.trim()}`,
        requestType: regularizeType,
      });

      setRegularizeSuccess('Regularization request submitted.');
      setRegularizeReason('');
      await loadMonthly(monthlyInput);
    } catch (caught) {
      setRegularizeError(
        caught instanceof Error ? caught.message : 'Failed to submit regularization request'
      );
    } finally {
      setRegularizeLoading(false);
    }
  };

  useEffect(() => {
    void loadContext();
    const timer = window.setInterval(() => {
      void loadContext();
    }, 30000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!context?.employeeId) {
      return;
    }

    setLedgerFilters((prev) => {
      if (prev.employeeId) {
        return prev;
      }
      return { ...prev, employeeId: context.employeeId };
    });
    setLedgerApplied((prev) => {
      if (prev.employeeId) {
        return prev;
      }
      return { ...prev, employeeId: context.employeeId };
    });
  }, [context?.employeeId]);

  useEffect(() => {
    if (view === 'leave-ledger' && isLedgerManager) {
      void loadLedgerEmployees();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, isLedgerManager]);

  useEffect(() => {
    if (view !== 'leave-ledger' || !ledgerApplied.employeeId) {
      return;
    }

    void loadLeaveLedger(ledgerApplied);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, ledgerApplied.leaveType, ledgerApplied.year, ledgerApplied.employeeId]);

  useEffect(() => {
    if (view !== 'monthly') {
      return;
    }

    const monthQuery = new URLSearchParams(location.search).get('month');
    if (!monthQuery || !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthQuery)) {
      return;
    }

    if (monthQuery !== monthlyInput) {
      setMonthlyInput(monthQuery);
    }
  }, [location.search, monthlyInput, view]);

  useEffect(() => {
    if (view !== 'monthly') {
      return;
    }

    void loadMonthly(monthlyInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyInput, view]);

  useEffect(() => {
    if (view === 'daily') {
      void loadDaily(dailyDate);
      return;
    }

    if (view === 'yearly') {
      void loadYearly(yearlyYear);
      return;
    }

    if (view === 'leave-ledger') {
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    const year = Number(yearlyYear);
    if (!Number.isInteger(year)) {
      return;
    }

    if (yearlySelectedMonth >= 1 && yearlySelectedMonth <= 12) {
      return;
    }

    setYearlySelectedMonth(new Date().getMonth() + 1);
  }, [yearlySelectedMonth, yearlyYear]);

  const monthlyDisplayRows = useMemo<MonthlyDisplayRow[]>(() => {
    const { year, month, daysInMonth } = monthRangeFromInput(monthlyInput);
    const rowMap = new Map(monthlyRows.map((row) => [row.date, row]));
    const rows: MonthlyDisplayRow[] = [];
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const isCurrentMonth = year === currentYear && month === currentMonth;
    const isFutureMonth = year > currentYear || (year === currentYear && month > currentMonth);
    const lastCompletedDay = Math.max(0, today.getDate() - 1);
    const lastDayToShow = isFutureMonth ? 0 : isCurrentMonth ? lastCompletedDay : daysInMonth;

    for (let day = lastDayToShow; day >= 1; day -= 1) {
      const date = new Date(year, month - 1, day);
      const dateKey = toIsoDate(date);
      const sourceRow = rowMap.get(dateKey);
      const computedStatus = sourceRow ? toUiStatusCode(sourceRow.status) : getMissingDayStatus(date);
      const normalizedStatus = computedStatus.trim().toUpperCase();
      const planned = normalizedStatus === 'WO' ? 'WO' : '-';
      const isHolidayOrWeekOff =
        normalizedStatus === 'WO' ||
        normalizedStatus === 'PH' ||
        normalizedStatus === 'OH' ||
        planned === 'WO';
      const regularizeBlockedReason = isHolidayOrWeekOff
        ? 'Attendance regularize not allowed for selected date. Kindly contact HR.'
        : '';
      let weeklyHours = '-';

      if (date.getDay() === 0) {
        const weekStartDay = Math.max(1, day - 6);
        let weeklyMinutes = 0;

        for (let weekDay = weekStartDay; weekDay <= day; weekDay += 1) {
          const weekDate = new Date(year, month - 1, weekDay);
          const weekSource = rowMap.get(toIsoDate(weekDate));
          weeklyMinutes += Math.max(0, weekSource?.workingMinutes ?? 0);
        }

        weeklyHours = formatMinutesAsHours(weeklyMinutes);
      }

      rows.push({
        dateKey,
        dateLabel: formatDisplayDate(dateKey),
        dayNumber: day,
        weekday: dayNames[date.getDay()],
        planned,
        inTime: formatTime(sourceRow?.inTime ?? null),
        outTime: formatTime(sourceRow?.outTime ?? null),
        totalHr: sourceRow?.workingHoursText ?? '--:--',
        status: computedStatus,
        late: extractDurationFromReasons(sourceRow?.validationReasons, /LATE/i),
        early: extractDurationFromReasons(sourceRow?.validationReasons, /EARLY/i),
        canRegularizeSubmit: !regularizeBlockedReason && (Boolean(sourceRow) || isPastWorkingDay(date)),
        regularizeBlockedReason,
        weeklyHours,
      });
    }

    return rows;
  }, [monthlyInput, monthlyRows]);

  useEffect(() => {
    if (view !== 'monthly' || !monthlyDetailDate) {
      return;
    }

    const selectedDateStillVisible = monthlyDisplayRows.some((row) => row.dateKey === monthlyDetailDate);
    if (selectedDateStillVisible) {
      return;
    }

    setMonthlyDetailDate(null);
    setMonthlyDetail(null);
    setMonthlyDetailError('');
  }, [monthlyDetailDate, monthlyDisplayRows, view]);

  const selectedRegularizeRow = useMemo(
    () => monthlyDisplayRows.find((row) => row.dateKey === regularizeDate) ?? null,
    [monthlyDisplayRows, regularizeDate]
  );

  const regularizeWorkingHours = useMemo(
    () => calculateRegularizeWorkingHours(regularizeInTime, regularizeOutTime),
    [regularizeInTime, regularizeOutTime]
  );

  const monthlyWorkSummary = useMemo(() => {
    const totalMinutes = monthlyRows.reduce((sum, row) => sum + Math.max(0, row.workingMinutes), 0);
    const workedDayCount = monthlyRows.filter((row) => row.workingMinutes > 0).length;
    const averageMinutes = workedDayCount > 0 ? Math.round(totalMinutes / workedDayCount) : 0;

    return {
      totalHours: formatMinutesAsHours(totalMinutes),
      averageHours: formatMinutesAsHours(averageMinutes),
    };
  }, [monthlyRows]);

  const yearlyLeaveCodeMap = useMemo(() => {
    const year = Number(yearlyYear);
    if (!Number.isInteger(year)) {
      return new Map<string, string>();
    }

    return buildLeaveDateCodeMap({
      rows: yearlyLeaveRows,
      year,
    });
  }, [yearlyLeaveRows, yearlyYear]);

  const yearlySpecialLeaveSnapshot = useMemo(() => {
    const summary = {
      PTL: 0,
      SPL: 0,
    };

    for (const row of yearlyLeaveRows) {
      const code = String(row.leaveType ?? '').trim().toUpperCase();
      const days = Number(row.noOfDays ?? 0);
      if (!Number.isFinite(days) || days <= 0) {
        continue;
      }

      if (code === 'PTL') {
        summary.PTL += days;
      } else if (code === 'SPL') {
        summary.SPL += days;
      }
    }

    return summary;
  }, [yearlyLeaveRows]);

  const yearlyMatrix = useMemo(() => {
    const year = Number(yearlyYear);
    const rowMap = new Map(yearlyRows.map((row) => [row.date, row]));
    const months = Array.from({ length: 12 }, (_, index) => index + 1);

    return months.map((month) => {
      const daysInMonth = new Date(year, month, 0).getDate();
      const cells: UiStatusCode[] = [];
      let workingDays = 0;

      for (let day = 1; day <= 31; day += 1) {
        if (day > daysInMonth) {
          cells.push('-');
          continue;
        }

        const date = new Date(year, month - 1, day);
        const dateKey = toIsoDate(date);
        const sourceRow = rowMap.get(dateKey);
        const leaveCode = yearlyLeaveCodeMap.get(dateKey);
        const value = leaveCode || (sourceRow ? toUiStatusCode(sourceRow.status) : getMissingDayStatus(date));

        cells.push(value);

        if (date.getDay() !== 0 && date.getDay() !== 6) {
          workingDays += 1;
        }
      }

      return {
        month,
        monthLabel: monthNames[month - 1],
        workingDays,
        cells,
      };
    });
  }, [yearlyLeaveCodeMap, yearlyRows, yearlyYear]);

  const yearlyMonthDetailRows = useMemo<YearlyDetailRow[]>(() => {
    const year = Number(yearlyYear);
    if (!Number.isInteger(year) || yearlySelectedMonth < 1 || yearlySelectedMonth > 12) {
      return [];
    }

    const rowMap = new Map(yearlyRows.map((row) => [row.date, row]));
    const daysInMonth = new Date(year, yearlySelectedMonth, 0).getDate();
    const rows: YearlyDetailRow[] = [];

    for (let day = daysInMonth; day >= 1; day -= 1) {
      const date = new Date(year, yearlySelectedMonth - 1, day);
      const dateKey = toIsoDate(date);
      const sourceRow = rowMap.get(dateKey);
      const leaveCode = yearlyLeaveCodeMap.get(dateKey);
      const baseStatus = sourceRow ? toUiStatusCode(sourceRow.status) : getMissingDayStatus(date);
      const status = (leaveCode || baseStatus).trim().toUpperCase();

      rows.push({
        dateKey,
        dayNumber: day,
        weekday: dayNames[date.getDay()],
        planned: toPlannedCode(status),
        inTime: toTimeOrZero(sourceRow?.inTime),
        outTime: toTimeOrZero(sourceRow?.outTime),
        status,
        totalHr: sourceRow?.workingHoursText ?? '00:00',
        late: extractDurationFromReasons(sourceRow?.validationReasons, /LATE/i),
        early: extractDurationFromReasons(sourceRow?.validationReasons, /EARLY/i),
      });
    }

    return rows;
  }, [yearlyLeaveCodeMap, yearlyRows, yearlySelectedMonth, yearlyYear]);

  const ledgerModalRow = useMemo(
    () => ledger?.months.find((monthRow) => monthRow.month === ledgerModalMonth) ?? null,
    [ledger, ledgerModalMonth]
  );

  const renderMainFilter = (): JSX.Element | null => {
    if (view === 'leave-ledger') {
      return null;
    }

    return (
      <section className="attx-glass attx-filter">
        <div className="attx-filter-grid">
          <label className="attx-field">
            <span>{view === 'daily' ? 'Date' : view === 'monthly' ? 'Month' : 'Year'}</span>
            {view === 'daily' ? (
              <input type="date" value={dailyDate} onChange={(event) => setDailyDate(event.target.value)} />
            ) : null}
            {view === 'monthly' ? (
              <input type="month" value={monthlyInput} onChange={(event) => setMonthlyInput(event.target.value)} />
            ) : null}
            {view === 'yearly' ? (
              <input
                type="number"
                min={2000}
                max={2100}
                value={yearlyYear}
                onChange={(event) => setYearlyYear(event.target.value)}
              />
            ) : null}
          </label>
          <label className="attx-field">
            <span>Employee</span>
            <input value={employeeName} readOnly />
          </label>
          <label className="attx-field">
            <span>Ecode</span>
            <input value={employeeCode} readOnly />
          </label>
          <button type="button" className="attx-search-btn" onClick={handleMainSearch}>
            Search
          </button>
        </div>

        {context?.punchWindow ? (
          <div className="attx-punch-window-board">
            <p className="attx-punch-window-now">
              Local Time ({context.punchWindow.timezone}): {context.punchWindow.currentLocalTime}
            </p>
            <div className="attx-punch-window-grid">
              <article
                className={`attx-punch-window-item ${
                  context.punchWindow.isPunchInAllowedNow ? 'is-open' : 'is-closed'
                }`}
              >
                <strong>Punch In</strong>
                <span>
                  {context.punchWindow.punchInStartTime} - {context.punchWindow.punchInEndTime}
                </span>
                <em>{context.punchWindow.isPunchInAllowedNow ? 'Allowed now' : 'Outside window'}</em>
              </article>
              <article
                className={`attx-punch-window-item ${
                  context.punchWindow.isPunchOutAllowedNow ? 'is-open' : 'is-closed'
                }`}
              >
                <strong>Punch Out</strong>
                <span>
                  {context.punchWindow.punchOutStartTime} - {context.punchWindow.punchOutEndTime}
                </span>
                <em>{context.punchWindow.isPunchOutAllowedNow ? 'Allowed now' : 'Outside window'}</em>
              </article>
            </div>
          </div>
        ) : null}
      </section>
    );
  };

  const renderDaily = (): JSX.Element => (
    <>
      <section className="attx-glass attx-note-card">
        <div className="attx-note-pill">Note</div>
        <ul>
          <li>Daily punches are loaded from attendance API for selected date.</li>
          <li>Geo distance, punch source and validation notes are shown from real records.</li>
        </ul>
      </section>

      {dailyLoading ? <p className="attx-inline-feedback">Loading daily punches...</p> : null}
      {dailyError ? <p className="attx-inline-feedback attx-inline-feedback--error">{dailyError}</p> : null}

      <section className="attx-glass attx-table-shell">
        <div className="attx-table-scroll">
          <table className="attx-table attx-table--daily">
            <thead>
              <tr>
                <th>Date</th>
                <th>Punch Time</th>
                <th>Image Data</th>
                <th>Geo Location</th>
                <th>Latitude Longitude</th>
                <th>Punch Source</th>
                <th>Mac Address</th>
                <th>Company Location</th>
                <th>Distance Travelled</th>
              </tr>
            </thead>
            <tbody>
              {(dailyDetail?.punches ?? []).map((punch) => (
                <tr key={punch.id}>
                  <td>{formatDisplayDate(dailyDate)}</td>
                  <td>{formatTime(punch.time)}</td>
                  <td>{punch.photoUrl ? 'Available' : '-'}</td>
                  <td>
                    <span className="attx-geo-pin">{punch.validationStatus.toUpperCase()}</span>
                  </td>
                  <td>{`${punch.location.latitude.toFixed(6)}, ${punch.location.longitude.toFixed(6)}`}</td>
                  <td>{punch.source}</td>
                  <td>{punch.macAddress || '-'}</td>
                  <td>{punch.companyLocation?.name ?? '-'}</td>
                  <td>{formatDistanceKm(punch.distanceFromOfficeMeters)}</td>
                </tr>
              ))}
              {!dailyLoading && !(dailyDetail?.punches?.length ?? 0) ? (
                <tr>
                  <td colSpan={9}>No punches found for selected date.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );

  const renderMonthly = (): JSX.Element => (
    <>
      <div className="attx-chip-row">
        <span className="attx-chip attx-chip--hint">Month: {monthlyInput}</span>
        <span className="attx-chip attx-chip--hint">Rows: {monthlyDisplayRows.length}</span>
        <span className="attx-chip attx-chip--hint">Monthly Wrk Hrs: {monthlyWorkSummary.totalHours}</span>
        <span className="attx-chip attx-chip--hint">Avg. Monthly Wrk Hrs: {monthlyWorkSummary.averageHours}</span>
        <span className="attx-chip attx-chip--accent">A.R. available by date (holiday/week-off may be blocked)</span>
      </div>

      {monthlyLoading ? <p className="attx-inline-feedback">Loading monthly attendance...</p> : null}
      {monthlyError ? (
        <p className="attx-inline-feedback attx-inline-feedback--error">{monthlyError}</p>
      ) : null}

      <section className="attx-glass attx-table-shell">
        <div className="attx-table-scroll">
          <table className="attx-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Planned</th>
                <th>In</th>
                <th>Out</th>
                <th>Status</th>
                <th>Total Hr.</th>
                <th>L.C</th>
                <th>E.G</th>
                <th>A.R.</th>
                <th>Wkly Hrs</th>
              </tr>
            </thead>
            <tbody>
              {monthlyDisplayRows.map((row) => (
                <tr key={row.dateKey}>
                  <td>
                    <button
                      type="button"
                      className={`attx-date-link ${
                        monthlyDetailDate === row.dateKey ? 'attx-date-link--active' : ''
                      }`}
                      onClick={() => {
                        setMonthlyDetailDate(row.dateKey);
                        void loadMonthlyDetail(row.dateKey);
                      }}
                    >
                      {row.dayNumber}
                    </button>
                  </td>
                  <td>{row.weekday}</td>
                  <td>{row.planned}</td>
                  <td>{row.inTime}</td>
                  <td>{row.outTime}</td>
                  <td>
                    <span className={`attx-status ${getStatusClass(row.status)}`}>{row.status}</span>
                  </td>
                  <td>{row.totalHr}</td>
                  <td>{row.late}</td>
                  <td>{row.early}</td>
                  <td>
                    <button
                      type="button"
                      className="attx-ar-btn"
                      onClick={() => {
                        const inferredType =
                          row.status.trim().toUpperCase() === 'I'
                            ? 'invalid_punch'
                            : row.status.trim().toUpperCase() === 'A'
                              ? 'missed_punch'
                              : 'manual_correction';
                        const blockedFallback = row.regularizeBlockedReason ? '00:00' : '';
                        setRegularizeDate(row.dateKey);
                        setRegularizeType(inferredType);
                        setRegularizeInTime(
                          row.inTime !== '--:--'
                            ? row.inTime
                            : blockedFallback || context?.punchWindow?.punchInStartTime || '09:30'
                        );
                        setRegularizeOutTime(
                          row.outTime !== '--:--'
                            ? row.outTime
                            : blockedFallback || context?.punchWindow?.punchOutStartTime || '18:00'
                        );
                        setRegularizeReason('');
                        setRegularizeError(row.regularizeBlockedReason || '');
                        setRegularizeSuccess('');
                      }}
                    >
                      A.R.
                    </button>
                  </td>
                  <td>{row.weeklyHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {monthlyDetailDate ? (
        <section className="attx-glass attx-table-shell">
          <h3 className="attx-monthly-detail-title">Punch Details - {formatDisplayDate(monthlyDetailDate)}</h3>
          {monthlyDetailLoading ? <p className="attx-inline-feedback">Loading day punches...</p> : null}
          {monthlyDetailError ? (
            <p className="attx-inline-feedback attx-inline-feedback--error">{monthlyDetailError}</p>
          ) : null}
          <div className="attx-table-scroll">
            <table className="attx-table attx-table--daily">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Punch Time</th>
                  <th>Image Data</th>
                  <th>Geo Location</th>
                  <th>Latitude Longitude</th>
                  <th>Punch Source</th>
                  <th>Mac Address</th>
                  <th>Company Location</th>
                  <th>Distance Travelled</th>
                </tr>
              </thead>
              <tbody>
                {(monthlyDetail?.punches ?? []).map((punch) => (
                  <tr key={punch.id}>
                    <td>{formatDisplayDate(monthlyDetailDate)}</td>
                    <td>{formatTime(punch.time)}</td>
                    <td>{punch.photoUrl ? 'Available' : '-'}</td>
                    <td>
                      <span className="attx-geo-pin">{punch.validationStatus.toUpperCase()}</span>
                    </td>
                    <td>{`${punch.location.latitude.toFixed(6)}, ${punch.location.longitude.toFixed(6)}`}</td>
                    <td>{punch.source}</td>
                    <td>{punch.macAddress || '-'}</td>
                    <td>{punch.companyLocation?.name ?? '-'}</td>
                    <td>{formatDistanceKm(punch.distanceFromOfficeMeters)}</td>
                  </tr>
                ))}
                {!monthlyDetailLoading && !(monthlyDetail?.punches?.length ?? 0) ? (
                  <tr>
                    <td colSpan={9}>No punches found for selected date.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {selectedRegularizeRow ? (
        <section className="attx-glass attx-regularise">
          <div className="attx-regularise-head">
            <h3>Regularisation</h3>
          </div>

          <div className="attx-regularise-meta">
            <p>
              <span>Reporting Mgr.(Ecode):</span> NA
            </p>
            <p>
              <span>Work Location:</span> NA
            </p>
            <p>
              <span>Attendance Date:</span> {selectedRegularizeRow.dateLabel}
            </p>
            <p>
              <span>Planned Shift:</span> {selectedRegularizeRow.planned === '-' ? '00' : selectedRegularizeRow.planned}
            </p>
            <p>
              <span>Shift In Time:</span> {context?.punchWindow?.punchInStartTime ?? '09:30'}
            </p>
            <p>
              <span>Shift Out Time:</span> {context?.punchWindow?.punchOutStartTime ?? '18:00'}
            </p>
          </div>

          <div className="attx-regularise-divider" />

          <div className="attx-regularise-meta">
            <p>
              <span>In Time:</span> {selectedRegularizeRow.inTime}
            </p>
            <p>
              <span>Out Time:</span> {selectedRegularizeRow.outTime}
            </p>
            <p>
              <span>Att. Marked as:</span> {formatRegularizeMarkedAs(selectedRegularizeRow.status)}
            </p>
            <p />
          </div>

          <div className="attx-regularise-divider" />

          <h4 className="attx-regularise-subtitle">Regularisation</h4>

          <div className="attx-regularise-form attx-regularise-form--legacy">
            <label className="attx-field">
              <span>Regularise Type</span>
              <div className="attx-regularise-type-row">
                <select
                  value={regularizeType}
                  onChange={(event) =>
                    setRegularizeType(event.target.value as 'manual_correction' | 'missed_punch' | 'invalid_punch')
                  }
                  disabled={Boolean(selectedRegularizeRow.regularizeBlockedReason)}
                >
                  <option value="manual_correction">Manual Correction</option>
                  <option value="missed_punch">Missed Punch</option>
                  <option value="invalid_punch">Invalid Punch</option>
                </select>
                <span className="attx-regularise-help" title="Select request type">
                  ?
                </span>
              </div>
            </label>
            <div />

            <label className="attx-field">
              <span>In Date</span>
              <input value={selectedRegularizeRow.dateLabel} readOnly />
            </label>
            <label className="attx-field">
              <span>Exit Date</span>
              <input value={selectedRegularizeRow.dateLabel} readOnly />
            </label>

            <label className="attx-field">
              <span>In Time</span>
              <input
                type="time"
                value={regularizeInTime}
                onChange={(event) => setRegularizeInTime(event.target.value)}
                disabled={Boolean(selectedRegularizeRow.regularizeBlockedReason)}
              />
            </label>
            <label className="attx-field">
              <span>Out Time</span>
              <input
                type="time"
                value={regularizeOutTime}
                onChange={(event) => setRegularizeOutTime(event.target.value)}
                disabled={Boolean(selectedRegularizeRow.regularizeBlockedReason)}
              />
            </label>

            <label className="attx-field">
              <span>Working Hrs</span>
              <input value={regularizeWorkingHours} readOnly />
            </label>
            <div />

            <label className="attx-field attx-field--full">
              <span>Remarks</span>
              <textarea
                rows={3}
                value={regularizeReason}
                onChange={(event) => setRegularizeReason(event.target.value)}
                placeholder="Add reason for regularization request"
                disabled={Boolean(selectedRegularizeRow.regularizeBlockedReason)}
              />
            </label>
          </div>

          {regularizeError ? <p className="attx-note attx-note--error">{regularizeError}</p> : null}
          {regularizeSuccess ? <p className="attx-note">{regularizeSuccess}</p> : null}

          <div className="attx-action-row">
            {selectedRegularizeRow.canRegularizeSubmit ? (
              <button
                type="button"
                className="attx-btn attx-btn--primary"
                disabled={regularizeLoading}
                onClick={() => void submitRegularization()}
              >
                {regularizeLoading ? 'Submitting...' : 'Submit Request'}
              </button>
            ) : null}
            <button
              type="button"
              className={`attx-btn ${selectedRegularizeRow.canRegularizeSubmit ? 'attx-btn--ghost' : 'attx-btn--primary'}`}
              onClick={() => setRegularizeDate(null)}
            >
              Close
            </button>
          </div>
        </section>
      ) : null}
    </>
  );

  const renderYearly = (): JSX.Element => (
    <>
      {yearlyLoading ? <p className="attx-inline-feedback">Loading yearly attendance...</p> : null}
      {yearlyError ? <p className="attx-inline-feedback attx-inline-feedback--error">{yearlyError}</p> : null}

      <section className="attx-glass attx-balance">
        <h3>Leave Snapshot</h3>
        <div className="attx-balance-row">
          <div className="attx-balance-pill">
            <strong>CL</strong>
            <span>{yearlyBalances.CL.toFixed(2)}</span>
          </div>
          <div className="attx-balance-pill">
            <strong>PL</strong>
            <span>{yearlyBalances.PL.toFixed(2)}</span>
          </div>
          <div className="attx-balance-pill">
            <strong>SL</strong>
            <span>{yearlyBalances.SL.toFixed(2)}</span>
          </div>
          <div className="attx-balance-pill">
            <strong>OH</strong>
            <span>{yearlyBalances.OH.toFixed(2)}</span>
          </div>
          <div className="attx-balance-pill">
            <strong>PTL</strong>
            <span>{yearlySpecialLeaveSnapshot.PTL.toFixed(2)}</span>
          </div>
          <div className="attx-balance-pill">
            <strong>SPL</strong>
            <span>{yearlySpecialLeaveSnapshot.SPL.toFixed(2)}</span>
          </div>
        </div>
        <p className="attx-note">PTL/SPL values are derived from approved leave requests in the selected year.</p>
      </section>

      <section className="attx-glass attx-table-shell">
        <div className="attx-table-scroll">
          <table className="attx-table attx-table--yearly">
            <thead>
              <tr>
                <th>Month</th>
                <th>TWDs</th>
                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                  <th key={day}>{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yearlyMatrix.map((monthRow) => (
                <tr key={monthRow.month}>
                  <td>
                    <button
                      type="button"
                      className={`attx-month-link ${
                        yearlySelectedMonth === monthRow.month ? 'attx-month-link--active' : ''
                      }`}
                      onClick={() => setYearlySelectedMonth(monthRow.month)}
                    >
                      {monthRow.monthLabel}
                    </button>
                  </td>
                  <td>{monthRow.workingDays}</td>
                  {monthRow.cells.map((statusCode, index) => (
                    <td key={`${monthRow.month}-${index}`} className={getStatusClass(statusCode)}>
                      {statusCode}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="attx-note">
        Note: Yearly matrix is built from attendance API day records plus approved leave requests.
      </p>
      <p className="attx-note">Prefix H means Half Day.</p>

      <section className="attx-glass attx-table-shell attx-yearly-detail-shell">
        <div className="attx-yearly-detail-head">
          <h3>
            {monthNames[Math.max(0, Math.min(11, yearlySelectedMonth - 1))]}-{yearlyYear} Details
          </h3>
          <button
            type="button"
            className="attx-btn attx-btn--secondary"
            onClick={() => navigate(`/attendance/monthly?month=${yearlyYear}-${pad(yearlySelectedMonth)}`)}
          >
            Open Monthly Module
          </button>
        </div>
        <div className="attx-table-scroll">
          <table className="attx-table attx-table--yearly-detail">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Planned</th>
                <th>In</th>
                <th>Out</th>
                <th>Status</th>
                <th>Total Hr.</th>
                <th>L.C</th>
                <th>E.G</th>
              </tr>
            </thead>
            <tbody>
              {yearlyMonthDetailRows.map((row) => (
                <tr key={row.dateKey}>
                  <td>{row.dayNumber}</td>
                  <td>{row.weekday}</td>
                  <td>{row.planned}</td>
                  <td>{row.inTime}</td>
                  <td>{row.outTime}</td>
                  <td>
                    <span className={`attx-status ${getStatusClass(row.status)}`}>{row.status}</span>
                  </td>
                  <td>{row.totalHr}</td>
                  <td>{row.late}</td>
                  <td>{row.early}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="attx-legend-grid">
        <div className="attx-glass attx-table-shell">
          <table className="attx-table attx-table--legend">
            <thead>
              <tr>
                <th>Status</th>
                <th>Abbr.</th>
              </tr>
            </thead>
            <tbody>
              {yearlyStatusLegend.map(([status, abbr]) => (
                <tr key={abbr}>
                  <td>{status}</td>
                  <td>{abbr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="attx-glass attx-table-shell">
          <table className="attx-table attx-table--legend">
            <thead>
              <tr>
                <th>Status</th>
                <th>Abbr.</th>
              </tr>
            </thead>
            <tbody>
              {yearlyHalfDayLegend.map(([status, abbr]) => (
                <tr key={abbr}>
                  <td>{status}</td>
                  <td>{abbr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );

  const renderLeaveLedger = (): JSX.Element => (
    <section className="attx-ledger-shell">
      <section className="attx-ledger-filter">
        <div className="attx-ledger-filter-grid">
          <label className="attx-ledger-field">
            <span>Employee:</span>
            <select
              value={ledgerFilters.employeeId}
              disabled={!isLedgerManager || ledgerEmployeesLoading}
              onChange={(event) =>
                setLedgerFilters((prev) => ({
                  ...prev,
                  employeeId: event.target.value,
                }))
              }
            >
              {!isLedgerManager ? (
                <option value={ledgerFilters.employeeId || context?.employeeId || ''}>
                  {`${employeeName} (${employeeCode})`}
                </option>
              ) : null}
              {isLedgerManager
                ? ledgerEmployees.map((employee) => (
                    <option key={employee.employeeId} value={employee.employeeId}>
                      {`${employee.employeeName} (${employee.employeeCode})`}
                    </option>
                  ))
                : null}
            </select>
          </label>

          <label className="attx-ledger-field">
            <span>Leave Type:</span>
            <select
              value={ledgerFilters.leaveType}
              onChange={(event) =>
                setLedgerFilters((prev) => ({
                  ...prev,
                  leaveType: event.target.value as LeaveTypeCode,
                }))
              }
            >
              {(['PL', 'CL', 'SL', 'OH'] as LeaveTypeCode[]).map((typeCode) => (
                <option key={typeCode} value={typeCode}>
                  {leaveLabelByCode[typeCode]}
                </option>
              ))}
            </select>
          </label>

          <label className="attx-ledger-field attx-ledger-field--year">
            <span>Year:</span>
            <select
              value={ledgerFilters.year}
              onChange={(event) =>
                setLedgerFilters((prev) => ({
                  ...prev,
                  year: event.target.value,
                }))
              }
            >
              <option value={String(now.getFullYear())}>{now.getFullYear()}</option>
              <option value={String(now.getFullYear() - 1)}>{now.getFullYear() - 1}</option>
            </select>
          </label>

          <button
            type="button"
            className="attx-ledger-search"
            onClick={() => {
              if (!ledgerFilters.employeeId) {
                setLedgerError('Please select an employee');
                return;
              }
              setLedgerApplied(ledgerFilters);
              void loadLeaveLedger(ledgerFilters);
            }}
          >
            Go
          </button>
        </div>
      </section>

      {ledgerLoading ? <p className="attx-inline-feedback">Loading leave ledger...</p> : null}
      {ledgerError ? <p className="attx-inline-feedback attx-inline-feedback--error">{ledgerError}</p> : null}
      {ledgerSaveError ? (
        <p className="attx-inline-feedback attx-inline-feedback--error">{ledgerSaveError}</p>
      ) : null}
      {ledgerSaveSuccess ? <p className="attx-inline-feedback">{ledgerSaveSuccess}</p> : null}

      {ledger ? (
        <>
          <section className="attx-ledger-summary">
            <div className="attx-ledger-summary-head">
              <span>Employee (Ecode)</span>
              <span>Leave Type</span>
              <span>Op. bal. date</span>
              <span>Op. bal.</span>
            </div>
            <div className="attx-ledger-summary-row">
              <strong>{`${ledger.employee.employeeName} (${ledger.employee.employeeCode})`}</strong>
              <strong>{ledger.leaveType}</strong>
              {ledgerEditMode ? (
                <input
                  className="attx-ledger-input"
                  type="date"
                  value={ledgerDraftOpeningDate}
                  onChange={(event) => setLedgerDraftOpeningDate(event.target.value)}
                />
              ) : (
                <strong>{ledger.openingBalanceDate}</strong>
              )}
              {ledgerEditMode ? (
                <input
                  className="attx-ledger-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={ledgerDraftOpeningBalance}
                  onChange={(event) => setLedgerDraftOpeningBalance(event.target.value)}
                />
              ) : (
                <strong>{ledger.openingBalance.toFixed(2)}</strong>
              )}
            </div>
            {isLedgerManager ? (
              <div className="attx-ledger-actions">
                {!ledgerEditMode ? (
                  <button type="button" className="attx-ledger-edit-btn" onClick={beginLedgerEdit}>
                    Edit Ledger
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="attx-ledger-edit-btn"
                      disabled={ledgerSaveLoading}
                      onClick={() => void saveLedgerEdits()}
                    >
                      {ledgerSaveLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="attx-ledger-edit-btn attx-ledger-edit-btn--ghost"
                      onClick={() => setLedgerEditMode(false)}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </section>

          <section className="attx-ledger-table-wrap">
            <table className="attx-ledger-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Days</th>
                  <th>Credit</th>
                  <th>Availed</th>
                  <th>View</th>
                </tr>
              </thead>
              <tbody>
                {(ledgerEditMode ? ledgerDraftMonths : ledger.months).map((row) => (
                  <tr key={row.month}>
                    <td>{'monthLabel' in row ? row.monthLabel : `${monthNames[row.month - 1]} - ${ledger.year}`}</td>
                    <td>{row.days}</td>
                    <td>
                      {ledgerEditMode ? (
                        <input
                          className="attx-ledger-input"
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.credit}
                          onChange={(event) =>
                            setLedgerDraftMonths((prev) =>
                              prev.map((monthRow) =>
                                monthRow.month === row.month
                                  ? { ...monthRow, credit: event.target.value }
                                  : monthRow
                              )
                            )
                          }
                        />
                      ) : (
                        Number(row.credit).toFixed(2)
                      )}
                    </td>
                    <td>
                      {ledgerEditMode ? (
                        <input
                          className="attx-ledger-input"
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.availed}
                          onChange={(event) =>
                            setLedgerDraftMonths((prev) =>
                              prev.map((monthRow) =>
                                monthRow.month === row.month
                                  ? { ...monthRow, availed: event.target.value }
                                  : monthRow
                              )
                            )
                          }
                        />
                      ) : (
                        Number(row.availed).toFixed(2)
                      )}
                    </td>
                    <td>
                      {ledgerEditMode ? (
                        <input
                          className="attx-ledger-input"
                          type="text"
                          value={row.availedDates}
                          placeholder="dd-MMM-yyyy, dd-MMM-yyyy"
                          onChange={(event) =>
                            setLedgerDraftMonths((prev) =>
                              prev.map((monthRow) =>
                                monthRow.month === row.month
                                  ? { ...monthRow, availedDates: event.target.value }
                                  : monthRow
                              )
                            )
                          }
                        />
                      ) : row.availedDates.length ? (
                        <button
                          type="button"
                          className="attx-ledger-view-btn"
                          onClick={() => setLedgerModalMonth(row.month)}
                        >
                          View
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                <tr className="attx-ledger-total">
                  <td>Total</td>
                  <td />
                  <td>
                    {(ledgerEditMode
                      ? ledgerDraftMonths.reduce((sum, item) => sum + Number(item.credit || 0), 0)
                      : ledger.totals.credit
                    ).toFixed(2)}
                  </td>
                  <td>
                    {(ledgerEditMode
                      ? ledgerDraftMonths.reduce((sum, item) => sum + Number(item.availed || 0), 0)
                      : ledger.totals.availed
                    ).toFixed(2)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </section>

          <section className="attx-ledger-balance">
            <div>
              <strong>Ledger Balance</strong>
              <span>{ledger.balances.ledgerBalance.toFixed(2)}</span>
            </div>
            <div>
              <strong>Current Balance</strong>
              <span>{ledger.balances.currentBalance.toFixed(2)}</span>
            </div>
            <div className="attx-ledger-balance--discrepancy">
              <strong>Discrepancy</strong>
              <span>{ledger.balances.discrepancy.toFixed(2)}</span>
            </div>
          </section>

          <section className="attx-ledger-note">
            <p>Note:</p>
            <p>1) Transaction post opening balance date are considered for ledger balance computation</p>
            <p>2) Leave balances and monthly details are loaded from attendance leave-ledger API</p>
          </section>
        </>
      ) : null}

      {ledgerModalRow ? (
        <div
          className="attx-ledger-modal-layer"
          role="presentation"
          onClick={() => setLedgerModalMonth(null)}
        >
          <div
            className="attx-ledger-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Leave availed details"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="attx-ledger-modal-close-x"
              onClick={() => setLedgerModalMonth(null)}
              aria-label="Close leave availed details"
            >
              x
            </button>
            <div className="attx-ledger-modal-title">Leave Availed:</div>
            <table className="attx-ledger-modal-table">
              <thead>
                <tr>
                  <th>Sr.</th>
                  <th>Leave Type</th>
                  <th>Availed Date</th>
                </tr>
              </thead>
              <tbody>
                {ledgerModalRow.availedDates.map((date, index) => (
                  <tr key={date}>
                    <td>{index + 1}</td>
                    <td>{ledger?.leaveType}</td>
                    <td>{date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="attx-ledger-modal-actions">
              <button
                type="button"
                className="attx-ledger-modal-close"
                onClick={() => setLedgerModalMonth(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );

  return (
    <div className="attx-shell">
      <div className="attx-sheen" aria-hidden="true" />
      <header className={`attx-head ${view === 'leave-ledger' ? 'attx-head--ledger' : ''}`}>
        <h1>My Attendance</h1>
        <span className="attx-head-sep">{'>'}</span>
        <span>{titleByView[view]}</span>
      </header>

      {contextError && !(view === 'leave-ledger' && isLedgerManager) ? (
        <p className="attx-inline-feedback attx-inline-feedback--error">{contextError}</p>
      ) : null}

      {view !== 'leave-ledger' ? (
        <div className="attx-tab-row">
          <button
            type="button"
            className={`attx-tab ${view === 'daily' ? 'attx-tab--active' : ''}`}
            onClick={() => navigate('/attendance/daily')}
          >
            Daily
          </button>
          <button
            type="button"
            className={`attx-tab ${view === 'monthly' ? 'attx-tab--active' : ''}`}
            onClick={() => navigate('/attendance/monthly')}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`attx-tab ${view === 'yearly' ? 'attx-tab--active' : ''}`}
            onClick={() => navigate('/attendance/yearly')}
          >
            Yearly
          </button>
        </div>
      ) : null}

      {renderMainFilter()}

      {view === 'daily' ? renderDaily() : null}
      {view === 'monthly' ? renderMonthly() : null}
      {view === 'yearly' ? renderYearly() : null}
      {view === 'leave-ledger' ? renderLeaveLedger() : null}
    </div>
  );
};

export const AttendanceDailyPage = (): JSX.Element => <MyAttendancePage view="daily" />;
export const AttendanceMonthlyPage = (): JSX.Element => <MyAttendancePage view="monthly" />;
export const AttendanceYearlyPage = (): JSX.Element => <MyAttendancePage view="yearly" />;
export const AttendanceLeaveLedgerPage = (): JSX.Element => <MyAttendancePage view="leave-ledger" />;
