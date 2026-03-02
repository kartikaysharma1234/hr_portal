interface PlaceholderProps {
  title: string;
  icon: string;
}

const ProfilePlaceholder = ({ title, icon }: PlaceholderProps): JSX.Element => (
  <div className="profile-page">
    <div className="ess-breadcrumb">
      <span>My Profile</span>
      <span className="ess-breadcrumb-sep">›</span>
      <span className="ess-breadcrumb-active">{title}</span>
    </div>

    <div className="pf-card">
      <div className="pf-card-header">
        <div className="pf-card-header-left">
          <span className="pf-card-icon">{icon}</span>
          <h3>{title}</h3>
        </div>
      </div>

      <div className="pf-empty-state">
        <div className="pf-empty-icon">{icon}</div>
        <h4>No {title.toLowerCase()} records added yet</h4>
        <p>Click "Amend" to add your {title.toLowerCase()} details.</p>
      </div>

      <div className="pf-action-bar">
        <button type="button" className="ess-btn ess-btn--primary pf-amend-btn">
          ✏️ Amend
        </button>
      </div>
    </div>
  </div>
);

export const ProfileSkillPage = (): JSX.Element => (
  <ProfilePlaceholder title="Skill & Additional Info" icon="🎯" />
);

export const ProfileQualificationPage = (): JSX.Element => (
  <ProfilePlaceholder title="Qualification" icon="🎓" />
);

export const ProfilePhotoPage = (): JSX.Element => (
  <ProfilePlaceholder title="Photo" icon="📷" />
);

export const ProfileDocumentsPage = (): JSX.Element => (
  <ProfilePlaceholder title="Documents" icon="📁" />
);

export const ProfileBankPage = (): JSX.Element => (
  <ProfilePlaceholder title="Bank Account Details" icon="🏦" />
);
