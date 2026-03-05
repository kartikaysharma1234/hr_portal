import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { attendanceApi } from '../api/attendanceApi';
import { useAuth } from '../context/AuthContext';
import type {
  AttendanceDailyDetail,
  AttendanceHistoryRow,
  AttendanceLeaveLedger,
  AttendanceProfileContext,
  AttendanceValidationReason,
  LeaveTypeCode,
} from '../types/attendance';
import '../styles/attendance_glossy.css';

type AttendanceView = 'daily' | 'monthly' | 'yearly' | 'leave-ledger';
type UiStatusCode = 'P' | 'A' | 'WO' | 'W' | 'I' | 'PA' | '-';

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
  canRegularize: boolean;
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const leaveLabelByCode: Record<LeaveTypeCode, string> = {
  PL: 'Privilege Leave',
  CL: 'Casual Leave',
  SL: 'Sick Leave',
  OH: 'Optional Holiday',
};

const statusClass: Record<UiStatusCode, string> = {
  P: 'attx-status--p',
  A: 'attx-status--a',
  WO: 'attx-status--wo',
  W: 'attx-status--w',
  I: 'attx-status--i',
  PA: 'attx-status--pa',
  '-': '',
};

const leaveLegend = [
  ['Present', 'P'],
  ['Absent', 'A'],
  ['Week Off', 'WO'],
  ['Warning', 'W'],
  ['Invalid', 'I'],
  ['Pending Approval', 'PA'],
];

const regularizationLegend = [
  ['Regularization Request', 'A.R.'],
  ['Late Coming', 'L.C'],
  ['Early Going', 'E.G'],
  ['Working Hours', 'WHrs'],
  ['Distance From Office', 'Meters'],
];

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

