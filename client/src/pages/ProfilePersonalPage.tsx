import { useState } from 'react';
import { mockPersonalFields } from '../utils/mockData';
import type { PersonalField } from '../utils/mockData';

export const ProfilePersonalPage = (): JSX.Element => {
  const [isAmending, setIsAmending] = useState(false);
  const [fields, setFields] = useState<PersonalField[]>(() =>
    mockPersonalFields.map((f) => ({ ...f }))
  );
  const [originalFields, setOriginalFields] = useState<PersonalField[]>(() =>
    mockPersonalFields.map((f) => ({ ...f }))
  );
  const [pendingAmends, setPendingAmends] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAmend = (): void => {
    setOriginalFields(fields.map((f) => ({ ...f })));
    setIsAmending(true);
    setShowSuccess(false);
  };

  const handleCancel = (): void => {
    setFields(originalFields.map((f) => ({ ...f })));
    setIsAmending(false);
  };

  const handleSubmitAmend = (): void => {
    // Find changed fields → mark as pending
    const newPending: Record<string, string> = { ...pendingAmends };
    fields.forEach((f, i) => {
      if (f.value !== originalFields[i].value && f.editable && !f.adminOnly) {
        newPending[f.key] = f.value;
      }
    });
    setPendingAmends(newPending);
    setIsAmending(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 4000);
  };

  const handleFieldChange = (key: string, newVal: string): void => {
    setFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, value: newVal } : f))
    );
  };

  const renderField = (field: PersonalField): JSX.Element => {
    const isPending = pendingAmends[field.key] !== undefined;
    const isLocked = field.adminOnly || !field.editable;
    const canEdit = isAmending && field.editable && !field.adminOnly;

    if (canEdit) {
      if (field.type === 'select' && field.options) {
        return (
          <select
            className="pf-input"
            value={field.value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
          >
            {field.options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        );
      }
      if (field.type === 'textarea') {
        return (
          <textarea
            className="pf-input pf-textarea"
            value={field.value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            rows={3}
          />
        );
      }
      return (
        <input
          className="pf-input"
          type={field.type === 'date' ? 'text' : 'text'}
          value={field.value}
          onChange={(e) => handleFieldChange(field.key, e.target.value)}
        />
      );
    }

    // Read-only display
    return (
      <div className="pf-value-display">
        <span className={isLocked ? 'pf-locked-value' : ''}>
          {field.value || '—'}
        </span>
        {isLocked && (
          <span className="pf-admin-badge" title="Admin managed">🔒</span>
        )}
        {isPending && (
          <span className="pf-pending-badge" title="Pending admin approval">⏳ Pending</span>
        )}
      </div>
    );
  };

  return (
    <div className="profile-page">
      {/* Breadcrumb */}
      <div className="ess-breadcrumb">
        <span>My Profile</span>
        <span className="ess-breadcrumb-sep">›</span>
        <span className="ess-breadcrumb-active">Personal</span>
      </div>

      {/* Personal Form */}
      <div className="pf-card">
        <div className="pf-card-header">
          <div className="pf-card-header-left">
            <span className="pf-card-icon">👤</span>
            <h3>Personal Information</h3>
          </div>
          {!isAmending && (
            <button
              type="button"
              className="ess-btn ess-btn--primary pf-amend-btn"
              onClick={handleAmend}
            >
              ✏️ Amend
            </button>
          )}
        </div>

        {showSuccess && (
          <div className="pf-success-banner">
            <span>✅</span>
            <div>
              <strong>Amendment submitted successfully!</strong>
              <p>Your changes are pending admin approval. They will be visible once approved.</p>
            </div>
          </div>
        )}

        <div className="pf-form">
          {fields.map((field) => (
            <div
              key={field.key}
              className={`pf-row ${field.type === 'textarea' ? 'pf-row--wide' : ''}`}
            >
              <label className="pf-label">
                {field.label}
                {field.required && <span className="pf-required">*</span>}
              </label>
              <div className="pf-field">
                {renderField(field)}
              </div>
            </div>
          ))}
        </div>

        {/* Amend / Cancel buttons */}
        {isAmending && (
          <div className="pf-action-bar">
            <button
              type="button"
              className="ess-btn ess-btn--primary"
              onClick={handleSubmitAmend}
            >
              Amend
            </button>
            <button
              type="button"
              className="ess-btn ess-btn--glass"
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Notes */}
        <div className="pf-notes">
          <div className="pf-notes-header">📌 NOTE</div>
          <ul>
            <li>Changes are accepted subject to HR review</li>
            <li>Fields marked with <span className="pf-required">*</span> helps HR to serve employees better with regards to compliance, safety etc</li>
            <li>Fields with 🔒 are managed by admin and cannot be edited by employees</li>
            <li>If EPF contribution is done any time in your employment career then please mention PF UAN number</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
