import { Schema, model } from 'mongoose';

const geofenceModeValues = ['strict', 'flexible', 'warning_only'] as const;
const invalidPunchModeValues = ['block', 'store', 'warn', 'pending_approval'] as const;
const scopeTypeValues = ['company', 'department', 'shift'] as const;
const shiftTypeValues = ['fixed', 'flexible'] as const;
const punchSourceValues = ['mobile_app', 'web', 'biometric', 'csv_import', 'api_sync'] as const;

const channelSchema = new Schema(
  {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true }
  },
  { _id: false }
);

const attendanceSettingsSchema = new Schema(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    scopeType: {
      type: String,
      enum: scopeTypeValues,
      default: 'company'
    },
    scopeRef: {
      type: String,
      required: true,
      default: 'company',
      trim: true
    },
    inheritFromSettingsId: {
      type: Schema.Types.ObjectId,
      ref: 'AttendanceSettings',
      default: null
    },
    geofencing: {
      enabled: { type: Boolean, default: true },
      geofenceMode: {
        type: String,
        enum: geofenceModeValues,
        default: 'warning_only'
      },
      allowOutsidePunchWithApproval: { type: Boolean, default: true },
      defaultRadiusMeters: { type: Number, default: 150, min: 10, max: 10000 },
      maxAllowedDistanceMeters: { type: Number, default: 500, min: 10, max: 50000 },
      maxGpsAccuracyMeters: { type: Number, default: 80, min: 1, max: 2000 }
    },
    timingRules: {
      timezone: { type: String, default: 'Asia/Kolkata' },
      shiftType: {
        type: String,
        enum: shiftTypeValues,
        default: 'fixed'
      },
      shiftStartTime: { type: String, default: '09:00' },
      shiftEndTime: { type: String, default: '18:00' },
      graceInMinutes: { type: Number, default: 10, min: 0, max: 240 },
      graceOutMinutes: { type: Number, default: 10, min: 0, max: 240 },
      lateMarkAfterMinutes: { type: Number, default: 10, min: 0, max: 600 },
      earlyExitAfterMinutes: { type: Number, default: 10, min: 0, max: 600 },
      halfDayAfterLateMinutes: { type: Number, default: 120, min: 0, max: 1440 },
      absentAfterLateMinutes: { type: Number, default: 240, min: 0, max: 1440 },
      minWorkingHoursForPresent: { type: Number, default: 8, min: 0, max: 24 },
      maxWorkingHoursPerDay: { type: Number, default: 14, min: 0, max: 24 },
      allowPunchBeforeShiftMinutes: { type: Number, default: 120, min: 0, max: 720 },
      allowPunchAfterShiftMinutes: { type: Number, default: 180, min: 0, max: 720 },
      preventOutsideShiftWindow: { type: Boolean, default: false },
      minMinutesBetweenPunches: { type: Number, default: 2, min: 0, max: 180 },
      weekendPunchAllowed: { type: Boolean, default: false },
      holidayPunchAllowed: { type: Boolean, default: false }
    },
    punchRules: {
      minTimeBetweenPunchesMinutes: { type: Number, default: 2, min: 0, max: 180 },
      maxPunchesPerDay: { type: Number, default: 6, min: 1, max: 24 },
      preventSequentialSamePunchType: { type: Boolean, default: true },
      duplicateWindowSeconds: { type: Number, default: 60, min: 0, max: 3600 },
      minGpsAccuracyMeters: { type: Number, default: 0, min: 0, max: 2000 },
      maxGpsAccuracyMeters: { type: Number, default: 150, min: 1, max: 2000 }
    },
    deviceValidation: {
      enforceDeviceValidation: { type: Boolean, default: false },
      allowedPunchSources: {
        type: [String],
        enum: punchSourceValues,
        default: ['mobile_app', 'web', 'biometric', 'csv_import', 'api_sync']
      },
      requireRegisteredDevice: { type: Boolean, default: false },
      registeredDevices: {
        type: [
          new Schema(
            {
              deviceId: { type: String, required: true, trim: true },
              macAddress: { type: String, default: '' },
              label: { type: String, default: '' },
              assignedToEmployee: { type: String, default: '' },
              active: { type: Boolean, default: true }
            },
            { _id: false }
          )
        ],
        default: []
      },
      ipWhitelistEnabled: { type: Boolean, default: false },
      ipWhitelist: { type: [String], default: [] },
      trackDeviceChanges: { type: Boolean, default: true },
      blockRootedJailbrokenDevices: { type: Boolean, default: false },
      allowUnknownDeviceAsWarning: { type: Boolean, default: true }
    },
    photoRequirements: {
      enabled: { type: Boolean, default: false },
      mandatoryOnPunchIn: { type: Boolean, default: false },
      mandatoryOnPunchOut: { type: Boolean, default: false },
      maxFileSizeMb: { type: Number, default: 2, min: 1, max: 25 },
      allowedMimeTypes: {
        type: [String],
        default: ['image/jpeg', 'image/png', 'image/webp']
      }
    },
    invalidPunchHandling: {
      mode: {
        type: String,
        enum: invalidPunchModeValues,
        default: 'warn'
      },
      colorCodes: {
        outOfGeofence: { type: String, default: '#ec4899' },
        late: { type: String, default: '#ef4444' },
        early: { type: String, default: '#f97316' },
        warning: { type: String, default: '#eab308' },
        valid: { type: String, default: '#22c55e' },
        approvedRegularization: { type: String, default: '#3b82f6' }
      },
      approvalRules: {
        managerApprovalRequired: { type: Boolean, default: true },
        hrApprovalRequired: { type: Boolean, default: false },
        autoApproveWarnings: { type: Boolean, default: false },
        escalationHours: { type: Number, default: 24, min: 1, max: 720 }
      }
    },
    notifications: {
      invalidPunchToEmployee: { type: channelSchema, default: () => ({}) },
      lateArrivalToManager: { type: channelSchema, default: () => ({}) },
      absentToHr: { type: channelSchema, default: () => ({}) },
      punchReminderToEmployee: { type: channelSchema, default: () => ({}) },
      approvalPendingToManager: { type: channelSchema, default: () => ({}) },
      approvalDecisionToEmployee: { type: channelSchema, default: () => ({}) },
      bulkSyncCompleted: { type: channelSchema, default: () => ({}) }
    },
    regularization: {
      enabled: { type: Boolean, default: true },
      maxDaysPast: { type: Number, default: 7, min: 0, max: 365 },
      maxRequestsPerMonth: { type: Number, default: 5, min: 1, max: 100 },
      requireManagerApproval: { type: Boolean, default: true },
      requireHrApproval: { type: Boolean, default: false }
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

attendanceSettingsSchema.index({ organization: 1, active: 1 });
attendanceSettingsSchema.index({ organization: 1, scopeType: 1, scopeRef: 1 }, { unique: true });

export type AttendanceSettings = any;

export const AttendanceSettingsModel = model<any>(
  'AttendanceSettings',
  attendanceSettingsSchema
);
