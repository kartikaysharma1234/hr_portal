import { useEffect, useMemo, useState } from 'react';

import { attendanceApi } from '../api/attendanceApi';
import type { AttendanceHistoryRow } from '../types/attendance';
import { getApiErrorMessage } from '../utils/apiError';
import '../styles/request_regularise.css';

type RegulariseTab =
  | 'pending_submit'
  | 'submitted'
  | 'approved'
  | 'rejected_cancelled'
  | 'finalized';

interface RegularizationAuditEntry {
  action: string;
  at?: string;
  comment?: string;
}

interface RegularizationRequest {
  _id: string;
  targetDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestType: 'missed_punch' | 'invalid_punch' | 'manual_correction';
  reason: string;
  finalDecisionComment?: string;
  createdAt?: string;
  updatedAt?: string;
  auditTrail?: RegularizationAuditEntry[];
}

interface RegulariseRow {
  dateIso: string;
  dateLabel: string;
  dayLabel: string;
  inTime: string;
  outTime: string;
  attStatus: string;
  request: RegularizationRequest | null;
}

const tabTitles: Record<RegulariseTab, string> = {
  pending_submit: 'Pending to submit',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected_cancelled: 'Rejected/Cancelled',
  finalized: 'Finalized'
};

const statusClassByTab: Record<RegulariseTab, string> = {
  pending_submit: 'req-tab req-tab--pending',
  submitted: 'req-tab req-tab--submitted',
  approved: 'req-tab req-tab--approved',
  rejected_cancelled: 'req-tab req-tab--rejected',
  finalized: 'req-tab req-tab--finalized'
};

const monthNameShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayNameShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const parseIsoLocalDate = (isoDate: string): Date | null => {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
};

const toIsoDate = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const toDefaultMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const formatDate = (isoDate: string): string => {
  const parsed = parseIsoLocalDate(isoDate);
  if (!parsed) {
    return isoDate;
  }

  const year = parsed.getFullYear();
  const month = parsed.getMonth() + 1;
  const day = parsed.getDate();

  return `${String(day).padStart(2, '0')}-${monthNameShort[month - 1]}-${String(year).slice(-2)}`;
};

const formatTime = (value: string | null): string => {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return parsed.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const mapAttendanceStatus = (rawStatus: string): string => {
  const status = rawStatus.toLowerCase();
  if (status === 'present') return 'Present';
  if (status === 'absent') return 'Absent';
  if (status === 'warning') return 'Warning';
  if (status === 'invalid') return 'Invalid';
  if (status === 'pending_approval') return 'Pending Approval';
  if (status === 'half_day') return 'Half Day';
  if (status === 'weekend') return 'Weekly Off';
  if (status === 'holiday') return 'Public Holiday';
  return 'Absent';
};

const getMonthRange = (monthInput: string): { startDate: string; endDate: string; dates: string[] } => {
  const [yearRaw, monthRaw] = monthInput.split('-').map(Number);
  const year = Number.isInteger(yearRaw) ? yearRaw : new Date().getFullYear();
  const month = Number.isInteger(monthRaw) ? monthRaw : new Date().getMonth() + 1;

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const dates: string[] = [];

  for (let day = 1; day <= end.getDate(); day += 1) {
    dates.push(toIsoDate(new Date(year, month - 1, day)));
  }

  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    dates
  };
};

const sortRequestsByLatest = (requests: RegularizationRequest[]): RegularizationRequest[] => {
  return [...requests].sort((a, b) => {
    const aTs = new Date(a.updatedAt ?? a.createdAt ?? '').getTime();
    const bTs = new Date(b.updatedAt ?? b.createdAt ?? '').getTime();
    return bTs - aTs;
  });
};

const isEligibleForSubmission = (attStatus: string): boolean => {
  return !['Present', 'Weekly Off', 'Public Holiday'].includes(attStatus);
};

const isFinalized = (row: RegulariseRow): boolean => {
  return row.request?.status === 'approved' && row.attStatus === 'Present';
};

