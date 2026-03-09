import { useEffect, useMemo, useState } from 'react';

import { attendanceApi } from '../api/attendanceApi';
import { useAuth } from '../context/AuthContext';
import type { AppreciationRecord, AppreciationStatus, RequestMastersPayload } from '../types/requestModules';
import { getApiErrorMessage } from '../utils/apiError';
import '../styles/request_modules.css';

type AppreciationMode = 'list' | 'new';

const statusLabel: Record<AppreciationStatus, string> = {
  pending: 'Pending',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled'
};

export const AppreciationRequestPage = (): JSX.Element => {
  const { user } = useAuth();
  const canApprove =
    user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager';

  const [mode, setMode] = useState<AppreciationMode>('list');
  const [masters, setMasters] = useState<RequestMastersPayload | null>(null);
  const [rows, setRows] = useState<AppreciationRecord[]>([]);
  const [approvalRows, setApprovalRows] = useState<AppreciationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [activeTab, setActiveTab] = useState<AppreciationStatus | 'all'>('all');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [appreciationToUserId, setAppreciationToUserId] = useState('');
  const [appreciationCategory, setAppreciationCategory] = useState('');
  const [appreciationTitle, setAppreciationTitle] = useState('');
  const [description, setDescription] = useState('');
  const [approverUserId, setApproverUserId] = useState('');

  const clearForm = (): void => {
    setEditingId(null);
    setAppreciationToUserId(masters?.appreciation.recipients[0]?.id ?? '');
    setAppreciationCategory(masters?.appreciation.categoryOptions[0] ?? '');
    setAppreciationTitle('');
    setDescription('');
    setApproverUserId(masters?.appreciation.hrApprovers[0]?.id ?? '');
  };

  const loadMasterData = async (): Promise<void> => {
    const response = await attendanceApi.getRequestMasters();
    setMasters(response);
    if (!appreciationToUserId) {
      setAppreciationToUserId(response.appreciation.recipients[0]?.id ?? '');
    }
    if (!appreciationCategory) {
      setAppreciationCategory(response.appreciation.categoryOptions[0] ?? '');
    }
    if (!approverUserId) {
      setApproverUserId(response.appreciation.hrApprovers[0]?.id ?? '');
    }
  };

  const loadRows = async (): Promise<void> => {
    setLoading(true);
    setError('');

    try {
      const [myRows, inboxRows] = await Promise.all([
        attendanceApi.listAppreciationRequests({ scope: 'mine', status: 'all' }),
        canApprove
          ? attendanceApi.listAppreciationRequests({ scope: 'assigned', status: 'submitted' })
          : Promise.resolve([])
      ]);
      setRows(myRows);
      setApprovalRows(inboxRows);
    } catch (caught) {
      setRows([]);
      setApprovalRows([]);
      setError(getApiErrorMessage(caught, 'Unable to load appreciation requests'));
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
      pending: rows.filter((row) => row.status === 'pending').length,
      submitted: rows.filter((row) => row.status === 'submitted').length,
      approved: rows.filter((row) => row.status === 'approved').length,
      rejected: rows.filter((row) => row.status === 'rejected').length,
      cancelled: rows.filter((row) => row.status === 'cancelled').length
    }),
    [rows]
  );

  const saveRequest = async (action: 'save' | 'submit'): Promise<void> => {
    if (!appreciationToUserId) {
      setError('Please select appreciation recipient');
      return;
    }
    if (!appreciationCategory) {
      setError('Please select appreciation category');
      return;
    }
    if (appreciationTitle.trim().length < 3) {
      setError('Appreciation title must be at least 3 characters');
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
      await attendanceApi.createAppreciationRequest({
        requestId: editingId ?? undefined,
        action,
        appreciationToUserId,
        appreciationCategory,
        appreciationTitle: appreciationTitle.trim(),
        description: description.trim(),
        approverUserId
      });
      setInfo(action === 'submit' ? 'Appreciation submitted.' : 'Draft saved.');
      clearForm();
      setMode('list');
      setActiveTab(action === 'submit' ? 'submitted' : 'pending');
      await loadRows();
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to save appreciation request'));
    } finally {
      setSubmitting(false);
    }
  };

  const editDraft = (row: AppreciationRecord): void => {
    setEditingId(row.id);
    setAppreciationToUserId(row.appreciationTo?.id ?? '');
    setAppreciationCategory(row.appreciationCategory);
    setAppreciationTitle(row.appreciationTitle);
    setDescription(row.description);
    setApproverUserId(row.approver?.id ?? '');
    setMode('new');
    setError('');
    setInfo('');
  };

  const submitDraft = async (row: AppreciationRecord): Promise<void> => {
    setSubmitting(true);
    setError('');
    setInfo('');
    try {
      await attendanceApi.createAppreciationRequest({
        requestId: row.id,
        action: 'submit',
        appreciationToUserId: row.appreciationTo?.id ?? '',
        appreciationCategory: row.appreciationCategory,
        appreciationTitle: row.appreciationTitle,
        description: row.description,
        approverUserId: row.approver?.id
      });
      setInfo('Draft submitted.');
      setActiveTab('submitted');
      await loadRows();
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to submit draft'));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (row: AppreciationRecord): Promise<void> => {
    if (!window.confirm('Cancel this appreciation request?')) {
      return;
    }
    try {
      await attendanceApi.cancelAppreciationRequest(row.id);
      setInfo('Request cancelled.');
      await loadRows();
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to cancel request'));
    }
  };

  const approveRequest = async (row: AppreciationRecord): Promise<void> => {
    const comment = window.prompt('Approval comment (optional):', '') ?? '';
    try {
      await attendanceApi.approveAppreciationRequest(row.id, comment);
      setInfo('Request approved.');
      await loadRows();
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to approve request'));
    }
  };

  const rejectRequest = async (row: AppreciationRecord): Promise<void> => {
    const comment = window.prompt('Rejection reason:', '');
    if (comment === null) {
      return;
    }
    if (comment.trim().length < 3) {
      setError('Please add a rejection reason.');
      return;
    }
    try {
      await attendanceApi.rejectAppreciationRequest(row.id, comment.trim());
      setInfo('Request rejected.');
      await loadRows();
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to reject request'));
    }
  };

  return (
    <section className="rqm-shell">
      <header className="rqm-head">
        <h1>Request</h1>
        <span>{'>'}</span>
        <h2>Appreciation</h2>
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
            New
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
              <span>Appreciation To</span>
              <select
                className="rqm-select"
                value={appreciationToUserId}
                onChange={(event) => setAppreciationToUserId(event.target.value)}
              >
                {(masters?.appreciation.recipients ?? []).map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.name} {recipient.employeeCode ? `(${recipient.employeeCode})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="rqm-field">
              <span>Approver HR Manager</span>
              <select
                className="rqm-select"
                value={approverUserId}
                onChange={(event) => setApproverUserId(event.target.value)}
              >
                {(masters?.appreciation.hrApprovers ?? []).map((approver) => (
                  <option key={approver.id} value={approver.id}>
                    {approver.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="rqm-field">
              <span>Appreciation Category</span>
              <select
                className="rqm-select"
                value={appreciationCategory}
                onChange={(event) => setAppreciationCategory(event.target.value)}
              >
                {(masters?.appreciation.categoryOptions ?? []).map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="rqm-field">
              <span>Appreciation</span>
              <input
                className="rqm-input"
                value={appreciationTitle}
                onChange={(event) => setAppreciationTitle(event.target.value)}
                placeholder="Appreciation title"
              />
            </label>

            <label className="rqm-field rqm-field--full">
              <span>Description</span>
              <textarea
                className="rqm-textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Reason for appreciation"
              />
            </label>
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
                  <th>To</th>
                  <th>Category</th>
                  <th>Appreciation</th>
                  <th>Description</th>
                  <th>Approver</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.appreciationTo?.name ?? '-'}</td>
                    <td>{row.appreciationCategory}</td>
                    <td>{row.appreciationTitle}</td>
                    <td>{row.description}</td>
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
                    <td colSpan={7} className="rqm-empty">
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
          <h3 style={{ marginTop: 0 }}>Approver Inbox</h3>
          <div className="rqm-table-wrap">
            <table className="rqm-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Category</th>
                  <th>Appreciation</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvalRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.requestedBy?.name ?? '-'}</td>
                    <td>{row.appreciationTo?.name ?? '-'}</td>
                    <td>{row.appreciationCategory}</td>
                    <td>{row.appreciationTitle}</td>
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
