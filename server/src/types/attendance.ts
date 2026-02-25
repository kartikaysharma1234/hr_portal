export type PunchType = 'IN' | 'OUT';

export type PunchSource = 'mobile_app' | 'web' | 'biometric' | 'csv_import' | 'api_sync';

export type ValidationStatus = 'valid' | 'invalid' | 'pending_approval' | 'warning';

export type ValidationSeverity = 'info' | 'warning' | 'invalid';

export type GeofenceMode = 'strict' | 'flexible' | 'warning_only';

export type InvalidPunchMode = 'block' | 'store' | 'warn' | 'pending_approval';

export type PunchApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected';

export type ShiftType = 'fixed' | 'flexible';

export interface GeoPointInput {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface DeviceInput {
  deviceId: string;
  macAddress?: string;
  ipAddress?: string;
  userAgent?: string;
  platform?: string;
  appVersion?: string;
  isRooted?: boolean;
  isJailBroken?: boolean;
  fingerprint?: string;
}

export interface AttendanceValidationReason {
  code: string;
  message: string;
  severity: ValidationSeverity;
  meta?: Record<string, unknown>;
}

export interface ColorIndicator {
  hex: string;
  cssClass: string;
  label: string;
}

export interface ApprovalRuleConfig {
  managerApprovalRequired: boolean;
  hrApprovalRequired: boolean;
  autoApproveWarnings: boolean;
  escalationHours: number;
}

export interface AttendanceNotificationChannelConfig {
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
}

export interface AttendanceNotificationPreferences {
  invalidPunchToEmployee: AttendanceNotificationChannelConfig;
  lateArrivalToManager: AttendanceNotificationChannelConfig;
  absentToHr: AttendanceNotificationChannelConfig;
  punchReminderToEmployee: AttendanceNotificationChannelConfig;
  approvalPendingToManager: AttendanceNotificationChannelConfig;
  approvalDecisionToEmployee: AttendanceNotificationChannelConfig;
  bulkSyncCompleted: AttendanceNotificationChannelConfig;
}

export interface TimingRules {
  timezone: string;
  shiftType: ShiftType;
  shiftStartTime: string;
  shiftEndTime: string;
  graceInMinutes: number;
  graceOutMinutes: number;
  lateMarkAfterMinutes: number;
  earlyExitAfterMinutes: number;
  halfDayAfterLateMinutes: number;
  absentAfterLateMinutes: number;
  minWorkingHoursForPresent: number;
  maxWorkingHoursPerDay: number;
  allowPunchBeforeShiftMinutes: number;
  allowPunchAfterShiftMinutes: number;
  preventOutsideShiftWindow: boolean;
  minMinutesBetweenPunches: number;
  weekendPunchAllowed: boolean;
  holidayPunchAllowed: boolean;
}

export interface PunchValidationRules {
  minTimeBetweenPunchesMinutes: number;
  maxPunchesPerDay: number;
  preventSequentialSamePunchType: boolean;
  duplicateWindowSeconds: number;
  minGpsAccuracyMeters: number;
  maxGpsAccuracyMeters: number;
}

export interface DeviceValidationSettings {
  enforceDeviceValidation: boolean;
  allowedPunchSources: PunchSource[];
  requireRegisteredDevice: boolean;
  registeredDevices: Array<{
    deviceId: string;
    macAddress?: string;
    label?: string;
    assignedToEmployee?: string;
    active: boolean;
  }>;
  ipWhitelistEnabled: boolean;
  ipWhitelist: string[];
  trackDeviceChanges: boolean;
  blockRootedJailbrokenDevices: boolean;
  allowUnknownDeviceAsWarning: boolean;
}

export interface PhotoSelfieRequirements {
  enabled: boolean;
  mandatoryOnPunchIn: boolean;
  mandatoryOnPunchOut: boolean;
  maxFileSizeMb: number;
  allowedMimeTypes: string[];
}

export interface GeofencingSettings {
  enabled: boolean;
  geofenceMode: GeofenceMode;
  allowOutsidePunchWithApproval: boolean;
  defaultRadiusMeters: number;
  maxAllowedDistanceMeters: number;
  maxGpsAccuracyMeters: number;
}

export interface InvalidPunchHandling {
  mode: InvalidPunchMode;
  colorCodes: {
    outOfGeofence: string;
    late: string;
    early: string;
    warning: string;
    valid: string;
    approvedRegularization: string;
  };
  approvalRules: ApprovalRuleConfig;
}

export interface AttendanceSettingsShape {
  organization: string;
  scopeType: 'company' | 'department' | 'shift';
  scopeRef: string;
  inheritFromSettingsId?: string | null;
  geofencing: GeofencingSettings;
  timingRules: TimingRules;
  punchRules: PunchValidationRules;
  deviceValidation: DeviceValidationSettings;
  photoRequirements: PhotoSelfieRequirements;
  invalidPunchHandling: InvalidPunchHandling;
  notifications: AttendanceNotificationPreferences;
  regularization: {
    enabled: boolean;
    maxDaysPast: number;
    maxRequestsPerMonth: number;
    requireManagerApproval: boolean;
    requireHrApproval: boolean;
  };
  active: boolean;
}

export interface GeofenceValidationResult {
  isWithinGeofence: boolean;
  nearestLocationId: string | null;
  nearestLocationName: string | null;
  distanceMeters: number | null;
  isAccuracyValid: boolean;
  reasons: AttendanceValidationReason[];
  modeApplied: GeofenceMode;
}

export interface TimeValidationResult {
  isWithinWindow: boolean;
  lateMinutes: number;
  earlyExitMinutes: number;
  statusTag: 'on_time' | 'late' | 'early' | 'half_day' | 'absent' | 'weekend' | 'holiday';
  reasons: AttendanceValidationReason[];
  shiftStartIso: string;
  shiftEndIso: string;
}

export interface DeviceValidationResult {
  isAllowed: boolean;
  isDuplicateDevicePunch: boolean;
  isRegisteredDevice: boolean;
  reasons: AttendanceValidationReason[];
}

export interface PhotoValidationResult {
  isValid: boolean;
  reasons: AttendanceValidationReason[];
}

export interface PunchValidationResult {
  finalStatus: ValidationStatus;
  finalColor: ColorIndicator;
  reasons: AttendanceValidationReason[];
  geofence: GeofenceValidationResult;
  time: TimeValidationResult;
  device: DeviceValidationResult;
  photo: PhotoValidationResult;
  requiresApproval: boolean;
  blockPunch: boolean;
  nearestLocationId: string | null;
  distanceMeters: number | null;
}
