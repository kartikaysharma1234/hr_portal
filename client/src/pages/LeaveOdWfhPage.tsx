import { useEffect, useMemo, useState } from 'react';

import { attendanceApi } from '../api/attendanceApi';
import { useAuth } from '../context/AuthContext';
import type { AttendanceLeaveLedger, LeaveTypeCode } from '../types/attendance';
import type {
  LeaveDurationType,
  LeaveRequestRecord,
  LeaveRequestStatus,
  LeaveRequestType
} from '../types/leaveRequest';
import { getApiErrorMessage } from '../utils/apiError';
import '../styles/request_leave.css';

type LeavePageMode = 'list' | 'new' | 'ledger';
type LeaveTab = LeaveRequestStatus | 'all';

const leaveTypeOptions: Array<{ value: LeaveRequestType; label: string }> = [
  { value: 'CL', label: 'Casual Leave (CL)' },
  { value: 'HCL', label: 'Half CL (HCL)' },
  { value: 'HPL', label: 'Half PL (HPL)' },
  { value: 'PL', label: 'Privilege Leave (PL)' },
  { value: 'HSL', label: 'Half SL (HSL)' },
  { value: 'SL', label: 'Sick Leave (SL)' },
  { value: 'COF', label: 'Compensatory Off (COF)' },
  { value: 'HCO', label: 'Half Comp Off (HCO)' },
  { value: 'HOD', label: 'Half Outdoor Duty (HOD)' },
  { value: 'OD', label: 'Outdoor Duty (OD)' },
  { value: 'OH', label: 'Optional Holiday (OH)' },
  { value: 'HWFH', label: 'Half Day Work From Home (HWFH)' },
  { value: 'WFH', label: 'Work From Home (WFH)' },
  { value: 'SPL', label: 'Special Leave (SPL)' }
];

const halfDayLeaveTypes = new Set<LeaveRequestType>(['HCL', 'HPL', 'HSL', 'HCO', 'HOD', 'HWFH']);

const leaveLedgerTypes: LeaveTypeCode[] = ['PL', 'CL', 'SL', 'OH'];

const getTodayIso = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getNowYear = (): string => String(new Date().getFullYear());

const toStatusLabel = (status: LeaveRequestStatus): string => {
  if (status === 'pending') return 'Pending';
  if (status === 'submitted') return 'Submitted';
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return 'Cancelled';
};

const computeNoOfDays = (
  fromDate: string,
  toDate: string,
  durationType: LeaveDurationType
): number => {
  if (!fromDate || !toDate) {
    return 0;
  }

  const start = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }

  if (durationType !== 'full_day') {
    return start.getTime() === end.getTime() ? 0.5 : 0;
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((end.getTime() - start.getTime()) / dayMs) + 1;
  return diffDays > 0 ? diffDays : 0;
};

