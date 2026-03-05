import { apiClient } from './http';
import type {
  AttendanceDailyDetail,
  AttendanceHistoryRow,
  AttendanceLedgerEmployee,
  AttendanceLeaveLedger,
  AttendanceLocationPayload,
  AttendanceProfileContext,
  AttendanceRealtimeSnapshot,
  AttendanceSettingsRecord,
  LeaveTypeCode
} from '../types/attendance';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PunchPayload {
  timestamp?: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  source: 'mobile_app' | 'web' | 'biometric' | 'csv_import' | 'api_sync';
  device: {
    deviceId: string;
    macAddress?: string;
    ipAddress?: string;
    userAgent?: string;
    platform?: string;
    appVersion?: string;
    isRooted?: boolean;
    isJailBroken?: boolean;
    fingerprint?: string;
  };
  photo?: {
    url: string;
    mimeType: string;
    sizeBytes: number;
  };
}

export const attendanceApi = {
  async punchIn(payload: PunchPayload): Promise<{
    punchId: string;
    status: string;
    colorHex: string;
    reasons: Array<{ code: string; message: string }>;
    workingHours?: string;
  }> {
    const response = await apiClient.post<ApiEnvelope<any>>('/v1/attendance/punch-in', {
      ...payload,
      punchType: 'IN'
    });
    return response.data.data;
  },

  async punchOut(payload: PunchPayload): Promise<{
    punchId: string;
    status: string;
    colorHex: string;
    reasons: Array<{ code: string; message: string }>;
    workingHours?: string;
  }> {
    const response = await apiClient.post<ApiEnvelope<any>>('/v1/attendance/punch-out', {
      ...payload,
      punchType: 'OUT'
    });
    return response.data.data;
  },

  async getMyAttendance(params: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    view?: 'daily' | 'monthly';
  }): Promise<{
    view: 'daily' | 'monthly';
    rows: AttendanceHistoryRow[];
    total?: number;
    page?: number;
    limit?: number;
  }> {
    const response = await apiClient.get<ApiEnvelope<any>>('/v1/attendance/my-attendance', {
      params
    });

    return response.data.data;
  },

  async getDailyDetail(date: string): Promise<AttendanceDailyDetail> {
    const response = await apiClient.get<ApiEnvelope<AttendanceDailyDetail>>(
      `/v1/attendance/daily/${date}`
    );
    return response.data.data;
  },

  async getMyContext(): Promise<AttendanceProfileContext> {
    const response = await apiClient.get<ApiEnvelope<AttendanceProfileContext>>(
      '/v1/attendance/my-context'
    );
    return response.data.data;
  },

  async getLeaveLedger(params: {
    year: number;
    leaveType: LeaveTypeCode;
    employeeId?: string;
  }): Promise<AttendanceLeaveLedger> {
    const response = await apiClient.get<ApiEnvelope<AttendanceLeaveLedger>>(
      '/v1/attendance/leave-ledger',
      { params }
    );
    return response.data.data;
  },

  async listLeaveLedgerEmployees(params?: {
    search?: string;
    limit?: number;
  }): Promise<AttendanceLedgerEmployee[]> {
    const response = await apiClient.get<ApiEnvelope<AttendanceLedgerEmployee[]>>(
      '/v1/attendance/leave-ledger/employees',
      { params }
    );
    return response.data.data;
  },

  async updateLeaveLedger(payload: {
    employeeId: string;
    leaveType: LeaveTypeCode;
    year: number;
    openingBalance?: number;
    openingBalanceDate?: string;
    monthly?: Array<{
      month: number;
      days?: number;
      credit?: number;
      availed?: number;
      availedDates?: string[];
    }>;
  }): Promise<AttendanceLeaveLedger> {
    const response = await apiClient.put<ApiEnvelope<AttendanceLeaveLedger>>(
      '/v1/attendance/leave-ledger',
      payload
    );
    return response.data.data;
  },

  async getSettings(): Promise<AttendanceSettingsRecord[]> {
    const response = await apiClient.get<ApiEnvelope<AttendanceSettingsRecord[]>>(
      '/v1/attendance/settings'
    );
    return response.data.data;
  },

  async createSettings(payload: Partial<AttendanceSettingsRecord>): Promise<AttendanceSettingsRecord> {
    const response = await apiClient.post<ApiEnvelope<AttendanceSettingsRecord>>(
      '/v1/attendance/settings',
      payload
    );

    return response.data.data;
  },

  async updateSettings(
    id: string,
    payload: Partial<AttendanceSettingsRecord>
  ): Promise<AttendanceSettingsRecord> {
    const response = await apiClient.put<ApiEnvelope<AttendanceSettingsRecord>>(
      `/v1/attendance/settings/${id}`,
      payload
    );

    return response.data.data;
  },

  async deleteSettings(id: string): Promise<void> {
    await apiClient.delete(`/v1/attendance/settings/${id}`);
  },

  async getOfficeLocations(): Promise<any[]> {
    const response = await apiClient.get<ApiEnvelope<any[]>>('/v1/attendance/office-locations');
    return response.data.data;
  },

  async createOfficeLocation(payload: AttendanceLocationPayload): Promise<any> {
    const response = await apiClient.post<ApiEnvelope<any>>('/v1/attendance/office-locations', payload);
    return response.data.data;
  },

  async updateOfficeLocation(id: string, payload: Partial<AttendanceLocationPayload>): Promise<any> {
    const response = await apiClient.put<ApiEnvelope<any>>(
      `/v1/attendance/office-locations/${id}`,
      payload
    );
    return response.data.data;
  },

  async deleteOfficeLocation(id: string): Promise<void> {
    await apiClient.delete(`/v1/attendance/office-locations/${id}`);
  },

  async getPendingApprovals(): Promise<any[]> {
    const response = await apiClient.get<ApiEnvelope<any[]>>('/v1/attendance/pending-approvals');
    return response.data.data;
  },

  async approvePunch(punchId: string, comment = ''): Promise<void> {
    await apiClient.post(`/v1/attendance/approve/${punchId}`, { comment });
  },

  async rejectPunch(punchId: string, comment = ''): Promise<void> {
    await apiClient.post(`/v1/attendance/reject/${punchId}`, { comment });
  },

  async bulkApprovePunches(params: {
    action: 'approve' | 'reject';
    punchIds: string[];
    comment?: string;
  }): Promise<{ requested: number; updated: number }> {
    const response = await apiClient.post<ApiEnvelope<{ requested: number; updated: number }>>(
      '/v1/attendance/approve/bulk',
      params
    );
    return response.data.data;
  },

  async createRegularization(payload: {
    targetDate: string;
    reason: string;
    requestType?: 'missed_punch' | 'invalid_punch' | 'manual_correction';
    relatedPunchId?: string;
    requestedPunchType?: 'IN' | 'OUT';
    requestedPunchTime?: string;
    supportingDocuments?: string[];
  }): Promise<any> {
    const response = await apiClient.post<ApiEnvelope<any>>('/v1/attendance/regularize', payload);
    return response.data.data;
  },

  async getRegularizationRequests(status?: string): Promise<any[]> {
    const response = await apiClient.get<ApiEnvelope<any[]>>(
      '/v1/attendance/regularization-requests',
      {
        params: status ? { status } : undefined
      }
    );
    return response.data.data;
  },

  async approveRegularization(id: string, comment = ''): Promise<void> {
    await apiClient.post(`/v1/attendance/regularization/approve/${id}`, { comment });
  },

  async rejectRegularization(id: string, comment = ''): Promise<void> {
    await apiClient.post(`/v1/attendance/regularization/reject/${id}`, { comment });
  },

  async getRealtimeSnapshot(): Promise<AttendanceRealtimeSnapshot> {
    const response = await apiClient.get<ApiEnvelope<AttendanceRealtimeSnapshot>>(
      '/v1/attendance/monitoring/realtime'
    );
    return response.data.data;
  },

  async downloadReport(params: {
    reportType:
      | 'daily'
      | 'monthly'
      | 'invalid'
      | 'department'
      | 'late-trend'
      | 'distance'
      | 'source-analysis';
    format: 'csv' | 'excel' | 'pdf';
    date?: string;
    month?: number;
    year?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<Blob> {
    const response = await apiClient.get('/v1/attendance/reports/export', {
      params,
      responseType: 'blob'
    });

    return response.data as Blob;
  },

  async importCsv(csv: string, cutoffTime?: string): Promise<any> {
    const response = await apiClient.post<ApiEnvelope<any>>('/v1/attendance/import/csv', {
      csv,
      cutoffTime
    });
    return response.data.data;
  },

  async importBiometric(rows: unknown[], cutoffTime?: string): Promise<any> {
    const response = await apiClient.post<ApiEnvelope<any>>('/v1/attendance/import/biometric', {
      rows,
      cutoffTime
    });
    return response.data.data;
  }
};