const getMissingDayStatus = (date: Date): UiStatusCode => {
  const today = new Date();
  const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (target > normalizedToday) {
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
  const { user } = useAuth();

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

  const [regularizeDate, setRegularizeDate] = useState<string | null>(null);
  const [regularizeInTime, setRegularizeInTime] = useState('09:30');
  const [regularizeOutTime, setRegularizeOutTime] = useState('18:00');
  const [regularizeReason, setRegularizeReason] = useState('');
  const [regularizeLoading, setRegularizeLoading] = useState(false);
  const [regularizeError, setRegularizeError] = useState('');
  const [regularizeSuccess, setRegularizeSuccess] = useState('');

  const [yearlyYear, setYearlyYear] = useState(String(now.getFullYear()));
  const [yearlyRows, setYearlyRows] = useState<AttendanceHistoryRow[]>([]);
  const [yearlyLoading, setYearlyLoading] = useState(false);
  const [yearlyError, setYearlyError] = useState('');
  const [yearlyBalances, setYearlyBalances] = useState<Record<LeaveTypeCode, number>>({
    CL: 0,
    PL: 0,
    SL: 0,
    OH: 0,
  });

  const [ledgerFilters, setLedgerFilters] = useState<{ leaveType: LeaveTypeCode; year: string }>({
    leaveType: 'PL',
    year: String(now.getFullYear()),
  });
  const [ledgerApplied, setLedgerApplied] = useState<{ leaveType: LeaveTypeCode; year: string }>({
    leaveType: 'PL',
    year: String(now.getFullYear()),
  });
  const [ledger, setLedger] = useState<AttendanceLeaveLedger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');
  const [ledgerModalMonth, setLedgerModalMonth] = useState<number | null>(null);

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

  const loadYearly = async (yearValue: string): Promise<void> => {
    const year = Number(yearValue);
    if (!Number.isInteger(year)) {
      setYearlyError('Year must be valid');
      return;
    }

    setYearlyLoading(true);
    setYearlyError('');

    try {
      const result = await attendanceApi.getMyAttendance({
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
        page: 1,
        limit: 500,
        view: 'daily',
      });
      setYearlyRows(result.rows ?? []);

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
      setYearlyError(caught instanceof Error ? caught.message : 'Failed to load yearly attendance');
    } finally {
      setYearlyLoading(false);
    }
  };

  const loadLeaveLedger = async (filters: { leaveType: LeaveTypeCode; year: string }): Promise<void> => {
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
      });
      setLedger(response);
    } catch (caught) {
      setLedger(null);
      setLedgerError(caught instanceof Error ? caught.message : 'Failed to load leave ledger');
    } finally {
      setLedgerLoading(false);
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
    if (!regularizeDate || !regularizeReason.trim()) {
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
        requestType: 'manual_correction',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
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
      return;
    }

    if (view === 'leave-ledger') {
      void loadLeaveLedger(ledgerApplied);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const monthlyDisplayRows = useMemo<MonthlyDisplayRow[]>(() => {
    const { year, month, daysInMonth } = monthRangeFromInput(monthlyInput);
    const rowMap = new Map(monthlyRows.map((row) => [row.date, row]));
    const rows: MonthlyDisplayRow[] = [];

    for (let day = daysInMonth; day >= 1; day -= 1) {
      const date = new Date(year, month - 1, day);
      const dateKey = toIsoDate(date);
      const sourceRow = rowMap.get(dateKey);
      const computedStatus = sourceRow ? toUiStatusCode(sourceRow.status) : getMissingDayStatus(date);

      rows.push({
        dateKey,
        dateLabel: formatDisplayDate(dateKey),
        dayNumber: day,
        weekday: dayNames[date.getDay()],
        planned: computedStatus === 'WO' ? 'WO' : '-',
        inTime: formatTime(sourceRow?.inTime ?? null),
        outTime: formatTime(sourceRow?.outTime ?? null),
        totalHr: sourceRow?.workingHoursText ?? '--:--',
        status: computedStatus,
        late: extractDurationFromReasons(sourceRow?.validationReasons, /LATE/i),
        early: extractDurationFromReasons(sourceRow?.validationReasons, /EARLY/i),
        canRegularize: Boolean(sourceRow) && computedStatus !== 'P',
      });
    }

    return rows;
  }, [monthlyInput, monthlyRows]);

  const selectedRegularizeRow = useMemo(
    () => monthlyDisplayRows.find((row) => row.dateKey === regularizeDate) ?? null,
    [monthlyDisplayRows, regularizeDate]
  );

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
        const value = sourceRow ? toUiStatusCode(sourceRow.status) : getMissingDayStatus(date);

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
  }, [yearlyRows, yearlyYear]);

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
        <span className="attx-chip attx-chip--accent">A.R. enabled on non-present days</span>
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
              </tr>
            </thead>
            <tbody>
              {monthlyDisplayRows.map((row) => (
                <tr key={row.dateKey}>
                  <td>{row.dayNumber}</td>
                  <td>{row.weekday}</td>
                  <td>{row.planned}</td>
                  <td>{row.inTime}</td>
                  <td>{row.outTime}</td>
                  <td>
                    <span className={`attx-status ${statusClass[row.status]}`}>{row.status}</span>
                  </td>
                  <td>{row.totalHr}</td>
                  <td>{row.late}</td>
                  <td>{row.early}</td>
                  <td>
                    {row.canRegularize ? (
                      <button
                        type="button"
                        className="attx-ar-btn"
                        onClick={() => {
                          setRegularizeDate(row.dateKey);
                          setRegularizeInTime(row.inTime !== '--:--' ? row.inTime : '09:30');
                          setRegularizeOutTime(row.outTime !== '--:--' ? row.outTime : '18:00');
                          setRegularizeReason('');
                          setRegularizeError('');
                          setRegularizeSuccess('');
                        }}
                      >
                        A.R.
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedRegularizeRow ? (
        <section className="attx-glass attx-regularise">
          <div className="attx-regularise-head">
            <h3>A.R. - Attendance Regularize</h3>
            <button type="button" className="attx-btn attx-btn--ghost" onClick={() => setRegularizeDate(null)}>
              Close
            </button>
          </div>

          <div className="attx-info-grid">
            <p><span>Employee</span> {employeeName}</p>
            <p><span>Ecode</span> {employeeCode}</p>
            <p><span>Attendance Date</span> {selectedRegularizeRow.dateLabel}</p>
            <p><span>Marked As</span> {selectedRegularizeRow.status}</p>
          </div>

          <div className="attx-regularise-form">
            <label className="attx-field">
              <span>In Time</span>
              <input value={regularizeInTime} onChange={(event) => setRegularizeInTime(event.target.value)} />
            </label>
            <label className="attx-field">
              <span>Out Time</span>
              <input value={regularizeOutTime} onChange={(event) => setRegularizeOutTime(event.target.value)} />
            </label>
            <label className="attx-field attx-field--full">
              <span>Remarks</span>
              <textarea
                rows={3}
                value={regularizeReason}
                onChange={(event) => setRegularizeReason(event.target.value)}
                placeholder="Add reason for regularization request"
              />
            </label>
          </div>

          {regularizeError ? <p className="attx-note attx-note--error">{regularizeError}</p> : null}
          {regularizeSuccess ? <p className="attx-note">{regularizeSuccess}</p> : null}

          <div className="attx-action-row">
            <button
              type="button"
              className="attx-btn attx-btn--primary"
              disabled={regularizeLoading}
              onClick={() => void submitRegularization()}
            >
              {regularizeLoading ? 'Submitting...' : 'Submit Request'}
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
        <h3>Leave Balance</h3>
        <div className="attx-balance-row">
          {(['CL', 'PL', 'SL', 'OH'] as LeaveTypeCode[]).map((typeCode) => (
            <div key={typeCode} className="attx-balance-pill">
              <strong>{typeCode}</strong>
              <span>{yearlyBalances[typeCode].toFixed(2)}</span>
            </div>
          ))}
        </div>
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
                  <td>{monthRow.monthLabel}</td>
                  <td>{monthRow.workingDays}</td>
                  {monthRow.cells.map((statusCode, index) => (
                    <td key={`${monthRow.month}-${index}`} className={statusClass[statusCode]}>
                      {statusCode}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="attx-note">Note: Yearly matrix is built from attendance API day records.</p>

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
              {leaveLegend.map(([status, abbr]) => (
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
                <th>Key</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              {regularizationLegend.map(([key, value]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{value}</td>
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
            <select value={employeeCode} disabled>
              <option value={employeeCode}>{`${employeeName} (${employeeCode})`}</option>
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
              <strong>{ledger.openingBalanceDate}</strong>
              <strong>{ledger.openingBalance.toFixed(2)}</strong>
            </div>
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
                {ledger.months.map((row) => (
                  <tr key={row.month}>
                    <td>{row.monthLabel}</td>
                    <td>{row.days}</td>
                    <td>{row.credit.toFixed(2)}</td>
                    <td>{row.availed.toFixed(2)}</td>
                    <td>
                      {row.availedDates.length ? (
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
                  <td>{ledger.totals.credit.toFixed(2)}</td>
                  <td>{ledger.totals.availed.toFixed(2)}</td>
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

      {contextError ? <p className="attx-inline-feedback attx-inline-feedback--error">{contextError}</p> : null}

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