const filterRowForTab = (row: RegulariseRow, tab: RegulariseTab): boolean => {
  if (tab === 'pending_submit') {
    return !row.request && isEligibleForSubmission(row.attStatus);
  }

  if (tab === 'submitted') {
    return row.request?.status === 'pending';
  }

  if (tab === 'approved') {
    return row.request?.status === 'approved' && !isFinalized(row);
  }

  if (tab === 'rejected_cancelled') {
    return row.request?.status === 'rejected' || row.request?.status === 'cancelled';
  }

  return isFinalized(row);
};

const statusLabel = (request: RegularizationRequest | null): string => {
  if (!request) return '-';
  if (request.status === 'pending') return 'Submitted';
  if (request.status === 'approved') return 'Approved';
  if (request.status === 'rejected') return 'Rejected';
  return 'Cancelled';
};

const typeLabel = (request: RegularizationRequest | null): string => {
  if (!request) return '-';
  if (request.requestType === 'manual_correction') return 'Regularise Status';
  if (request.requestType === 'missed_punch') return 'Missed Punch';
  return 'Invalid Punch';
};

export const AttendanceRegularisePage = (): JSX.Element => {
  const [selectedMonth, setSelectedMonth] = useState(toDefaultMonth());
  const [activeTab, setActiveTab] = useState<RegulariseTab>('pending_submit');
  const [rows, setRows] = useState<RegulariseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submittingDate, setSubmittingDate] = useState<string | null>(null);

  const loadData = async (): Promise<void> => {
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const range = getMonthRange(selectedMonth);
      const [attendance, allRequestsRaw] = await Promise.all([
        attendanceApi.getMyAttendance({
          startDate: range.startDate,
          endDate: range.endDate,
          page: 1,
          limit: 500,
          view: 'daily'
        }),
        attendanceApi.getRegularizationRequests()
      ]);

      const attendanceByDate = new Map<string, AttendanceHistoryRow>();
      for (const row of attendance.rows) {
        attendanceByDate.set(row.date, row);
      }

      const monthPrefix = `${selectedMonth}-`;
      const allRequests = Array.isArray(allRequestsRaw)
        ? (allRequestsRaw as RegularizationRequest[])
        : [];
      const typedRequests = allRequests.filter((request) =>
        request.targetDate.startsWith(monthPrefix)
      );
      const requestsByDate = new Map<string, RegularizationRequest>();

      for (const request of sortRequestsByLatest(typedRequests)) {
        if (!requestsByDate.has(request.targetDate)) {
          requestsByDate.set(request.targetDate, request);
        }
      }

      const mappedRows: RegulariseRow[] = range.dates
        .map((dateIso) => {
          const source = attendanceByDate.get(dateIso);
          const dateObj = parseIsoLocalDate(dateIso);
          const dayIndex = dateObj ? dateObj.getDay() : -1;
          const dayLabel = dayIndex >= 0 ? dayNameShort[dayIndex] ?? '' : '';
          const defaultStatus = dayIndex === 0 || dayIndex === 6 ? 'Weekly Off' : 'Absent';

          return {
            dateIso,
            dateLabel: formatDate(dateIso),
            dayLabel,
            inTime: formatTime(source?.inTime ?? null),
            outTime: formatTime(source?.outTime ?? null),
            attStatus: source ? mapAttendanceStatus(source.status) : defaultStatus,
            request: requestsByDate.get(dateIso) ?? null
          };
        })
        .sort((a, b) => (a.dateIso < b.dateIso ? 1 : -1));

      setRows(mappedRows);
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to load attendance regularization data'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [selectedMonth]);

  const counts = useMemo(() => {
    return {
      pending_submit: rows.filter((row) => filterRowForTab(row, 'pending_submit')).length,
      submitted: rows.filter((row) => filterRowForTab(row, 'submitted')).length,
      approved: rows.filter((row) => filterRowForTab(row, 'approved')).length,
      rejected_cancelled: rows.filter((row) => filterRowForTab(row, 'rejected_cancelled')).length,
      finalized: rows.filter((row) => filterRowForTab(row, 'finalized')).length
    };
  }, [rows]);

  const filteredRows = useMemo(
    () => rows.filter((row) => filterRowForTab(row, activeTab)),
    [activeTab, rows]
  );

  const submitRegularization = async (row: RegulariseRow): Promise<void> => {
    const reason = window.prompt(
      `Add reason for regularisation request on ${row.dateLabel} (minimum 5 chars):`,
      'Need correction due to missed punch.'
    );

    if (reason === null) {
      return;
    }

    if (reason.trim().length < 5) {
      setError('Reason must be at least 5 characters.');
      return;
    }

    setSubmittingDate(row.dateIso);
    setError('');
    setInfo('');

    try {
      await attendanceApi.createRegularization({
        targetDate: row.dateIso,
        reason: reason.trim(),
        requestType: 'manual_correction'
      });
      setInfo(`Regularisation request submitted for ${row.dateLabel}.`);
      await loadData();
      setActiveTab('submitted');
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to submit regularisation request'));
    } finally {
      setSubmittingDate(null);
    }
  };

  const showAudit = (row: RegulariseRow): void => {
    if (!row.request) {
      window.alert(`No request/audit found for ${row.dateLabel}.`);
      return;
    }

    const entries = row.request.auditTrail ?? [];
    const lines = entries.length
      ? entries.map((entry, index) => {
          const when = entry.at ? new Date(entry.at).toLocaleString('en-IN') : 'N/A';
          const comment = entry.comment ? ` | ${entry.comment}` : '';
          return `${index + 1}. ${entry.action} @ ${when}${comment}`;
        })
      : ['No audit entries recorded.'];

    window.alert(
      [
        `Date: ${row.dateLabel}`,
        `Status: ${statusLabel(row.request)}`,
        `Type: ${typeLabel(row.request)}`,
        '',
        ...lines
      ].join('\n')
    );
  };

  return (
    <section className="req-shell">
      <header className="req-head">
        <h1>Request</h1>
        <span>{'>'}</span>
        <h2>Attendance Regularise</h2>
      </header>

      <section className="req-card">
        <div className="req-toolbar">
          <label>
            <span>Select month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            />
          </label>
          <button type="button" onClick={() => void loadData()} disabled={loading}>
            {loading ? 'Loading...' : 'Search'}
          </button>
        </div>

        <div className="req-tabs">
          {(Object.keys(tabTitles) as RegulariseTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`${statusClassByTab[tab]} ${activeTab === tab ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tabTitles[tab]} ({counts[tab]})
            </button>
          ))}
        </div>
      </section>

      <section className="req-note">
        <p>
          <strong>Note:</strong> Maximum attendance regularise request allowed in a month is 6 days.
        </p>
      </section>

      {error ? <p className="req-feedback req-feedback--error">{error}</p> : null}
      {info ? <p className="req-feedback req-feedback--ok">{info}</p> : null}

      <section className="req-table-card">
        <p className="req-count">Total Records: {filteredRows.length}</p>
        <div className="req-table-wrap">
          <table className="req-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>In</th>
                <th>Out</th>
                <th>Type</th>
                <th>Att Status</th>
                <th>Remarks</th>
                <th>Status</th>
                <th>Audit</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.dateIso}>
                  <td>{row.dateLabel}</td>
                  <td>{row.dayLabel}</td>
                  <td>{row.inTime}</td>
                  <td>{row.outTime}</td>
                  <td>{typeLabel(row.request)}</td>
                  <td>{row.attStatus}</td>
                  <td className="req-remarks">{row.request?.reason ?? '-'}</td>
                  <td>
                    {row.request ? (
                      <span className={`req-status req-status--${row.request.status}`}>
                        {statusLabel(row.request)}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="req-submit-btn"
                        onClick={() => void submitRegularization(row)}
                        disabled={
                          submittingDate === row.dateIso || !isEligibleForSubmission(row.attStatus)
                        }
                      >
                        {submittingDate === row.dateIso ? 'Submitting...' : 'Submit'}
                      </button>
                    )}
                  </td>
                  <td>
                    <button type="button" className="req-audit-btn" onClick={() => showAudit(row)}>
                      i
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredRows.length ? (
                <tr>
                  <td colSpan={9} className="req-empty">
                    No records found for selected filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
};
