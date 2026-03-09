import { useEffect, useMemo, useState } from 'react';

import { attendanceApi } from '../api/attendanceApi';
import { useAuth } from '../context/AuthContext';
import type {
  LeaveEncashmentMeta,
  LeaveEncashmentRecord,
  LeaveEncashmentStatus,
  RequestMastersPayload
} from '../types/requestModules';
import { getApiErrorMessage } from '../utils/apiError';
import '../styles/request_modules.css';

type LeaveEncashmentMode = 'list' | 'new';

const statusLabel: Record<LeaveEncashmentStatus, string> = {
  pending: 'Pending',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled'
};

export const LeaveEncashmentPage = (): JSX.Element => {
  const { user } = useAuth();
  const canApprove =
    user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager';

  const [mode, setMode] = useState<LeaveEncashmentMode>('list');
  const [masters, setMasters] = useState<RequestMastersPayload | null>(null);
  const [rows, setRows] = useState<LeaveEncashmentRecord[]>([]);
  const [approvalRows, setApprovalRows] = useState<LeaveEncashmentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [activeTab, setActiveTab] = useState<LeaveEncashmentStatus | 'all'>('all');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [leaveType, setLeaveType] = useState<'PL' | 'CL' | 'SL' | 'OH'>('PL');
  const [daysToEncash, setDaysToEncash] = useState('0');
  const [purpose, setPurpose] = useState('');
  const [approverUserId, setApproverUserId] = useState('');
  const [meta, setMeta] = useState<LeaveEncashmentMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  const clearForm = (): void => {
    setEditingId(null);
    setLeaveType(masters?.leaveEncashment.leaveTypes[0] ?? 'PL');
    setDaysToEncash('0');
    setPurpose('');
    setApproverUserId(masters?.leaveEncashment.hrApprovers[0]?.id ?? '');
  };

  const loadMasterData = async (): Promise<void> => {
    const response = await attendanceApi.getRequestMasters();
    setMasters(response);
    if (!approverUserId) {
      setApproverUserId(response.leaveEncashment.hrApprovers[0]?.id ?? '');
    }
    if (!leaveType) {
      setLeaveType(response.leaveEncashment.leaveTypes[0] ?? 'PL');
    }
  };

  const loadRows = async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const [myRows, inboxRows] = await Promise.all([
        attendanceApi.listLeaveEncashmentRequests({ scope: 'mine', status: 'all' }),
        canApprove
          ? attendanceApi.listLeaveEncashmentRequests({ scope: 'assigned', status: 'submitted' })
          : Promise.resolve([])
      ]);
      setRows(myRows);
      setApprovalRows(inboxRows);
    } catch (caught) {
      setRows([]);
      setApprovalRows([]);
      setError(getApiErrorMessage(caught, 'Unable to load leave encashment requests'));
    } finally {
      setLoading(false);
    }
  };

  const loadMeta = async (nextLeaveType: 'PL' | 'CL' | 'SL' | 'OH'): Promise<void> => {
    setMetaLoading(true);
    try {
      const response = await attendanceApi.getLeaveEncashmentMeta(nextLeaveType);
      setMeta(response);
    } catch {
      setMeta(null);
    } finally {
      setMetaLoading(false);
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

  useEffect(() => {
    void loadMeta(leaveType);
  }, [leaveType]);

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
    const daysNumeric = Number(daysToEncash);
    if (!Number.isFinite(daysNumeric) || daysNumeric <= 0) {
      setError('Days to encash must be greater than 0');
      return;
    }
    if (purpose.trim().length < 5) {
      setError('Purpose must be at least 5 characters');
      return;
    }

    setSubmitting(true);
    setError('');
    setInfo('');
    try {
      await attendanceApi.createLeaveEncashmentRequest({
        requestId: editingId ?? undefined,
        action,
        leaveType,
        daysToEncash: daysNumeric,
        purpose: purpose.trim(),
        approverUserId
      });
      setInfo(action === 'submit' ? 'Leave encashment submitted.' : 'Draft saved.');
      clearForm();
      setMode('list');
      setActiveTab(action === 'submit' ? 'submitted' : 'pending');
      await loadRows();
      await loadMeta(leaveType);
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to save leave encashment request'));
    } finally {
      setSubmitting(false);
    }
  };

  const editDraft = (row: LeaveEncashmentRecord): void => {
    setEditingId(row.id);
    setLeaveType(row.leaveType);
    setDaysToEncash(row.daysToEncash.toFixed(2));
    setPurpose(row.purpose);
    setApproverUserId(row.approver?.id ?? '');
    setMode('new');
    setError('');
    setInfo('');
  };

  const submitDraft = async (row: LeaveEncashmentRecord): Promise<void> => {
    setSubmitting(true);
    setError('');
    setInfo('');
    try {
      await attendanceApi.createLeaveEncashmentRequest({
        requestId: row.id,
        action: 'submit',
        leaveType: row.leaveType,
        daysToEncash: row.daysToEncash,
        purpose: row.purpose,
        approverUserId: row.approver?.id
      });
      setInfo('Draft submitted.');
      setActiveTab('submitted');
      await loadRows();
      await loadMeta(row.leaveType);
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to submit draft'));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (row: LeaveEncashmentRecord): Promise<void> => {
    if (!window.confirm('Cancel this leave encashment request?')) {
      return;
    }
    try {
      await attendanceApi.cancelLeaveEncashmentRequest(row.id);
      setInfo('Request cancelled.');
      await loadRows();
      await loadMeta(row.leaveType);
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to cancel request'));
    }
  };

  const approveRequest = async (row: LeaveEncashmentRecord): Promise<void> => {
    const comment = window.prompt('Approval comment (optional):', '') ?? '';
    try {
      await attendanceApi.approveLeaveEncashmentRequest(row.id, comment);
      setInfo('Request approved.');
      await loadRows();
      await loadMeta(row.leaveType);
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to approve request'));
    }
  };

  const rejectRequest = async (row: LeaveEncashmentRecord): Promise<void> => {
    const comment = window.prompt('Rejection reason:', '');
    if (comment === null) {
      return;
    }
    if (comment.trim().length < 3) {
      setError('Please add a rejection reason.');
      return;
    }
    try {
      await attendanceApi.rejectLeaveEncashmentRequest(row.id, comment.trim());
      setInfo('Request rejected.');
      await loadRows();
      await loadMeta(row.leaveType);
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to reject request'));
    }
  };

  return (
    <section className="rqm-shell">
      <header className="rqm-head">
        <h1>Request</h1>
        <span>{'>'}</span>
        <h2>Leave Encashment</h2>
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
            New Request
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
              className={`rqm-tab ${activeTab === 'pending' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              Pending ({counts.pending})
            </button>
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
              <span>Leave Type</span>
              <select
                className="rqm-select"
                value={leaveType}
                onChange={(event) => setLeaveType(event.target.value as 'PL' | 'CL' | 'SL' | 'OH')}
              >
                {(masters?.leaveEncashment.leaveTypes ?? ['PL', 'CL', 'SL', 'OH']).map((typeCode) => (
                  <option key={typeCode} value={typeCode}>
                    {typeCode}
                  </option>
                ))}
              </select>
            </label>

            <label className="rqm-field">
              <span>Days To Encash</span>
              <input
                className="rqm-input"
                value={daysToEncash}
                onChange={(event) => setDaysToEncash(event.target.value)}
              />
            </label>

            <label className="rqm-field">
              <span>HR Manager</span>
              <select
                className="rqm-select"
                value={approverUserId}
                onChange={(event) => setApproverUserId(event.target.value)}
              >
                {(masters?.leaveEncashment.hrApprovers ?? []).map((approver) => (
                  <option key={approver.id} value={approver.id}>
                    {approver.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="rqm-field rqm-field--full">
              <span>Purpose</span>
              <textarea
                className="rqm-textarea"
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
                placeholder="Purpose for leave encashment"
              />
            </label>
          </div>

          <div className="rqm-meta-grid">
            <div className="rqm-meta-card">
              <span>Encashable Days / Year</span>
              <strong>{metaLoading ? '...' : (meta?.encashableDaysPerYear ?? 0).toFixed(2)}</strong>
            </div>
            <div className="rqm-meta-card">
              <span>Encashed (Current Year)</span>
              <strong>{metaLoading ? '...' : (meta?.encashedDaysCurrentYear ?? 0).toFixed(2)}</strong>
            </div>
            <div className="rqm-meta-card">
              <span>Current Leave Balance</span>
              <strong>{metaLoading ? '...' : (meta?.leaveBalance ?? 0).toFixed(2)}</strong>
            </div>
            <div className="rqm-meta-card">
              <span>Available To Encash</span>
              <strong>{metaLoading ? '...' : (meta?.availableToEncash ?? 0).toFixed(2)}</strong>
            </div>
          </div>

          <div className="rqm-actions">
            <button type="button" className="rqm-btn" disabled={submitting} onClick={() => void saveRequest('save')}>
              {submitting ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              className="rqm-btn rqm-btn--primary"
              disabled={submitting}
              onClick={() => void saveRequest('submit')}
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
          {loading ? <p className="rqm-feedback">Loading requests...</p> : null}
          <div className="rqm-table-wrap">
            <table className="rqm-table">
              <thead>
                <tr>
                  <th>Leave Type</th>
                  <th>Days</th>
                  <th>Purpose</th>
                  <th>HR Manager</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.leaveType}</td>
                    <td>{row.daysToEncash.toFixed(2)}</td>
                    <td>{row.purpose}</td>
                    <td>{row.approver?.name ?? 'Unassigned'}</td>
                    <td>
                      <span className={`rqm-status rqm-status--${row.status}`}>{statusLabel[row.status]}</span>
                    </td>
                    <td>
                      <div className="rqm-inline-actions">
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
                    <td colSpan={6} className="rqm-empty">
                      No requests found.
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
                  <th>Leave Type</th>
                  <th>Days</th>
                  <th>Purpose</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvalRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.employee?.name ?? '-'}</td>
                    <td>{row.leaveType}</td>
                    <td>{row.daysToEncash.toFixed(2)}</td>
                    <td>{row.purpose}</td>
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
                    <td colSpan={5} className="rqm-empty">
                      No submitted requests pending approval.
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
