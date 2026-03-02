import { mockEmployee, mockEmployeeProfile } from '../utils/mockData';

const profileRows: { label: string; value: string }[] = [
  { label: 'Working For', value: mockEmployeeProfile.workingFor },
  { label: 'Work Location', value: mockEmployeeProfile.workLocation },
  { label: 'Department', value: mockEmployeeProfile.department },
  { label: 'Designation', value: mockEmployeeProfile.designation },
  { label: 'Grade', value: mockEmployeeProfile.grade },
  { label: 'Weekly Off', value: mockEmployeeProfile.weeklyOff },
  { label: 'Second WeeklyOff', value: mockEmployeeProfile.secondWeeklyOff },
  { label: 'Weekly Off Week wise', value: mockEmployeeProfile.weeklyOffWeekWise },
  { label: 'Shift', value: mockEmployeeProfile.shift },
  { label: 'EType', value: mockEmployeeProfile.eType },
  {
    label: 'Date of Joining',
    value: `${mockEmployeeProfile.dateOfJoining}  |  Group Ecode - ${mockEmployeeProfile.groupEcode}  |  Group DOJ - ${mockEmployeeProfile.groupDOJ}  |  Tenure - ${mockEmployeeProfile.tenure}`,
  },
  { label: 'Office Email', value: mockEmployeeProfile.officeEmail },
  { label: 'Confirmation Due Date', value: mockEmployeeProfile.confirmationDueDate },
  { label: 'Confirmation Date', value: mockEmployeeProfile.confirmationDate },
  { label: 'Reporting To', value: mockEmployeeProfile.reportingTo },
  { label: 'Finance Mgr.', value: mockEmployeeProfile.financeMgr },
  { label: 'Notice Period', value: mockEmployeeProfile.noticePeriod },
  { label: 'Cost Center', value: mockEmployeeProfile.costCenter || '—' },
];

export const EmployeeProfilePage = (): JSX.Element => {
  return (
    <div className="profile-page">
      {/* Breadcrumb */}
      <div className="ess-breadcrumb">
        <span>My Profile</span>
        <span className="ess-breadcrumb-sep">›</span>
        <span className="ess-breadcrumb-active">Company</span>
      </div>

      {/* Profile Header Card */}
      <div className="profile-header-card">
        <div className="profile-header-glow" aria-hidden="true" />
        <div className="profile-header-content">
          <div className="profile-avatar-lg">
            {mockEmployee.name.charAt(0).toUpperCase()}
          </div>
          <div className="profile-header-info">
            <h2>{mockEmployee.name}</h2>
            <p>{mockEmployee.designation} • {mockEmployee.department}</p>
            <div className="profile-badges">
              <span className="profile-badge profile-badge--code">{mockEmployee.code}</span>
              <span className="profile-badge profile-badge--type">{mockEmployeeProfile.eType}</span>
              <span className="profile-badge profile-badge--grade">{mockEmployeeProfile.grade}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Company Details Table */}
      <div className="profile-details-card">
        <div className="profile-details-header">
          <span className="profile-details-icon">🏢</span>
          <h3>Company Details</h3>
        </div>
        <div className="profile-table-wrap">
          <table className="profile-table">
            <tbody>
              {profileRows.map((row) => (
                <tr key={row.label}>
                  <td className="profile-label">{row.label}</td>
                  <td className="profile-value">
                    {row.label === 'Office Email' ? (
                      <a href={`mailto:${row.value}`} className="profile-email-link">{row.value}</a>
                    ) : row.label === 'Reporting To' || row.label === 'Finance Mgr.' ? (
                      <span className="profile-person-link">{row.value}</span>
                    ) : (
                      row.value
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
