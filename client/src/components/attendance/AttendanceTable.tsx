import { useEffect, useMemo, useState } from 'react';

import { attendanceApi } from '../../api/attendanceApi';
import type { AttendanceHistoryRow } from '../../types/attendance';

interface AttendanceTableProps {
  onSelectDate?: (date: string) => void;
}

const toInputDate = (date: Date): string => {
  return date.toISOString().slice(0, 10);
};

const formatTime = (value: string | null): string => {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const AttendanceTable = ({ onSelectDate }: AttendanceTableProps): JSX.Element => {
  const [rows, setRows] = useState<AttendanceHistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const today = new Date();
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [startDate, setStartDate] = useState<string>(toInputDate(defaultStart));
  const [endDate, setEndDate] = useState<string>(toInputDate(today));
  const [view, setView] = useState<'daily' | 'monthly'>('daily');

  const loadRows = async (): Promise<void> => {
    setIsLoading(true);
    setError('');

    try {
      const result = await attendanceApi.getMyAttendance({
        startDate,
        endDate,
        limit: 31,
        page: 1,
        view
      });

      setRows((result.rows ?? []) as AttendanceHistoryRow[]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to load attendance history';
      setError(message);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, view]);

  const totals = useMemo(() => {
    let present = 0;
    let invalid = 0;
    let warning = 0;

    for (const row of rows) {
      if (row.status === 'present') {
        present += 1;
      } else if (row.status === 'invalid' || row.status === 'pending_approval') {
        invalid += 1;
      } else if (row.status === 'warning') {
        warning += 1;
      }
    }

    return { present, invalid, warning };
  }, [rows]);

  const handleExport = async (format: 'csv' | 'excel' | 'pdf'): Promise<void> => {
    try {
      const blob = await attendanceApi.downloadReport({
        reportType: 'daily',
        format,
        startDate,
        endDate
      });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `attendance-${startDate}-to-${endDate}.${format === 'excel' ? 'xlsx' : format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export report');
    }
  };

  return (
    <section className="attendance-table-card">
      <header className="attendance-table-topbar">
        <div>
          <h3>Attendance History</h3>
          <p>
            Present: {totals.present} | Invalid: {totals.invalid} | Warning: {totals.warning}
          </p>
        </div>

        <div className="attendance-filter-row">
          <label>
            Start
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>

          <label>
            End
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>

          <label>
            View
            <select value={view} onChange={(event) => setView(event.target.value as 'daily' | 'monthly')}>
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>

          <div className="attendance-export-row">
            <button type="button" onClick={() => void handleExport('csv')}>
              CSV
            </button>
            <button type="button" onClick={() => void handleExport('excel')}>
              Excel
            </button>
            <button type="button" onClick={() => void handleExport('pdf')}>
              PDF
            </button>
          </div>
        </div>
      </header>

      {isLoading ? <p className="attendance-muted">Loading attendance...</p> : null}
      {error ? <p className="attendance-error">{error}</p> : null}

      <div className="attendance-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>In</th>
              <th>Out</th>
              <th>Working</th>
              <th>Status</th>
              <th>Distance</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date} onClick={() => onSelectDate?.(row.date)}>
                <td>{row.date}</td>
                <td>{formatTime(row.inTime)}</td>
                <td>{formatTime(row.outTime)}</td>
                <td>{row.workingHoursText}</td>
                <td>
                  <span className="attendance-status-pill" style={{ backgroundColor: row.colorHex }}>
                    {row.status}
                  </span>
                </td>
                <td>
                  {row.distanceFromOfficeMeters !== null
                    ? `${Math.round(row.distanceFromOfficeMeters)}m`
                    : '--'}
                </td>
                <td>{row.validationReasons[0]?.message ?? '--'}</td>
              </tr>
            ))}

            {!rows.length && !isLoading ? (
              <tr>
                <td colSpan={7} className="attendance-empty-cell">
                  No attendance data in selected date range.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
};
