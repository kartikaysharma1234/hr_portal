import type {
  DeviceInput,
  PunchSource,
  PunchType,
  PunchValidationResult,
  ValidationStatus
} from '../../types/attendance';
import { getAttendanceColorIndicator } from '../../utils/attendanceColorUtils';
import { validateDevice } from './deviceValidationService';
import { validateGeofence } from './geofenceValidationService';
import { validatePunchPhoto, type PhotoInput } from './photoValidationService';
import { getEffectiveAttendanceSettings } from './attendanceSettingsService';
import { validatePunchTime } from './timeValidationService';

interface MainPunchValidationInput {
  organizationId: string;
  employeeId: string;
  employeeDepartment?: string;
  shiftCode?: string;
  punchType: PunchType;
  punchTime: Date;
  source: PunchSource;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  device: DeviceInput;
  photo?: PhotoInput;
  holidayDates?: string[];
}

export interface ValidationContext {
  settings: Awaited<ReturnType<typeof getEffectiveAttendanceSettings>>;
  result: PunchValidationResult;
}

const resolveFinalStatus = (params: {
  hasInvalid: boolean;
  hasWarning: boolean;
  mode: 'block' | 'store' | 'warn' | 'pending_approval';
}): { status: ValidationStatus; blockPunch: boolean; requiresApproval: boolean } => {
  if (!params.hasInvalid && !params.hasWarning) {
    return {
      status: 'valid',
      blockPunch: false,
      requiresApproval: false
    };
  }

  if (!params.hasInvalid && params.hasWarning) {
    return {
      status: 'warning',
      blockPunch: false,
      requiresApproval: false
    };
  }

  if (params.mode === 'block') {
    return {
      status: 'invalid',
      blockPunch: true,
      requiresApproval: false
    };
  }

  if (params.mode === 'pending_approval') {
    return {
      status: 'pending_approval',
      blockPunch: false,
      requiresApproval: true
    };
  }

  if (params.mode === 'warn') {
    return {
      status: 'warning',
      blockPunch: false,
      requiresApproval: false
    };
  }

  return {
    status: 'invalid',
    blockPunch: false,
    requiresApproval: false
  };
};

export const runMainPunchValidation = async (
  input: MainPunchValidationInput
): Promise<ValidationContext> => {
  const settings = await getEffectiveAttendanceSettings({
    organizationId: input.organizationId,
    departmentId: input.employeeDepartment,
    shiftCode: input.shiftCode
  });

  const geo = await validateGeofence({
    organizationId: input.organizationId,
    location: input.location,
    geofencingSettings: {
      enabled: settings.settings.geofencing.enabled,
      geofenceMode: settings.settings.geofencing.geofenceMode,
      allowOutsidePunchWithApproval: settings.settings.geofencing.allowOutsidePunchWithApproval,
      defaultRadiusMeters: settings.settings.geofencing.defaultRadiusMeters,
      maxAllowedDistanceMeters: settings.settings.geofencing.maxAllowedDistanceMeters,
      maxGpsAccuracyMeters: settings.settings.geofencing.maxGpsAccuracyMeters
    },
    employeeDepartment: input.employeeDepartment,
    shiftCode: input.shiftCode
  });

  const time = await validatePunchTime({
    organizationId: input.organizationId,
    employeeId: input.employeeId,
    punchType: input.punchType,
    timestamp: input.punchTime,
    holidayDates: input.holidayDates,
    timingRules: settings.settings.timingRules,
    punchRules: {
      minTimeBetweenPunchesMinutes: settings.settings.punchRules.minTimeBetweenPunchesMinutes,
      maxPunchesPerDay: settings.settings.punchRules.maxPunchesPerDay,
      preventSequentialSamePunchType: settings.settings.punchRules.preventSequentialSamePunchType
    }
  });

  const device = await validateDevice({
    organizationId: input.organizationId,
    employeeId: input.employeeId,
    source: input.source,
    device: input.device,
    settings: settings.settings.deviceValidation,
    duplicateWindowSeconds: settings.settings.punchRules.duplicateWindowSeconds
  });

  const photo = validatePunchPhoto({
    punchType: input.punchType,
    settings: settings.settings.photoRequirements,
    photo: input.photo
  });

  const reasons = [...geo.reasons, ...time.reasons, ...device.reasons, ...photo.reasons];
  const hasInvalid = reasons.some((entry) => entry.severity === 'invalid');
  const hasWarning = reasons.some((entry) => entry.severity === 'warning');

  const decision = resolveFinalStatus({
    hasInvalid,
    hasWarning,
    mode: settings.settings.invalidPunchHandling.mode
  });

  const color = getAttendanceColorIndicator({
    status: decision.status,
    reasons: reasons.map((entry) => entry.code),
    colors: settings.settings.invalidPunchHandling.colorCodes
  });

  const result: PunchValidationResult = {
    finalStatus: decision.status,
    finalColor: color,
    reasons,
    geofence: geo,
    time,
    device,
    photo,
    requiresApproval: decision.requiresApproval,
    blockPunch: decision.blockPunch,
    nearestLocationId: geo.nearestLocationId,
    distanceMeters: geo.distanceMeters
  };

  return {
    settings,
    result
  };
};
