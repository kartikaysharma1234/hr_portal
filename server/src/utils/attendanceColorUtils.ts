import type { ColorIndicator, ValidationStatus } from '../types/attendance';

export interface ColorMapInput {
  outOfGeofence: string;
  late: string;
  early: string;
  warning: string;
  valid: string;
  approvedRegularization: string;
}

const defaultColorMap: ColorMapInput = {
  outOfGeofence: '#ec4899',
  late: '#ef4444',
  early: '#f97316',
  warning: '#eab308',
  valid: '#22c55e',
  approvedRegularization: '#3b82f6'
};

const toHex = (value: string, fallback: string): string => {
  return /^#([A-Fa-f0-9]{6})$/.test(value) ? value : fallback;
};

export const getAttendanceColorIndicator = (params: {
  status: ValidationStatus;
  reasons: string[];
  isApprovedRegularization?: boolean;
  colors?: Partial<ColorMapInput>;
}): ColorIndicator => {
  const colors: ColorMapInput = {
    ...defaultColorMap,
    ...params.colors
  };

  if (params.isApprovedRegularization) {
    return {
      hex: toHex(colors.approvedRegularization, defaultColorMap.approvedRegularization),
      cssClass: 'attendance-status-approved-regularization',
      label: 'Approved Regularization'
    };
  }

  if (params.status === 'valid') {
    return {
      hex: toHex(colors.valid, defaultColorMap.valid),
      cssClass: 'attendance-status-valid',
      label: 'Valid'
    };
  }

  if (params.status === 'warning') {
    return {
      hex: toHex(colors.warning, defaultColorMap.warning),
      cssClass: 'attendance-status-warning',
      label: 'Warning'
    };
  }

  const hasGeofence = params.reasons.some((reason) => reason.toLowerCase().includes('geofence'));
  if (hasGeofence) {
    return {
      hex: toHex(colors.outOfGeofence, defaultColorMap.outOfGeofence),
      cssClass: 'attendance-status-geofence-invalid',
      label: 'Out of Geofence'
    };
  }

  const hasLate = params.reasons.some((reason) => reason.toLowerCase().includes('late'));
  if (hasLate) {
    return {
      hex: toHex(colors.late, defaultColorMap.late),
      cssClass: 'attendance-status-late',
      label: 'Late'
    };
  }

  const hasEarly = params.reasons.some((reason) => reason.toLowerCase().includes('early'));
  if (hasEarly) {
    return {
      hex: toHex(colors.early, defaultColorMap.early),
      cssClass: 'attendance-status-early',
      label: 'Early'
    };
  }

  return {
    hex: toHex(colors.warning, defaultColorMap.warning),
    cssClass: 'attendance-status-invalid',
    label: 'Invalid'
  };
};

export const getAttendanceColorMapDefaults = (): ColorMapInput => ({ ...defaultColorMap });
