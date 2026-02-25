import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockAttendance, mockHolidays } from '../utils/mockData';
import type { AttendanceRow } from '../utils/mockData';

const statusColors: Record<string, { bg: string; color: string; label: string }> = {
  P: { bg: '#e6f9ee', color: '#0d8a3e', label: 'Present' },
  A: { bg: '#fce8e6', color: '#c62828', label: 'Absent' },
  WO: { bg: '#e8eaf6', color: '#3949ab', label: 'Week Off' },
  H: { bg: '#fff3e0', color: '#e65100', label: 'Holiday' },
  L: { bg: '#e0f7fa', color: '#00838f', label: 'Leave' },
};

const quickActions = [
  { label: 'Monthly Attendance', icon: '📅', gradient: 'linear-gradient(135deg, #ff9a56 0%, #ff6b35 100%)', route: '' },
  { label: 'Leave Request', icon: '🏖️', gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', route: '' },
  { label: 'Holiday List', icon: '🎉', gradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', route: '' },
  { label: 'Expense Claim', icon: '🧾', gradient: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)', route: '' },
  { label: 'Salary Slip', icon: '💵', gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', route: '/salary-slip' },
  { label: 'Help Desk', icon: '🎧', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', route: '' },
];

const LoadingSkeleton = (): JSX.Element => (
  <div className="ess-skeleton-wrap">
    <div className="ess-skeleton ess-skeleton--lg" />
    <div className="ess-skeleton ess-skeleton--md" />
    <div className="ess-skeleton ess-skeleton--sm" />
  </div>
);

export const DashboardPage = (): JSX.Element => {
  const navigate = useNavigate();
  const [isLoading] = useState(false);
  const [sortField, setSortField] = useState<keyof AttendanceRow>('date');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (field: keyof AttendanceRow): void => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedAttendance = [...mockAttendance].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  });

  const currentTime = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="ess-dash">
      {/* Today's Punch Status */}
      <section className="ess-punch-card">
        <div className="ess-punch-glow" aria-hidden="true" />
        <div className="ess-punch-content">
          <div className="ess-punch-info">
            <span className="ess-punch-badge">LIVE</span>
            <h2>Today's Punch Status</h2>
            <p className="ess-punch-time">
              Last Punch In: <strong>09:10 AM</strong>
            </p>
            <p className="ess-punch-clock">{currentTime}</p>
          </div>
          <div className="ess-punch-actions">
            <button type="button" className="ess-btn ess-btn--primary">
              <span className="ess-btn-pulse" aria-hidden="true" />
              Punch Out
            </button>
            <button type="button" className="ess-btn ess-btn--glass">
              Get Details
            </button>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="ess-section">
        <h3 className="ess-section-title">Quick Actions</h3>
        <div className="ess-quick-grid">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="ess-quick-card"
              onClick={() => action.route && navigate(action.route)}
            >
              <div
                className="ess-quick-icon"
                style={{ background: action.gradient }}
              >
                {action.icon}
              </div>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* My Attendance Table */}
      <section className="ess-section">
        <div className="ess-section-header">
          <h3 className="ess-section-title">My Attendance</h3>
          <span className="ess-section-subtitle">Last 10 days</span>
        </div>
        <div className="ess-table-wrap">
          <table className="ess-table">
            <thead>
              <tr>
                {[
                  { key: 'date', label: 'Date' },
                  { key: 'inTime', label: 'In' },
                  { key: 'outTime', label: 'Out' },
                  { key: 'workingHours', label: 'WHrs.' },
                  { key: 'status', label: 'Status' },
                  { key: 'lateComing', label: 'Late Coming' },
                  { key: 'earlyGoing', label: 'Early Going' },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key as keyof AttendanceRow)}
                    className="ess-th-sortable"
                  >
                    {col.label}
                    {sortField === col.key ? (sortAsc ? ' ↑' : ' ↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedAttendance.map((row) => {
                const st = statusColors[row.status] ?? statusColors.P;
                return (
                  <tr key={row.date}>
                    <td>
                      <span className="ess-date-cell">
                        {row.date}
                        <small>{row.day}</small>
                      </span>
                    </td>
                    <td>{row.inTime}</td>
                    <td>{row.outTime}</td>
                    <td>{row.workingHours}</td>
                    <td>
                      <span
                        className="ess-status-badge"
                        style={{ background: st.bg, color: st.color }}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className={row.lateComing !== '--' ? 'ess-late' : ''}>
                      {row.lateComing}
                    </td>
                    <td className={row.earlyGoing !== '--' ? 'ess-early' : ''}>
                      {row.earlyGoing}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bottom Grid: Benefits + Calendar */}
      <div className="ess-bottom-grid">
        {/* Employee Benefits */}
        <section className="ess-section">
          <h3 className="ess-section-title">Employee Benefits</h3>
          <div className="ess-benefit-grid">
            {[
              { title: 'Tax Filing', desc: 'Assisted e-filing', icon: '🧮', color: '#6366f1' },
              { title: 'Advance Salary', desc: 'Instant disbursal', icon: '⚡', color: '#ec4899' },
              { title: 'Financial Wellness', desc: 'Plan your future', icon: '📈', color: '#10b981' },
            ].map((b) => (
              <div key={b.title} className="ess-benefit-card">
                <div className="ess-benefit-icon" style={{ background: `${b.color}18`, color: b.color }}>
                  {b.icon}
                </div>
                <div>
                  <strong>{b.title}</strong>
                  <small>{b.desc}</small>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Upcoming Holidays */}
        <section className="ess-section">
          <h3 className="ess-section-title">Upcoming Holidays</h3>
          <div className="ess-holiday-list">
            {mockHolidays.slice(0, 4).map((h) => (
              <div key={h.date} className="ess-holiday-item">
                <div className="ess-holiday-date">{h.date.slice(0, 6)}</div>
                <span>{h.name}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
