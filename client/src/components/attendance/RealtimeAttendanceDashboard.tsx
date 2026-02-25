import { useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { attendanceApi } from '../../api/attendanceApi';
import { useAuth } from '../../context/AuthContext';
import type { AttendanceRealtimeSnapshot } from '../../types/attendance';

const resolveSocketBaseUrl = (): string => {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api';
  return apiBase.replace(/\/api\/?$/, '');
};

const fullName = (employee: { firstName?: string; lastName?: string } | undefined): string => {
  return `${employee?.firstName ?? ''} ${employee?.lastName ?? ''}`.trim() || 'Unknown';
};

export const RealtimeAttendanceDashboard = (): JSX.Element => {
  const { tokens } = useAuth();

  const [snapshot, setSnapshot] = useState<AttendanceRealtimeSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const socketBaseUrl = useMemo(() => resolveSocketBaseUrl(), []);

  const loadSnapshot = async (): Promise<void> => {
    setIsLoading(true);
    setError('');

    try {
      const data = await attendanceApi.getRealtimeSnapshot();
      setSnapshot(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load realtime snapshot');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSnapshot();

    const interval = window.setInterval(() => {
      void loadSnapshot();
    }, 30_000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!tokens?.accessToken) {
      return;
    }

    let socket: Socket | null = null;

    try {
      socket = io(socketBaseUrl, {
        transports: ['websocket'],
        auth: {
          token: tokens.accessToken
        }
      });

      socket.on('attendance:live-punch', (event) => {
        setSnapshot((previous) => {
          if (!previous) {
            return previous;
          }

          const nextFeed = [
            {
              id: event.punchId ?? `${event.employeeId}-${event.punchTime}`,
              employee: {
                _id: event.employeeId,
                firstName: event.employeeName,
                lastName: '',
                department: ''
              },
              punchType: event.punchType,
              punchTime: event.punchTime,
              status: event.validationStatus,
              colorHex: event.colorHex,
              location: {
                latitude: event.location.latitude,
                longitude: event.location.longitude,
                distance: event.location.distanceMeters
              }
            },
            ...previous.liveFeed
          ].slice(0, 30);

          return {
            ...previous,
            liveFeed: nextFeed,
            generatedAt: new Date().toISOString()
          };
        });
      });

      socket.on('attendance:occupancy', (event) => {
        setSnapshot((previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            currentOccupancy: event.currentOccupancy,
            generatedAt: event.generatedAt
          };
        });
      });

      socket.on('attendance:invalid-alert', (event) => {
        setSnapshot((previous) => {
          if (!previous) {
            return previous;
          }

          const invalidAlerts = [
            {
              id: event.punchId ?? `${event.employeeId}-${event.punchTime}`,
              employee: {
                _id: event.employeeId,
                firstName: event.employeeName,
                lastName: '',
                department: ''
              },
              punchTime: event.punchTime,
              reasons: [{ code: 'INVALID', message: 'Invalid punch detected', severity: 'invalid' as const }],
              colorHex: event.colorHex
            },
            ...previous.invalidAlerts
          ].slice(0, 20);

          return {
            ...previous,
            invalidAlerts,
            generatedAt: new Date().toISOString()
          };
        });
      });
    } catch {
      setError('Failed to open realtime socket. Showing auto-refresh data only.');
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socketBaseUrl, tokens?.accessToken]);

  return (
    <section className="attendance-realtime-card">
      <header>
        <h3>Realtime Monitoring</h3>
        <p>Auto-refreshes every 30 seconds with WebSocket live events.</p>
      </header>

      {isLoading ? <p className="attendance-muted">Refreshing...</p> : null}
      {error ? <p className="attendance-error">{error}</p> : null}

      <div className="attendance-realtime-metrics">
        <article>
          <h4>Current Occupancy</h4>
          <strong>{snapshot?.currentOccupancy ?? 0}</strong>
        </article>
        <article>
          <h4>Invalid Alerts</h4>
          <strong>{snapshot?.invalidAlerts.length ?? 0}</strong>
        </article>
        <article>
          <h4>Late Arrivals</h4>
          <strong>{snapshot?.lateArrivals.length ?? 0}</strong>
        </article>
        <article>
          <h4>Absentees</h4>
          <strong>{snapshot?.absenteeList.length ?? 0}</strong>
        </article>
      </div>

      <div className="attendance-realtime-grid">
        <article>
          <h4>Live Punch Feed</h4>
          <div className="attendance-realtime-scroll">
            {(snapshot?.liveFeed ?? []).map((row) => (
              <div key={row.id} className="attendance-live-row" style={{ borderLeftColor: row.colorHex }}>
                <div>
                  <strong>{fullName(row.employee)}</strong>
                  <p>{new Date(row.punchTime).toLocaleString()}</p>
                </div>
                <span>{row.punchType}</span>
              </div>
            ))}
          </div>
        </article>

        <article>
          <h4>Invalid Alerts</h4>
          <div className="attendance-realtime-scroll">
            {(snapshot?.invalidAlerts ?? []).map((row) => (
              <div key={row.id} className="attendance-alert-row" style={{ borderLeftColor: row.colorHex }}>
                <strong>{fullName(row.employee)}</strong>
                <p>{row.reasons[0]?.message ?? 'Invalid punch'}</p>
              </div>
            ))}
          </div>
        </article>

        <article>
          <h4>Late Arrivals</h4>
          <div className="attendance-realtime-scroll">
            {(snapshot?.lateArrivals ?? []).map((row) => (
              <div key={row.id} className="attendance-live-row">
                <div>
                  <strong>{fullName(row.employee)}</strong>
                  <p>{new Date(row.punchTime).toLocaleTimeString()}</p>
                </div>
                <span>{row.lateMinutes}m late</span>
              </div>
            ))}
          </div>
        </article>

        <article>
          <h4>Absentees</h4>
          <div className="attendance-realtime-scroll">
            {(snapshot?.absenteeList ?? []).map((row) => (
              <div key={row.employeeId} className="attendance-live-row">
                <div>
                  <strong>{row.name}</strong>
                  <p>{row.department}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
};