export const LeaveOdWfhPage = (): JSX.Element => {
  const { user } = useAuth();
  const canApprove =
    user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager';

  const [mode, setMode] = useState<LeavePageMode>('list');
  const [activeTab, setActiveTab] = useState<LeaveTab>('all');

  const [rows, setRows] = useState<LeaveRequestRecord[]>([]);
  const [approvalRows, setApprovalRows] = useState<LeaveRequestRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [leaveType, setLeaveType] = useState<LeaveRequestType>('PL');
  const [fromDate, setFromDate] = useState(getTodayIso());
  const [toDate, setToDate] = useState(getTodayIso());
  const [reason, setReason] = useState('');
  const [workLocation, setWorkLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [ledgerType, setLedgerType] = useState<LeaveTypeCode>('PL');
  const [ledgerYear, setLedgerYear] = useState(getNowYear());
  const [ledgerData, setLedgerData] = useState<AttendanceLeaveLedger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');

  const [balances, setBalances] = useState<Record<LeaveTypeCode, number>>({
    PL: 0,
    CL: 0,
    SL: 0,
    OH: 0
  });

  const durationType: LeaveDurationType = useMemo(
    () => (halfDayLeaveTypes.has(leaveType) ? 'first_half' : 'full_day'),
    [leaveType]
  );

  const noOfDays = useMemo(
    () => computeNoOfDays(fromDate, toDate, durationType),
    [fromDate, toDate, durationType]
  );
  const managerLabel = useMemo(() => {
    const withApprover = rows.find((row) => row.approver?.name);
    return withApprover?.approver?.name ?? 'Auto-assigned from employee manager';
  }, [rows]);

  const clearForm = (): void => {
    setEditingId(null);
    setLeaveType('PL');
    setFromDate(getTodayIso());
    setToDate(getTodayIso());
    setReason('');
  };

  const loadRequests = async (): Promise<void> => {
    setLoading(true);
    setError('');

    try {
      const [myRows, assignedRows] = await Promise.all([
        attendanceApi.listLeaveRequests({ scope: 'mine', status: 'all' }),
        canApprove ? attendanceApi.listLeaveRequests({ scope: 'assigned', status: 'submitted' }) : Promise.resolve([])
      ]);

      setRows(myRows);
      setApprovalRows(assignedRows);
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to load leave requests'));
      setRows([]);
      setApprovalRows([]);
    } finally {
      setLoading(false);
    }
  };

  const loadContext = async (): Promise<void> => {
    try {
      const context = await attendanceApi.getMyContext();
      setWorkLocation(context.department || context.designation || 'Main Office');
    } catch {
      setWorkLocation('Main Office');
    }
  };

  const loadBalances = async (): Promise<void> => {
    const year = Number(ledgerYear);
    if (!Number.isInteger(year)) {
      return;
    }

    try {
      const responses = await Promise.all(
        leaveLedgerTypes.map((typeCode) =>
          attendanceApi
            .getLeaveLedger({ year, leaveType: typeCode })
            .then((row) => ({ typeCode, balance: row.balances.currentBalance }))
            .catch(() => ({ typeCode, balance: 0 }))
        )
      );

      const next: Record<LeaveTypeCode, number> = { PL: 0, CL: 0, SL: 0, OH: 0 };
      for (const row of responses) {
        next[row.typeCode] = row.balance;
      }
      setBalances(next);
    } catch {
      setBalances({ PL: 0, CL: 0, SL: 0, OH: 0 });
    }
  };

  const loadLedger = async (): Promise<void> => {
    const year = Number(ledgerYear);
    if (!Number.isInteger(year)) {
      setLedgerError('Year is invalid');
      return;
    }

    setLedgerLoading(true);
    setLedgerError('');

    try {
      const response = await attendanceApi.getLeaveLedger({
        leaveType: ledgerType,
        year
      });
      setLedgerData(response);
    } catch (caught) {
      setLedgerData(null);
      setLedgerError(getApiErrorMessage(caught, 'Unable to load leave ledger'));
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    void loadContext();
    void loadRequests();
  }, []);

  useEffect(() => {
    if (mode === 'new') {
      void loadBalances();
    }
  }, [mode, ledgerYear]);

  const filteredRows = useMemo(() => {
    if (activeTab === 'all') {
      return rows;
    }
    return rows.filter((row) => row.status === activeTab);
  }, [activeTab, rows]);

  const counts = useMemo(
    () => ({
      pending: rows.filter((row) => row.status === 'pending').length,
      submitted: rows.filter((row) => row.status === 'submitted').length,
      approved: rows.filter((row) => row.status === 'approved').length,
      rejected: rows.filter((row) => row.status === 'rejected').length,
      cancelled: rows.filter((row) => row.status === 'cancelled').length
    }),
    [rows]
  );

  const saveRequest = async (action: 'save' | 'submit'): Promise<void> => {
    if (!leaveType) {
      setError('Please select leave type');
      return;
    }

    if (!fromDate || !toDate) {
      setError('Please select from and to dates');
      return;
    }

    if (noOfDays <= 0) {
      setError('Date range or duration is invalid');
      return;
    }

    if (reason.trim().length < 5) {
      setError('Reason must be at least 5 characters');
      return;
    }

    setSubmitting(true);
    setError('');
    setInfo('');

    try {
      await attendanceApi.createLeaveRequest({
        requestId: editingId ?? undefined,
        action,
        leaveType,
        durationType,
        fromDate,
        toDate,
        reason: reason.trim(),
        workLocation: workLocation.trim()
      });

      setInfo(action === 'submit' ? 'Leave request submitted.' : 'Leave request saved as draft.');
      clearForm();
      setMode('list');
      setActiveTab(action === 'submit' ? 'submitted' : 'pending');
      await loadRequests();
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Failed to save leave request'));
    } finally {
      setSubmitting(false);
    }
  };

  const editDraft = (row: LeaveRequestRecord): void => {
    const legacyHalfMapped: Record<string, LeaveRequestType> = {
      CL: row.durationType !== 'full_day' ? 'HCL' : 'CL',
      PL: row.durationType !== 'full_day' ? 'HPL' : 'PL',
      SL: row.durationType !== 'full_day' ? 'HSL' : 'SL',
      OD: row.durationType !== 'full_day' ? 'HOD' : 'OD',
      WFH: row.durationType !== 'full_day' ? 'HWFH' : 'WFH',
      COF: row.durationType !== 'full_day' ? 'HCO' : 'COF'
    };

    setEditingId(row.id);
    setLeaveType(legacyHalfMapped[row.leaveType] ?? row.leaveType);
    setFromDate(row.fromDate);
    setToDate(row.toDate);
    setReason(row.reason);
    setWorkLocation(row.workLocation || workLocation || 'Main Office');
    setMode('new');
    setError('');
    setInfo('');
  };

  const submitDraft = async (row: LeaveRequestRecord): Promise<void> => {
    setSubmitting(true);
    setError('');
    setInfo('');

    try {
      await attendanceApi.createLeaveRequest({
        requestId: row.id,
        action: 'submit',
        leaveType: row.leaveType,
        durationType: row.durationType,
        fromDate: row.fromDate,
        toDate: row.toDate,
        reason: row.reason,
        workLocation: row.workLocation
      });

      setInfo('Draft submitted.');
      setActiveTab('submitted');
      await loadRequests();
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to submit draft'));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (row: LeaveRequestRecord): Promise<void> => {
    const confirmed = window.confirm(`Cancel this ${row.leaveTypeLabel} request?`);
    if (!confirmed) {
      return;
    }

    setError('');
    setInfo('');

    try {
      await attendanceApi.cancelLeaveRequest(row.id);
      setInfo('Leave request cancelled.');
      await loadRequests();
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to cancel leave request'));
    }
  };

  const approveRequest = async (row: LeaveRequestRecord): Promise<void> => {
    const comment = window.prompt('Approval comment (optional):', '') ?? '';

    setError('');
    setInfo('');
    try {
      await attendanceApi.approveLeaveRequest(row.id, comment);
      setInfo('Leave request approved.');
      await loadRequests();
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to approve leave request'));
    }
  };

  const rejectRequest = async (row: LeaveRequestRecord): Promise<void> => {
    const comment = window.prompt('Rejection reason (required):', '');
    if (comment === null) {
      return;
    }

    if (comment.trim().length < 3) {
      setError('Please add a rejection reason.');
      return;
    }

    setError('');
    setInfo('');
    try {
      await attendanceApi.rejectLeaveRequest(row.id, comment.trim());
      setInfo('Leave request rejected.');
      await loadRequests();
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to reject leave request'));
    }
  };

  return (
    <section className="lwf-shell">
      <header className="lwf-head">
        <h1>Request</h1>
        <span>{'>'}</span>
        <h2>Leave/OD/WFH</h2>
      </header>

      <section className="lwf-toolbar-card">
        <div className="lwf-toolbar">
          <button
            type="button"
            className={`lwf-quick-btn ${mode === 'new' ? 'is-active' : ''}`}
            onClick={() => {
              clearForm();
              setMode('new');
            }}
          >
            + New Request
          </button>
          <button
            type="button"
            className={`lwf-quick-btn ${mode === 'ledger' ? 'is-active' : ''}`}
            onClick={() => {
              setMode('ledger');
              void loadLedger();
            }}
          >
            Leave Ledger
          </button>
        </div>

        {mode === 'list' ? (
          <>
            <div className="lwf-tabs">
              {([
                ['pending', counts.pending],
                ['submitted', counts.submitted],
                ['approved', counts.approved],
                ['rejected', counts.rejected],
                ['cancelled', counts.cancelled]
              ] as Array<[LeaveRequestStatus, number]>).map(([status, count]) => (
                <button
                  key={status}
                  type="button"
                  className={`lwf-tab ${activeTab === status ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(status)}
                >
                  {toStatusLabel(status)} ({count})
                </button>
              ))}
            </div>
            <div className="lwf-refresh-row">
              <button
                type="button"
                className={`lwf-tab lwf-tab--all ${activeTab === 'all' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All
              </button>
              <button type="button" className="lwf-refresh-btn" onClick={() => void loadRequests()}>
                Refresh
              </button>
            </div>
          </>
        ) : null}
      </section>

      {error ? <p className="lwf-feedback lwf-feedback--error">{error}</p> : null}
      {info ? <p className="lwf-feedback lwf-feedback--ok">{info}</p> : null}

      {mode === 'new' ? (
        <section className="lwf-card">
          <div className="lwf-form-grid">
            <label>
              <span>Work Location</span>
              <input value={workLocation} onChange={(event) => setWorkLocation(event.target.value)} />
            </label>

            <label>
              <span>Leave Type</span>
              <select
                value={leaveType}
                onChange={(event) => setLeaveType(event.target.value as LeaveRequestType)}
              >
                {leaveTypeOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Manager</span>
              <input value={managerLabel} readOnly />
            </label>

            <label>
              <span>From Date</span>
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>

            <label>
              <span>To Date</span>
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>

            <label>
              <span>No. of Days</span>
              <input value={noOfDays ? noOfDays.toFixed(2) : '0.00'} readOnly />
            </label>

            <label className="lwf-span-2">
              <span>Reason</span>
              <textarea
                value={reason}
                placeholder="Reason"
                rows={4}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          </div>

          <div className="lwf-action-row">
            <button
              type="button"
              className="lwf-action-btn"
              disabled={submitting}
              onClick={() => void saveRequest('save')}
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              className="lwf-action-btn lwf-action-btn--primary"
              disabled={submitting}
              onClick={() => void saveRequest('submit')}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
            <button
              type="button"
              className="lwf-action-btn lwf-action-btn--ghost"
              onClick={() => {
                clearForm();
                setMode('list');
              }}
            >
              Close
            </button>
          </div>

          <div className="lwf-balance-card">
            <h3>My Leave Balance</h3>
            <div className="lwf-balance-grid">
              {leaveLedgerTypes.map((typeCode) => (
                <div key={typeCode} className="lwf-balance-item">
                  <strong>{typeCode}</strong>
                  <span>{balances[typeCode].toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {mode === 'ledger' ? (
        <section className="lwf-card">
          <div className="lwf-ledger-filter">
            <label>
              <span>Leave Type</span>
              <select value={ledgerType} onChange={(event) => setLedgerType(event.target.value as LeaveTypeCode)}>
                {leaveLedgerTypes.map((typeCode) => (
                  <option key={typeCode} value={typeCode}>
                    {typeCode}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Year</span>
              <input
                value={ledgerYear}
                onChange={(event) => setLedgerYear(event.target.value)}
                placeholder="YYYY"
              />
            </label>

            <button type="button" className="lwf-action-btn lwf-action-btn--primary" onClick={() => void loadLedger()}>
              Search
            </button>
          </div>

          {ledgerError ? <p className="lwf-feedback lwf-feedback--error">{ledgerError}</p> : null}
          {ledgerLoading ? <p className="lwf-muted">Loading leave ledger...</p> : null}

          {ledgerData ? (
            <>
              <div className="lwf-ledger-summary">
                <div>
                  <span>Employee</span>
                  <strong>{`${ledgerData.employee.employeeName} (${ledgerData.employee.employeeCode})`}</strong>
                </div>
                <div>
                  <span>Leave Type</span>
                  <strong>{ledgerData.leaveType}</strong>
                </div>
                <div>
                  <span>Opening Date</span>
                  <strong>{ledgerData.openingBalanceDate}</strong>
                </div>
                <div>
                  <span>Opening Balance</span>
                  <strong>{ledgerData.openingBalance.toFixed(2)}</strong>
                </div>
              </div>

              <div className="lwf-table-wrap">
                <table className="lwf-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Days</th>
                      <th>Credit</th>
                      <th>Availed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerData.months.map((monthRow) => (
                      <tr key={monthRow.month}>
                        <td>{monthRow.monthLabel}</td>
                        <td>{monthRow.days}</td>
                        <td>{monthRow.credit.toFixed(2)}</td>
                        <td>{monthRow.availed.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="lwf-total-row">
                      <td>Total</td>
                      <td />
                      <td>{ledgerData.totals.credit.toFixed(2)}</td>
                      <td>{ledgerData.totals.availed.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="lwf-ledger-balance">
                <div>
                  <span>Ledger Balance</span>
                  <strong>{ledgerData.balances.ledgerBalance.toFixed(2)}</strong>
                </div>
                <div>
                  <span>Current Balance</span>
                  <strong>{ledgerData.balances.currentBalance.toFixed(2)}</strong>
                </div>
                <div>
                  <span>Discrepancy</span>
                  <strong>{ledgerData.balances.discrepancy.toFixed(2)}</strong>
                </div>
              </div>

              <div className="lwf-action-row">
                <button
                  type="button"
                  className="lwf-action-btn lwf-action-btn--ghost"
                  onClick={() => setMode('list')}
                >
                  Close
                </button>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {mode === 'list' ? (
        <section className="lwf-card">
          {loading ? <p className="lwf-muted">Loading requests...</p> : null}

          <div className="lwf-table-wrap">
            <table className="lwf-table">
              <thead>
                <tr>
                  <th>Sr.No.</th>
                  <th>Leave Type</th>
                  <th>Applied On</th>
                  <th>From Date</th>
                  <th>To Date</th>
                  <th>No. of Days</th>
                  <th>Approver</th>
                  <th>Status</th>
                  <th>Proxy</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td>{row.leaveTypeLabel}</td>
                    <td>{row.appliedOnLabel}</td>
                    <td>{row.fromDateLabel}</td>
                    <td>{row.toDateLabel}</td>
                    <td>{row.noOfDays.toFixed(2)}</td>
                    <td>{row.approver?.name ?? 'Unassigned'}</td>
                    <td>{toStatusLabel(row.status)}</td>
                    <td>{row.proxyApprover?.name ?? '-'}</td>
                    <td className="lwf-actions-cell">
                      {row.status === 'pending' ? (
                        <>
                          <button type="button" onClick={() => editDraft(row)}>
                            Edit
                          </button>
                          <button type="button" disabled={submitting} onClick={() => void submitDraft(row)}>
                            Submit
                          </button>
                        </>
                      ) : null}
                      {(row.status === 'pending' || row.status === 'submitted') ? (
                        <button type="button" onClick={() => void cancelRequest(row)}>
                          Cancel
                        </button>
                      ) : null}
                      {row.status === 'approved' && row.decisionComment ? (
                        <button
                          type="button"
                          onClick={() => window.alert(`Approval comment:\n${row.decisionComment}`)}
                        >
                          Note
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!filteredRows.length && !loading ? (
                  <tr>
                    <td colSpan={10} className="lwf-empty">
                      No requests found for selected filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {mode === 'list' && canApprove ? (
        <section className="lwf-card">
          <h3 className="lwf-subtitle">Manager Approval Inbox</h3>
          <div className="lwf-table-wrap">
            <table className="lwf-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvalRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.employee?.name ?? '-'}</td>
                    <td>{row.leaveTypeLabel}</td>
                    <td>{row.fromDateLabel}</td>
                    <td>{row.toDateLabel}</td>
                    <td>{row.noOfDays.toFixed(2)}</td>
                    <td className="lwf-reason-cell">{row.reason}</td>
                    <td className="lwf-actions-cell">
                      <button type="button" onClick={() => void approveRequest(row)}>
                        Approve
                      </button>
                      <button type="button" onClick={() => void rejectRequest(row)}>
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
                {!approvalRows.length ? (
                  <tr>
                    <td colSpan={7} className="lwf-empty">
                      No submitted requests pending your approval.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  );
};
