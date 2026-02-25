import type { AttendanceSettingsShape, AttendanceNotificationChannelConfig } from '../types/attendance';
import { getAttendanceColorMapDefaults } from '../utils/attendanceColorUtils';

const allChannels = (): AttendanceNotificationChannelConfig => ({
  email: true,
  sms: false,
  push: true,
  inApp: true
});

const managerChannels = (): AttendanceNotificationChannelConfig => ({
  email: true,
  sms: false,
  push: true,
  inApp: true
});

const hrChannels = (): AttendanceNotificationChannelConfig => ({
  email: true,
  sms: false,
  push: false,
  inApp: true
});

export const getDefaultAttendanceSettings = (organizationId: string): AttendanceSettingsShape => {
  return {
    organization: organizationId,
    scopeType: 'company',
    scopeRef: 'company',
    inheritFromSettingsId: null,
    active: true,
    geofencing: {
      enabled: true,
      geofenceMode: 'warning_only',
      allowOutsidePunchWithApproval: true,
      defaultRadiusMeters: 150,
      maxAllowedDistanceMeters: 500,
      maxGpsAccuracyMeters: 80
    },
    timingRules: {
      timezone: 'Asia/Kolkata',
      shiftType: 'fixed',
      shiftStartTime: '09:00',
      shiftEndTime: '18:00',
      graceInMinutes: 10,
      graceOutMinutes: 10,
      lateMarkAfterMinutes: 10,
      earlyExitAfterMinutes: 10,
      halfDayAfterLateMinutes: 120,
      absentAfterLateMinutes: 240,
      minWorkingHoursForPresent: 8,
      maxWorkingHoursPerDay: 14,
      allowPunchBeforeShiftMinutes: 120,
      allowPunchAfterShiftMinutes: 180,
      preventOutsideShiftWindow: false,
      minMinutesBetweenPunches: 2,
      weekendPunchAllowed: false,
      holidayPunchAllowed: false
    },
    punchRules: {
      minTimeBetweenPunchesMinutes: 2,
      maxPunchesPerDay: 6,
      preventSequentialSamePunchType: true,
      duplicateWindowSeconds: 60,
      minGpsAccuracyMeters: 0,
      maxGpsAccuracyMeters: 150
    },
    deviceValidation: {
      enforceDeviceValidation: false,
      allowedPunchSources: ['mobile_app', 'web', 'biometric', 'csv_import', 'api_sync'],
      requireRegisteredDevice: false,
      registeredDevices: [],
      ipWhitelistEnabled: false,
      ipWhitelist: [],
      trackDeviceChanges: true,
      blockRootedJailbrokenDevices: false,
      allowUnknownDeviceAsWarning: true
    },
    photoRequirements: {
      enabled: false,
      mandatoryOnPunchIn: false,
      mandatoryOnPunchOut: false,
      maxFileSizeMb: 2,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    },
    invalidPunchHandling: {
      mode: 'warn',
      colorCodes: getAttendanceColorMapDefaults(),
      approvalRules: {
        managerApprovalRequired: true,
        hrApprovalRequired: false,
        autoApproveWarnings: false,
        escalationHours: 24
      }
    },
    notifications: {
      invalidPunchToEmployee: allChannels(),
      lateArrivalToManager: managerChannels(),
      absentToHr: hrChannels(),
      punchReminderToEmployee: {
        email: false,
        sms: false,
        push: true,
        inApp: true
      },
      approvalPendingToManager: managerChannels(),
      approvalDecisionToEmployee: allChannels(),
      bulkSyncCompleted: {
        email: true,
        sms: false,
        push: false,
        inApp: true
      }
    },
    regularization: {
      enabled: true,
      maxDaysPast: 7,
      maxRequestsPerMonth: 5,
      requireManagerApproval: true,
      requireHrApproval: false
    }
  };
};
