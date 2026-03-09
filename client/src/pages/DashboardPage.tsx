import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { attendanceApi } from '../api/attendanceApi';
import { getApiErrorMessage } from '../utils/apiError';
import { mockAttendance, mockHolidays } from '../utils/mockData';
import type { AttendanceRow } from '../utils/mockData';

const statusColors: Record<string, { bg: string; color: string; label: string }> = {
  P: { bg: '#e6f9ee', color: '#0d8a3e', label: 'Present' },
  A: { bg: '#fce8e6', color: '#c62828', label: 'Absent' },
  WO: { bg: '#e8eaf6', color: '#3949ab', label: 'Week Off' },
  H: { bg: '#fff3e0', color: '#e65100', label: 'Holiday' },
  L: { bg: '#e0f7fa', color: '#00838f', label: 'Leave' }
};

const quickActions = [
  {
    label: 'Monthly Attendance',
    icon: 'MA',
    gradient: 'linear-gradient(135deg, #ff9a56 0%, #ff6b35 100%)',
    route: '/attendance/monthly'
  },
  {
    label: 'Leave Request',
    icon: 'LR',
    gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
    route: ''
  },
  {
    label: 'Holiday List',
    icon: 'HL',
    gradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
    route: ''
  },
  {
    label: 'Expense Claim',
    icon: 'EC',
    gradient: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
    route: ''
  },
  {
    label: 'Salary Slip',
    icon: 'SS',
    gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    route: '/salary-slip'
  },
  {
    label: 'Help Desk',
    icon: 'HD',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    route: ''
  }
];

type PunchType = 'IN' | 'OUT';

interface DashboardPunch {
  punchType: PunchType;
  time: string;
}

const LoadingSkeleton = (): JSX.Element => (
  <div className="ess-skeleton-wrap">
    <div className="ess-skeleton ess-skeleton--lg" />
    <div className="ess-skeleton ess-skeleton--md" />
    <div className="ess-skeleton ess-skeleton--sm" />
  </div>
);

const getCurrentLocation = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });
  });
};

const buildDeviceInfo = (): {
  deviceId: string;
  userAgent: string;
  platform: string;
} => {
  const cachedKey = 'hrms.device-id';
  let deviceId = localStorage.getItem(cachedKey);
  if (!deviceId) {
    const random = Math.random().toString(36).slice(2);
    deviceId = `web-${Date.now()}-${random}`;
    localStorage.setItem(cachedKey, deviceId);
  }

  return {
    deviceId,
    userAgent: navigator.userAgent,
    platform: navigator.platform
  };
};

const getTodayIsoDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatPunchTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '--';
  }

  return parsed.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

