import { AttendancePunchModel } from '../../models/AttendancePunch';
import type {
  AttendanceValidationReason,
  DeviceInput,
  DeviceValidationResult,
  PunchSource
} from '../../types/attendance';

interface DeviceValidationInput {
  organizationId: string;
  employeeId: string;
  source: PunchSource;
  device: DeviceInput;
  settings: {
    enforceDeviceValidation: boolean;
    allowedPunchSources: PunchSource[];
    requireRegisteredDevice: boolean;
    registeredDevices: Array<{
      deviceId: string;
      macAddress?: string;
      active: boolean;
      assignedToEmployee?: string;
    }>;
    ipWhitelistEnabled: boolean;
    ipWhitelist: string[];
    trackDeviceChanges: boolean;
    blockRootedJailbrokenDevices: boolean;
    allowUnknownDeviceAsWarning: boolean;
  };
  duplicateWindowSeconds: number;
}

const macRegex = /^([0-9A-Fa-f]{2}([-:])){5}([0-9A-Fa-f]{2})$/;

const reason = (
  code: string,
  message: string,
  severity: 'info' | 'warning' | 'invalid',
  meta?: Record<string, unknown>
): AttendanceValidationReason => ({ code, message, severity, meta });

export const validateDevice = async (
  input: DeviceValidationInput
): Promise<DeviceValidationResult> => {
  const reasons: AttendanceValidationReason[] = [];

  if (!input.settings.enforceDeviceValidation) {
    return {
      isAllowed: true,
      isDuplicateDevicePunch: false,
      isRegisteredDevice: true,
      reasons: [reason('DEVICE_VALIDATION_DISABLED', 'Device validation is disabled', 'info')]
    };
  }

  if (!input.settings.allowedPunchSources.includes(input.source)) {
    reasons.push(
      reason(
        'PUNCH_SOURCE_NOT_ALLOWED',
        `Punch source ${input.source} is not allowed`,
        'invalid'
      )
    );
  }

  if (!input.device.deviceId?.trim()) {
    reasons.push(reason('DEVICE_ID_REQUIRED', 'Device ID is required', 'invalid'));
  }

  if (input.device.macAddress && !macRegex.test(input.device.macAddress)) {
    reasons.push(reason('INVALID_MAC_ADDRESS', 'MAC address format is invalid', 'invalid'));
  }

  if (input.settings.ipWhitelistEnabled) {
    const ip = (input.device.ipAddress ?? '').trim();
    if (!ip) {
      reasons.push(reason('IP_REQUIRED', 'IP address is required for whitelist validation', 'invalid'));
    } else if (!input.settings.ipWhitelist.includes(ip)) {
      reasons.push(reason('IP_NOT_WHITELISTED', `IP ${ip} is not whitelisted`, 'invalid'));
    }
  }

  if (input.settings.blockRootedJailbrokenDevices && (input.device.isRooted || input.device.isJailBroken)) {
    reasons.push(
      reason(
        'ROOTED_OR_JAILBROKEN_DEVICE',
        'Rooted or jailbroken devices are blocked for attendance',
        'invalid'
      )
    );
  }

  let isRegisteredDevice = true;
  if (input.settings.requireRegisteredDevice) {
    const matched = input.settings.registeredDevices.find((item) => {
      if (!item.active) {
        return false;
      }

      if (item.assignedToEmployee && item.assignedToEmployee !== input.employeeId) {
        return false;
      }

      return item.deviceId === input.device.deviceId;
    });

    isRegisteredDevice = Boolean(matched);
    if (!matched) {
      if (input.settings.allowUnknownDeviceAsWarning) {
        reasons.push(
          reason(
            'UNREGISTERED_DEVICE_WARNING',
            'Device is not registered for this employee',
            'warning'
          )
        );
      } else {
        reasons.push(
          reason(
            'UNREGISTERED_DEVICE_BLOCKED',
            'Device is not registered for this employee',
            'invalid'
          )
        );
      }
    }
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - input.duplicateWindowSeconds * 1000);

  const duplicateFromDevice = (await AttendancePunchModel.findOne({
    organization: input.organizationId,
    employee: input.employeeId,
    'device.deviceId': input.device.deviceId,
    punchTime: {
      $gte: windowStart,
      $lte: now
    }
  })
    .sort({ punchTime: -1 })
    .select({ _id: 1, punchTime: 1 })
    .lean()) as any;

  const isDuplicateDevicePunch = Boolean(duplicateFromDevice);
  if (isDuplicateDevicePunch) {
    reasons.push(
      reason(
        'DUPLICATE_DEVICE_PUNCH',
        'Duplicate punch from the same device detected in a short interval',
        'warning',
        {
          lastPunchAt: duplicateFromDevice?.punchTime
        }
      )
    );
  }

  if (input.settings.trackDeviceChanges) {
    const latestPunch = (await AttendancePunchModel.findOne({
      organization: input.organizationId,
      employee: input.employeeId
    })
      .sort({ punchTime: -1 })
      .select({ 'device.deviceId': 1, 'device.macAddress': 1 })
      .lean()) as any;

    if (
      latestPunch &&
      latestPunch.device?.deviceId &&
      latestPunch.device.deviceId !== input.device.deviceId
    ) {
      reasons.push(
        reason(
          'DEVICE_CHANGED',
          `Punching from a new device (previous ${latestPunch.device.deviceId})`,
          'warning'
        )
      );
    }
  }

  if (!reasons.length) {
    reasons.push(reason('DEVICE_VALID', 'Device validation passed', 'info'));
  }

  const isAllowed = !reasons.some((item) => item.severity === 'invalid');

  return {
    isAllowed,
    isDuplicateDevicePunch,
    isRegisteredDevice,
    reasons
  };
};
