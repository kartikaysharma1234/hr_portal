import { useState } from 'react';

export const ProfileWorkExpPage = (): JSX.Element => {
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAmend = (): void => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 4000);
  };

  return (
    <div className="profile-page">
      <div className="ess-breadcrumb">
        <span>My Profile</span>
        <span className="ess-breadcrumb-sep">›</span>
        <span className="ess-breadcrumb-active">Work Experience</span>
      </div>

      <div className="pf-card">
        <div className="pf-card-header">
          <div className="pf-card-header-left">
            <span className="pf-card-icon">💼</span>
            <h3>Work Experience</h3>
          </div>
        </div>

        {showSuccess && (
          <div className="pf-success-banner">
            <span>✅</span>
            <div>
              <strong>Work experience amendment submitted!</strong>
              <p>Changes are pending admin approval.</p>
            </div>
          </div>
        )}

        <div className="pf-empty-state">
          <div className="pf-empty-icon">📋</div>
          <h4>No work experience records added yet</h4>
          <p>Click "Amend" to add your previous work experience details.</p>
        </div>

        <div className="pf-action-bar">
          <button type="button" className="ess-btn ess-btn--primary pf-amend-btn" onClick={handleAmend}>
            ✏️ Amend
          </button>
        </div>
      </div>
    </div>
  );
};