export const DashboardPage = (): JSX.Element => {
  const navigate = useNavigate();
  const [isLoading] = useState(false);
  const [sortField, setSortField] = useState<keyof AttendanceRow>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [lastPunch, setLastPunch] = useState<DashboardPunch | null>(null);
  const [punchWindowHint, setPunchWindowHint] = useState('');
  const [punchLoading, setPunchLoading] = useState(false);
  const [punchRefreshing, setPunchRefreshing] = useState(false);
  const [punchSuccess, setPunchSuccess] = useState('');
  const [punchError, setPunchError] = useState('');

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
    hour12: true
  });

  const nextPunchType: PunchType = useMemo(() => {
    if (!lastPunch) {
      return 'IN';
    }

    return lastPunch.punchType === 'IN' ? 'OUT' : 'IN';
  }, [lastPunch]);

  const loadPunchCard = async (): Promise<void> => {
    setPunchRefreshing(true);

    try {
      const [dailyDetail, context] = await Promise.all([
        attendanceApi.getDailyDetail(getTodayIsoDate()),
        attendanceApi.getMyContext()
      ]);

      const latestPunch = dailyDetail.punches
        .slice()
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
        .slice(-1)[0];

      if (latestPunch) {
        setLastPunch({
          punchType: latestPunch.punchType,
          time: latestPunch.time
        });
      } else {
        setLastPunch(null);
      }

      setPunchWindowHint(
        `IN ${context.punchWindow.punchInStartTime}-${context.punchWindow.punchInEndTime} | OUT ${context.punchWindow.punchOutStartTime}-${context.punchWindow.punchOutEndTime} (${context.punchWindow.timezone})`
      );
      setPunchError('');
    } catch (caught) {
      setPunchError(getApiErrorMessage(caught, 'Unable to load punch status'));
      setLastPunch(null);
    } finally {
      setPunchRefreshing(false);
    }
  };

  useEffect(() => {
    void loadPunchCard();

    const timer = window.setInterval(() => {
      void loadPunchCard();
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  const handlePunchAction = async (): Promise<void> => {
    setPunchLoading(true);
    setPunchSuccess('');
    setPunchError('');

    try {
      const geo = await getCurrentLocation();
      const payload = {
        timestamp: new Date().toISOString(),
        latitude: geo.coords.latitude,
        longitude: geo.coords.longitude,
        accuracy: geo.coords.accuracy,
        source: 'web' as const,
        device: {
          ...buildDeviceInfo(),
          ipAddress: '',
          appVersion: 'web-dashboard-1.0.0'
        }
      };

      const response =
        nextPunchType === 'IN'
          ? await attendanceApi.punchIn(payload)
          : await attendanceApi.punchOut(payload);

      setPunchSuccess(
        `${nextPunchType === 'IN' ? 'Punch In' : 'Punch Out'} successful (${response.status.toUpperCase()})`
      );
      await loadPunchCard();
    } catch (caught) {
      setPunchError(getApiErrorMessage(caught, 'Failed to submit punch'));
    } finally {
      setPunchLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="ess-dash">
      <section className="ess-punch-card">
        <div className="ess-punch-glow" aria-hidden="true" />
        <div className="ess-punch-content">
          <div className="ess-punch-info">
            <span className="ess-punch-badge">LIVE</span>
            <h2>Today's Punch Status</h2>
            {lastPunch ? (
              <p className="ess-punch-time">
                {lastPunch.punchType === 'IN' ? 'Last Punch In' : 'Last Punch Out'}:{' '}
                <strong>{formatPunchTime(lastPunch.time)}</strong>
              </p>
            ) : (
              <p className="ess-punch-time">No punch recorded today</p>
            )}
            <p className="ess-punch-clock">{currentTime}</p>
            {punchWindowHint ? <p className="ess-punch-window">{punchWindowHint}</p> : null}
            {punchSuccess ? <p className="ess-punch-feedback ess-punch-feedback--ok">{punchSuccess}</p> : null}
            {punchError ? <p className="ess-punch-feedback ess-punch-feedback--error">{punchError}</p> : null}
          </div>
          <div className="ess-punch-actions">
            <button
              type="button"
              className="ess-btn ess-btn--primary"
              onClick={() => void handlePunchAction()}
              disabled={punchLoading || punchRefreshing}
            >
              <span className="ess-btn-pulse" aria-hidden="true" />
              {punchLoading ? 'Processing...' : nextPunchType === 'IN' ? 'Punch In' : 'Punch Out'}
            </button>
            <button
              type="button"
              className="ess-btn ess-btn--glass"
              onClick={() => navigate('/attendance/daily')}
            >
              Get Details
            </button>
          </div>
        </div>
      </section>

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
              <div className="ess-quick-icon" style={{ background: action.gradient }}>
                {action.icon}
              </div>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </section>

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
                  { key: 'earlyGoing', label: 'Early Going' }
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key as keyof AttendanceRow)}
                    className="ess-th-sortable"
                  >
                    {col.label}
                    {sortField === col.key ? (sortAsc ? ' ^' : ' v') : ''}
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
                      <span className="ess-status-badge" style={{ background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </td>
                    <td className={row.lateComing !== '--' ? 'ess-late' : ''}>{row.lateComing}</td>
                    <td className={row.earlyGoing !== '--' ? 'ess-early' : ''}>{row.earlyGoing}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="ess-bottom-grid">
        <section className="ess-section">
          <h3 className="ess-section-title">Employee Benefits</h3>
          <div className="ess-benefit-grid">
            {[
              { title: 'Tax Filing', desc: 'Assisted e-filing', icon: 'TX', color: '#6366f1' },
              { title: 'Advance Salary', desc: 'Instant disbursal', icon: 'AD', color: '#ec4899' },
              { title: 'Financial Wellness', desc: 'Plan your future', icon: 'FW', color: '#10b981' }
            ].map((benefit) => (
              <div key={benefit.title} className="ess-benefit-card">
                <div
                  className="ess-benefit-icon"
                  style={{ background: `${benefit.color}18`, color: benefit.color }}
                >
                  {benefit.icon}
                </div>
                <div>
                  <strong>{benefit.title}</strong>
                  <small>{benefit.desc}</small>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="ess-section">
          <h3 className="ess-section-title">Upcoming Holidays</h3>
          <div className="ess-holiday-list">
            {mockHolidays.slice(0, 4).map((holiday) => (
              <div key={holiday.date} className="ess-holiday-item">
                <div className="ess-holiday-date">{holiday.date.slice(0, 6)}</div>
                <span>{holiday.name}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
