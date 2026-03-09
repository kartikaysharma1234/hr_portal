import { useEffect, useMemo, useState } from 'react';

import { attendanceApi } from '../api/attendanceApi';
import { useAuth } from '../context/AuthContext';
import type { RequestMastersPayload, ResignationRecord, ResignationStatus } from '../types/requestModules';
import { getApiErrorMessage } from '../utils/apiError';
import '../styles/request_modules.css';

type ResignationMode = 'list' | 'new';

const statusLabel: Record<ResignationStatus, string> = {
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled'
};

const todayIso = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const plusDaysIso = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const ResignationNotePage = (): JSX.Element => {
  const { user } = useAuth();
  const canApprove =
    user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager';

  const [mode, setMode] = useState<ResignationMode>('list');
  const [masters, setMasters] = useState<RequestMastersPayload | null>(null);
  const [rows, setRows] = useState<ResignationRecord[]>([]);
  const [approvalRows, setApprovalRows] = useState<ResignationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [activeTab, setActiveTab] = useState<ResignationStatus | 'all'>('all');

  const [dateOfResignation, setDateOfResignation] = useState(todayIso());
  const [noticePeriodDays, setNoticePeriodDays] = useState(90);
  const [expectedLastDate, setExpectedLastDate] = useState(plusDaysIso(todayIso(), 90));
  const [hrManagerUserId, setHrManagerUserId] = useState('');
  const [reasonForExit, setReasonForExit] = useState('');
  const [description, setDescription] = useState('');

  const lastDateAsPerPolicy = useMemo(
    () => plusDaysIso(dateOfResignation, noticePeriodDays),
    [dateOfResignation, noticePeriodDays]
  );

  const clearForm = (): void => {
    const defaultDate = todayIso();
    const defaultNotice = masters?.resignation.noticePeriodDays ?? 90;
    setDateOfResignation(defaultDate);
    setNoticePeriodDays(defaultNotice);
    setExpectedLastDate(plusDaysIso(defaultDate, defaultNotice));
    setHrManagerUserId(masters?.resignation.hrApprovers[0]?.id ?? '');
    setReasonForExit(masters?.resignation.reasonOptions[0] ?? '');
    setDescription('');
  };

  const loadMasterData = async (): Promise<void> => {
    const response = await attendanceApi.getRequestMasters();
    setMasters(response);
    if (!hrManagerUserId) {
      setHrManagerUserId(response.resignation.hrApprovers[0]?.id ?? '');
    }
    if (!reasonForExit) {
      setReasonForExit(response.resignation.reasonOptions[0] ?? '');
    }
    setNoticePeriodDays(response.resignation.noticePeriodDays);
    setExpectedLastDate(plusDaysIso(dateOfResignation, response.resignation.noticePeriodDays));
  };

  const loadRows = async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const [myRows, inboxRows] = await Promise.all([
        attendanceApi.listResignationRequests({ scope: 'mine', status: 'all' }),
        canApprove
          ? attendanceApi.listResignationRequests({ scope: 'assigned', status: 'submitted' })
          : Promise.resolve([])
      ]);

      setRows(myRows);
      setApprovalRows(inboxRows);
    } catch (caught) {
      setRows([]);
      setApprovalRows([]);
      setError(getApiErrorMessage(caught, 'Unable to load resignation notes'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        await loadMasterData();
      } catch (caught) {
        setError(getApiErrorMessage(caught, 'Unable to load request options'));
      }
      await loadRows();
    };
    void init();
  }, []);

  const filteredRows = useMemo(() => {
    if (activeTab === 'all') {
      return rows;
    }
    return rows.filter((row) => row.status === activeTab);
  }, [activeTab, rows]);

  const counts = useMemo(
    () => ({
      submitted: rows.filter((row) => row.status === 'submitted').length,
      approved: rows.filter((row) => row.status === 'approved').length,
      rejected: rows.filter((row) => row.status === 'rejected').length,
      cancelled: rows.filter((row) => row.status === 'cancelled').length
    }),
    [rows]
  );

  const submitResignation = async (): Promise<void> => {
    if (!reasonForExit) {
      setError('Please select reason for exit');
      return;
    }
    if (description.trim().length < 5) {
      setError('Description must be at least 5 characters');
      return;
    }

    setSubmitting(true);
    setError('');
    setInfo('');
    try {
      await attendanceApi.createResignationRequest({
        dateOfResignation,
        noticePeriodDays,
        expectedLastDate,
        reasonForExit,
        description: description.trim(),
        hrManagerUserId: hrManagerUserId || undefined
      });
      setInfo('Resignation note submitted.');
      clearForm();
      setMode('list');
      setActiveTab('submitted');
      await loadRows();
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to submit resignation note'));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (row: ResignationRecord): Promise<void> => {
    if (!window.confirm('Cancel this resignation note?')) {
      return;
    }
    try {
      await attendanceApi.cancelResignationRequest(row.id);
      setInfo('Resignation note cancelled.');
      await loadRows();
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to cancel resignation note'));
    }
  };

  const approveRequest = async (row: ResignationRecord): Promise<void> => {
    const comment = window.prompt('Approval comment (optional):', '') ?? '';
    try {
      await attendanceApi.approveResignationRequest(row.id, comment);
      setInfo('Resignation note approved.');
      await loadRows();
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to approve resignation'));
    }
  };

  const rejectRequest = async (row: ResignationRecord): Promise<void> => {
    const comment = window.prompt('Rejection reason:', '');
    if (comment === null) {
      return;
    }
    if (comment.trim().length < 3) {
      setError('Please add a rejection reason.');
      return;
    }
    try {
      await attendanceApi.rejectResignationRequest(row.id, comment.trim());
      setInfo('Resignation note rejected.');
      await loadRows();
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to reject resignation'));
    }
  };

  return (
    <section className="rqm-shell">
      <header className="rqm-head">
        <h1>Request</h1>
        <span>{'>'}</span>
        <h2>Resignation Note</h2>
      </header>

      <section className="rqm-card">
        <div className="rqm-toolbar">
          <button
            type="button"
            className={`rqm-btn ${mode === 'new' ? 'rqm-btn--primary' : ''}`}
            onClick={() => {
              clearForm();
              setMode('new');
            }}
          >
            Create Note
          </button>
          <button type="button" className="rqm-btn" onClick={() => void loadRows()}>
            Refresh
          </button>
          <button
            type="button"
            className={`rqm-btn ${mode === 'list' ? 'rqm-btn--ghost' : ''}`}
            onClick={() => setMode('list')}
          >
            View List
          </button>
        </div>

        {mode === 'list' ? (
          <div className="rqm-tabs">
            <button
              type="button"
              className={`rqm-tab ${activeTab === 'submitted' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('submitted')}
            >
              Submitted ({counts.submitted})
            </button>
            <button
              type="button"
              className={`rqm-tab ${activeTab === 'approved' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('approved')}
            >
              Approved ({counts.approved})
            </button>
            <button
              type="button"
              className={`rqm-tab ${activeTab === 'rejected' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('rejected')}
            >
              Rejected ({counts.rejected})
            </button>
            <button
              type="button"
              className={`rqm-tab ${activeTab === 'cancelled' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('cancelled')}
            >
              Cancelled ({counts.cancelled})
            </button>
            <button
              type="button"
              className={`rqm-tab ${activeTab === 'all' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All
            </button>
          </div>
        ) : null}
      </section>

      {error ? <p className="rqm-feedback rqm-feedback--error">{error}</p> : null}
      {info ? <p className="rqm-feedback rqm-feedback--ok">{info}</p> : null}

      {mode === 'new' ? (
        <section className="rqm-card">
          <div className="rqm-form-grid">
            <label className="rqm-field">
              <span>Date of Resignation</span>
              <input
                type="date"
                className="rqm-input"
                value={dateOfResignation}
                onChange={(event) => setDateOfResignation(event.target.value)}
              />
            </label>

            <label className="rqm-field">
              <span>Notice Period (Days)</span>
              <input
                className="rqm-input"
                value={String(noticePeriodDays)}
                onChange={(event) => setNoticePeriodDays(Number(event.target.value || 0))}
              />
            </label>

            <label className="rqm-field">
              <span>Last Date As Per Policy</span>
              <input className="rqm-input" value={lastDateAsPerPolicy} readOnly />
            </label>

            <label className="rqm-field">
              <span>Expected Last Date</span>
              <input
                type="date"
                className="rqm-input"
                value={expectedLastDate}
                onChange={(event) => setExpectedLastDate(event.target.value)}
              />
            </label>

            <label className="rqm-field">
              <span>Reporting Manager</span>
              <input
                className="rqm-input"
                value={masters?.context.reportingManager?.name ?? 'Not assigned'}
                readOnly
              />
            </label>

            <label className="rqm-field">
              <span>HR Manager</span>
              <select
                className="rqm-select"
                value={hrManagerUserId}
                onChange={(event) => setHrManagerUserId(event.target.value)}
              >
                {(masters?.resignation.hrApprovers ?? []).map((approver) => (
                  <option key={approver.id} value={approver.id}>
                    {approver.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="rqm-field">
              <span>Reason For Exit</span>
              <select
                className="rqm-select"
                value={reasonForExit}
                onChange={(event) => setReasonForExit(event.target.value)}
              >
                {(masters?.resignation.reasonOptions ?? []).map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </label>

            <label className="rqm-field rqm-field--full">
              <span>Description</span>
              <textarea
                className="rqm-textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Tell us why you are resigning"
              />
            </label>
          </div>

          <div className="rqm-actions">
            <button
              type="button"
              className="rqm-btn rqm-btn--primary"
              disabled={submitting}
              onClick={() => void submitResignation()}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
            <button
              type="button"
              className="rqm-btn rqm-btn--ghost"
              onClick={() => {
                clearForm();
                setMode('list');
              }}
            >
              Close
            </button>
          </div>
        </section>
      ) : null}

      {mode === 'list' ? (
        <section className="rqm-card">
          {loading ? <p className="rqm-feedback">Loading resignation notes...</p> : null}
          <div className="rqm-table-wrap">
            <table className="rqm-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Notice</th>
                  <th>Policy Last Date</th>
                  <th>Expected Last Date</th>
                  <th>Reason</th>
                  <th>HR Manager</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.dateOfResignation}</td>
                    <td>{row.noticePeriodDays} days</td>
                    <td>{row.lastDateAsPerPolicy}</td>
                    <td>{row.expectedLastDate}</td>
                    <td>{row.reasonForExit}</td>
                    <td>{row.hrManager?.name ?? 'Unassigned'}</td>
                    <td>
                      <span className={`rqm-status rqm-status--${row.status}`}>{statusLabel[row.status]}</span>
                    </td>
                    <td>
                      <div className="rqm-inline-actions">
                        {row.status === 'submitted' ? (
                          <button type="button" className="rqm-danger" onClick={() => void cancelRequest(row)}>
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredRows.length && !loading ? (
                  <tr>
                    <td colSpan={8} className="rqm-empty">
                      No resignation notes found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {mode === 'list' && canApprove ? (
        <section className="rqm-card">
          <h3 style={{ marginTop: 0 }}>Approval Inbox</h3>
          <div className="rqm-table-wrap">
            <table className="rqm-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date of Resignation</th>
                  <th>Expected Last Date</th>
                  <th>Reason</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvalRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.employee?.name ?? '-'}</td>
                    <td>{row.dateOfResignation}</td>
                    <td>{row.expectedLastDate}</td>
                    <td>{row.reasonForExit}</td>
                    <td>{row.description}</td>
                    <td>
                      <div className="rqm-inline-actions">
                        <button type="button" onClick={() => void approveRequest(row)}>
                          Approve
                        </button>
                        <button type="button" className="rqm-danger" onClick={() => void rejectRequest(row)}>
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!approvalRows.length ? (
                  <tr>
                    <td colSpan={6} className="rqm-empty">
                      No submitted resignation notes to review.
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
