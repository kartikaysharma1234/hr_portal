export type AttendanceValidationStatus = 'valid' | 'invalid' | 'pending_approval' | 'warning';

export interface AttendanceValidationReason {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'invalid';
}

export interface AttendancePunchRow {
  id: string;
  punchDate: string;
  punchTime: string;
  punchType: 'IN' | 'OUT';
  validationStatus: AttendanceValidationStatus;
  colorHex: string;
  colorClass: string;
  distanceFromOfficeMeters: number | null;
  reasons: AttendanceValidationReason[];
  workingHours?: string;
}

export interface AttendanceHistoryRow {
  date: string;
  inTime: string | null;
  outTime: string | null;
  workingMinutes: number;
  workingHoursText: string;
  status: string;
  colorHex: string;
  colorClass: string;
  distanceFromOfficeMeters: number | null;
  validationReasons: AttendanceValidationReason[];
}

export interface AttendanceDailyDetail {
  date: string;
  timezone: string;
  punches: Array<{
    id: string;
    time: string;
    punchType: 'IN' | 'OUT';
    photoUrl: string;
    location: {
      latitude: number;
      longitude: number;
      accuracy: number;
    };
    companyLocation: {
      id: string;
      name: string;
      latitude: number;
      longitude: number;
    } | null;
    distanceFromOfficeMeters: number | null;
    source: string;
    macAddress: string;
    notes: string[];
    validationStatus: AttendanceValidationStatus;
    colorHex: string;
  }>;
  mapView: {
    officeLocations: Array<{
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      radiusMeters: number;
    }>;
    punchPoints: Array<{
      id: string;
      punchType: 'IN' | 'OUT';
      latitude: number;
      longitude: number;
      distanceMeters: number | null;
      colorHex: string;
    }>;
  };
}

export interface AttendanceRealtimeSnapshot {
  generatedAt: string;
  currentOccupancy: number;
  liveFeed: Array<{
    id: string;
    employee: {
      _id: string;
      firstName: string;
      lastName: string;
      department: string;
    };
    punchType: 'IN' | 'OUT';
    punchTime: string;
    status: AttendanceValidationStatus;
    colorHex: string;
    location: {
      latitude: number;
      longitude: number;
      distance: number | null;
    };
  }>;
  invalidAlerts: Array<{
    id: string;
    employee: {
      _id: string;
      firstName: string;
      lastName: string;
      department: string;
    };
    punchTime: string;
    reasons: AttendanceValidationReason[];
    colorHex: string;
  }>;
  lateArrivals: Array<{
    id: string;
    employee: {
      _id: string;
      firstName: string;
      lastName: string;
      department: string;
    };
    punchTime: string;
    lateMinutes: number;
  }>;
  absenteeList: Array<{
    employeeId: string;
    name: string;
    department: string;
  }>;
}

export interface AttendanceLocationPayload {
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  departmentRestrictions?: string[];
  shiftRestrictions?: string[];
  isPrimary?: boolean;
  isActive?: boolean;
}

export interface AttendanceSettingsRecord {
  _id: string;
  scopeType: 'company' | 'department' | 'shift';
  scopeRef: string;
  geofencing: {
    enabled: boolean;
    geofenceMode: 'strict' | 'flexible' | 'warning_only';
    defaultRadiusMeters: number;
    maxAllowedDistanceMeters: number;
    maxGpsAccuracyMeters: number;
  };
  timingRules: {
    timezone: string;
    shiftStartTime: string;
    shiftEndTime: string;
    graceInMinutes: number;
    graceOutMinutes: number;
    minMinutesBetweenPunches: number;
  };
  punchRules: {
    maxPunchesPerDay: number;
    minTimeBetweenPunchesMinutes: number;
    preventSequentialSamePunchType: boolean;
  };
  deviceValidation: {
    enforceDeviceValidation: boolean;
    requireRegisteredDevice: boolean;
    ipWhitelistEnabled: boolean;
    allowedPunchSources: string[];
  };
  photoRequirements: {
    enabled: boolean;
    mandatoryOnPunchIn: boolean;
    mandatoryOnPunchOut: boolean;
    maxFileSizeMb: number;
  };
  invalidPunchHandling: {
    mode: 'block' | 'store' | 'warn' | 'pending_approval';
    colorCodes: {
      outOfGeofence: string;
      late: string;
      early: string;
      warning: string;
      valid: string;
      approvedRegularization: string;
    };
  };
}

export interface AttendanceProfileContext {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  designation: string;
  dateOfJoining: string;
}

export type LeaveTypeCode = 'PL' | 'CL' | 'SL' | 'OH';

export interface AttendanceLeaveLedgerMonth {
  month: number;
  monthLabel: string;
  days: number;
  credit: number;
  availed: number;
  availedDates: string[];
}

export interface AttendanceLeaveLedger {
  employee: {
    employeeId: string;
    employeeCode: string;
    employeeName: string;
  };
  leaveType: LeaveTypeCode;
  year: number;
  openingBalance: number;
  openingBalanceDate: string;
  months: AttendanceLeaveLedgerMonth[];
  totals: {
    credit: number;
    availed: number;
  };
  balances: {
    ledgerBalance: number;
    currentBalance: number;
    discrepancy: number;
  };
}

export interface AttendanceLedgerEmployee {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  designation: string;
}
