import { useState } from 'react';

import { attendanceApi } from '../api/attendanceApi';
import { AttendanceMapView } from '../components/attendance/AttendanceMapView';
import { AttendanceSettingsPanel } from '../components/attendance/AttendanceSettingsPanel';
import { AttendanceTable } from '../components/attendance/AttendanceTable';
import { PunchButton } from '../components/attendance/PunchButton';
import { RealtimeAttendanceDashboard } from '../components/attendance/RealtimeAttendanceDashboard';
import { useAuth } from '../context/AuthContext';
import type { AttendanceDailyDetail } from '../types/attendance';

export const AttendanceWorkspacePage = (): JSX.Element => {
  const { user, logout } = useAuth();

  const [selectedDetail, setSelectedDetail] = useState<AttendanceDailyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const loadDailyDetail = async (date: string): Promise<void> => {
    setDetailLoading(true);
    setDetailError('');

    try {
      const detail = await attendanceApi.getDailyDetail(date);
      setSelectedDetail(detail);
    } catch (caught) {
      setDetailError(caught instanceof Error ? caught.message : 'Failed to load daily details');
    } finally {
      setDetailLoading(false);
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'manager';

  return (
    <main className="attendance-workspace-shell">
      <header className="attendance-workspace-topbar">
        <div>
          <p className="attendance-kicker">Attendance Workspace</p>
          <h1>Smart Punch & Monitoring</h1>
          <span>
            Signed in as {user?.name} ({user?.role})
          </span>
        </div>

        <button type="button" onClick={logout}>
          Logout
        </button>
      </header>

      <section className="attendance-punch-grid">
        <PunchButton type="IN" selfieRequired />
        <PunchButton type="OUT" selfieRequired />
      </section>

      <AttendanceTable onSelectDate={(date) => void loadDailyDetail(date)} />

      {detailLoading ? <p className="attendance-muted">Loading selected day details...</p> : null}
      {detailError ? <p className="attendance-error">{detailError}</p> : null}
      <AttendanceMapView detail={selectedDetail} />

      {isAdmin ? <RealtimeAttendanceDashboard /> : null}
      {isAdmin ? <AttendanceSettingsPanel /> : null}
    </main>
  );
};
