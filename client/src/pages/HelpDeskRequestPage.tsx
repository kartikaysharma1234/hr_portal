import { useEffect, useMemo, useState } from 'react';

import { attendanceApi } from '../api/attendanceApi';
import { useAuth } from '../context/AuthContext';
import type { HelpDeskRecord, HelpDeskStatus, RequestMastersPayload } from '../types/requestModules';
import { getApiErrorMessage } from '../utils/apiError';
import '../styles/request_modules.css';

type HelpDeskMode = 'list' | 'new';

const statusLabel: Record<HelpDeskStatus, string> = {
  pending: 'Pending',
  submitted: 'Submitted',
  responded: 'Responded',
  cancelled: 'Cancelled'
};

const toTicketTargetLabel = (value: 'support_owner' | 'reporting_manager'): string => {
  return value === 'reporting_manager' ? 'Reporting Manager' : 'Support Owner';
};

export const HelpDeskRequestPage = (): JSX.Element => {
  const { user } = useAuth();
  const canRespond =
    user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager';

  const [mode, setMode] = useState<HelpDeskMode>('list');
  const [masters, setMasters] = useState<RequestMastersPayload | null>(null);
  const [rows, setRows] = useState<HelpDeskRecord[]>([]);
  const [assignedRows, setAssignedRows] = useState<HelpDeskRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [activeTab, setActiveTab] = useState<HelpDeskStatus | 'all'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ticketType, setTicketType] = useState('');
  const [targetType, setTargetType] = useState<'support_owner' | 'reporting_manager'>('support_owner');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  const clearForm = (): void => {
    setEditingId(null);
    setTicketType(masters?.helpDesk.typeOptions[0] ?? '');
    setTargetType('support_owner');
    setAssignedToUserId(masters?.helpDesk.supportOwners[0]?.id ?? '');
    setPriority('medium');
    setSubject('');
    setDescription('');
  };

  const loadMasterData = async (): Promise<void> => {
    const response = await attendanceApi.getRequestMasters();
    setMasters(response);
    if (!ticketType) {
      setTicketType(response.helpDesk.typeOptions[0] ?? '');
    }
    if (!assignedToUserId) {
      setAssignedToUserId(response.helpDesk.supportOwners[0]?.id ?? '');
    }
  };

  const loadRows = async (): Promise<void> => {
    setLoading(true);
    setError('');

    try {
      const [myRows, inboxRows] = await Promise.all([
        attendanceApi.listHelpDeskRequests({ scope: 'mine', status: 'all' }),
        canRespond
          ? attendanceApi.listHelpDeskRequests({ scope: 'assigned', status: 'submitted' })
          : Promise.resolve([])
      ]);

      setRows(myRows);
      setAssignedRows(inboxRows);
    } catch (caught) {
      setRows([]);
      setAssignedRows([]);
      setError(getApiErrorMessage(caught, 'Unable to load HelpDesk requests'));
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
      responded: rows.filter((row) => row.status === 'responded').length,
      cancelled: rows.filter((row) => row.status === 'cancelled').length
    }),
    [rows]
  );

  const saveRequest = async (action: 'save' | 'submit'): Promise<void> => {
    if (!ticketType) {
      setError('Please select ticket type');
      return;
    }
    if (subject.trim().length < 3) {
      setError('Subject must be at least 3 characters');
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
      await attendanceApi.createHelpDeskRequest({
        requestId: editingId ?? undefined,
        action,
        ticketType,
        targetType,
        assignedToUserId: targetType === 'support_owner' ? assignedToUserId : undefined,
        priority,
        subject: subject.trim(),
        description: description.trim()
      });

      setInfo(action === 'submit' ? 'HelpDesk request submitted.' : 'HelpDesk request saved as draft.');
      clearForm();
      setMode('list');
      setActiveTab(action === 'submit' ? 'submitted' : 'pending');
      await loadRows();
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to save HelpDesk request'));
    } finally {
      setSubmitting(false);
    }
  };

  const editDraft = (row: HelpDeskRecord): void => {
    setEditingId(row.id);
    setTicketType(row.ticketType);
    setTargetType(row.targetType);
    setAssignedToUserId(row.assignedTo?.id ?? '');
    setPriority(row.priority);
    setSubject(row.subject);
    setDescription(row.description);
    setMode('new');
    setError('');
    setInfo('');
  };

  const submitDraft = async (row: HelpDeskRecord): Promise<void> => {
    setSubmitting(true);
    setError('');
    setInfo('');
    try {
      await attendanceApi.createHelpDeskRequest({
        requestId: row.id,
        action: 'submit',
        ticketType: row.ticketType,
        targetType: row.targetType,
        assignedToUserId: row.assignedTo?.id,
        priority: row.priority,
        subject: row.subject,
        description: row.description
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

  const cancelRequest = async (row: HelpDeskRecord): Promise<void> => {
    if (!window.confirm('Cancel this request?')) {
      return;
    }

    try {
      await attendanceApi.cancelHelpDeskRequest(row.id);
      setInfo('Request cancelled.');
      await loadRows();
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to cancel request'));
    }
  };

  const respondRequest = async (row: HelpDeskRecord): Promise<void> => {
    const responseText = window.prompt('Response', row.response || '');
    if (responseText === null) {
      return;
    }
    if (responseText.trim().length < 3) {
      setError('Response must be at least 3 characters.');
      return;
    }

    try {
      await attendanceApi.respondHelpDeskRequest(row.id, responseText.trim());
      setInfo('Response submitted.');
      await loadRows();
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to respond request'));
    }
  };

  return (
    <section className="rqm-shell">
      <header className="rqm-head">
        <h1>Request</h1>
        <span>{'>'}</span>
        <h2>HelpDesk</h2>
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
              className={`rqm-tab ${activeTab === 'responded' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('responded')}
            >
              Responded ({counts.responded})
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
              <span>Type</span>
              <select className="rqm-select" value={ticketType} onChange={(event) => setTicketType(event.target.value)}>
                {(masters?.helpDesk.typeOptions ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="rqm-field">
              <span>Priority</span>
              <select
                className="rqm-select"
                value={priority}
                onChange={(event) => setPriority(event.target.value as 'high' | 'medium' | 'low')}
              >
                {(masters?.helpDesk.priorityOptions ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="rqm-field">
              <span>To</span>
              <select
                className="rqm-select"
                value={targetType}
                onChange={(event) =>
                  setTargetType(event.target.value as 'support_owner' | 'reporting_manager')
                }
              >
                <option value="support_owner">Support Owner</option>
                <option value="reporting_manager">Reporting Manager</option>
              </select>
            </label>

            <label className="rqm-field">
              <span>Owner</span>
              <select
                className="rqm-select"
                value={assignedToUserId}
                onChange={(event) => setAssignedToUserId(event.target.value)}
                disabled={targetType === 'reporting_manager'}
              >
                {targetType === 'reporting_manager' ? (
                  <option value={masters?.context.reportingManager?.id ?? ''}>
                    {masters?.context.reportingManager?.name ?? 'No reporting manager'}
                  </option>
                ) : (
                  (masters?.helpDesk.supportOwners ?? []).map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="rqm-field rqm-field--full">
              <span>Subject</span>
              <input
                className="rqm-input"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Subject"
              />
            </label>

            <label className="rqm-field rqm-field--full">
              <span>Description</span>
              <textarea
                className="rqm-textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe your issue"
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
                  <th>Type</th>
                  <th>Subject</th>
                  <th>Priority</th>
                  <th>Target</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Response</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.ticketType}</td>
                    <td>{row.subject}</td>
                    <td>{row.priorityLabel}</td>
                    <td>{toTicketTargetLabel(row.targetType)}</td>
                    <td>{row.assignedTo?.name ?? 'Unassigned'}</td>
                    <td>
                      <span className={`rqm-status rqm-status--${row.status}`}>{statusLabel[row.status]}</span>
                    </td>
                    <td>{row.response || '-'}</td>
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
                    <td colSpan={8} className="rqm-empty">
                      No requests found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {mode === 'list' && canRespond ? (
        <section className="rqm-card">
          <h3 style={{ marginTop: 0 }}>Support Inbox</h3>
          <div className="rqm-table-wrap">
            <table className="rqm-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Subject</th>
                  <th>Priority</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignedRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.employee?.name ?? '-'}</td>
                    <td>{row.ticketType}</td>
                    <td>{row.subject}</td>
                    <td>{row.priorityLabel}</td>
                    <td>{row.description}</td>
                    <td>
                      <div className="rqm-inline-actions">
                        <button type="button" onClick={() => void respondRequest(row)}>
                          Respond
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!assignedRows.length ? (
                  <tr>
                    <td colSpan={6} className="rqm-empty">
                      No submitted requests assigned to you.
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
