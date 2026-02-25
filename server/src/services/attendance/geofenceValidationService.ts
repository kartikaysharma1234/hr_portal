import { OfficeLocationModel } from '../../models/OfficeLocation';
import type {
  AttendanceValidationReason,
  GeofenceMode,
  GeofenceValidationResult,
  GeoPointInput
} from '../../types/attendance';
import { findNearestLocation, validateGpsAccuracy } from '../../utils/geoUtils';

interface GeofenceValidationInput {
  organizationId: string;
  location: GeoPointInput;
  geofencingSettings: {
    enabled: boolean;
    geofenceMode: GeofenceMode;
    allowOutsidePunchWithApproval: boolean;
    defaultRadiusMeters: number;
    maxAllowedDistanceMeters: number;
    maxGpsAccuracyMeters: number;
  };
  employeeDepartment?: string;
  shiftCode?: string;
}

const reason = (
  code: string,
  message: string,
  severity: 'info' | 'warning' | 'invalid',
  meta?: Record<string, unknown>
): AttendanceValidationReason => ({ code, message, severity, meta });

export const validateGeofence = async (
  input: GeofenceValidationInput
): Promise<GeofenceValidationResult> => {
  const reasons: AttendanceValidationReason[] = [];

  if (!input.geofencingSettings.enabled) {
    return {
      isWithinGeofence: true,
      nearestLocationId: null,
      nearestLocationName: null,
      distanceMeters: null,
      isAccuracyValid: true,
      reasons: [reason('GEOFENCE_DISABLED', 'Geofence validation is disabled', 'info')],
      modeApplied: input.geofencingSettings.geofenceMode
    };
  }

  const officeLocations = (await OfficeLocationModel.find({
    organization: input.organizationId,
    isActive: true
  }).lean()) as any[];

  if (!officeLocations.length) {
    return {
      isWithinGeofence: false,
      nearestLocationId: null,
      nearestLocationName: null,
      distanceMeters: null,
      isAccuracyValid: false,
      reasons: [reason('NO_OFFICE_LOCATION', 'No active office location configured', 'invalid')],
      modeApplied: input.geofencingSettings.geofenceMode
    };
  }

  const filteredLocations = officeLocations.filter((location) => {
    const departmentRestricted =
      Array.isArray(location.departmentRestrictions) && location.departmentRestrictions.length > 0;

    if (departmentRestricted && input.employeeDepartment) {
      if (!location.departmentRestrictions.includes(input.employeeDepartment)) {
        return false;
      }
    } else if (departmentRestricted && !input.employeeDepartment) {
      return false;
    }

    const shiftRestricted = Array.isArray(location.shiftRestrictions) && location.shiftRestrictions.length > 0;
    if (shiftRestricted && input.shiftCode) {
      if (!location.shiftRestrictions.includes(input.shiftCode)) {
        return false;
      }
    } else if (shiftRestricted && !input.shiftCode) {
      return false;
    }

    return true;
  });

  const candidates = filteredLocations.length ? filteredLocations : officeLocations;

  const nearest = findNearestLocation(
    input.location.latitude,
    input.location.longitude,
    candidates.map((location) => ({
      id: location._id.toString(),
      name: location.name,
      latitude: location.geoPoint.coordinates[1],
      longitude: location.geoPoint.coordinates[0],
      radiusMeters: location.geofenceRadiusMeters,
      isActive: location.isActive
    }))
  );

  const accuracyCheck = validateGpsAccuracy(
    input.location.accuracy,
    input.geofencingSettings.maxGpsAccuracyMeters
  );

  if (!accuracyCheck.isValid) {
    reasons.push(reason('GPS_ACCURACY_INVALID', accuracyCheck.message, 'invalid'));
  }

  if (!nearest.location || nearest.distanceMeters === null) {
    reasons.push(reason('NO_MATCHING_LOCATION', 'Unable to resolve nearest office location', 'invalid'));

    return {
      isWithinGeofence: false,
      nearestLocationId: null,
      nearestLocationName: null,
      distanceMeters: null,
      isAccuracyValid: accuracyCheck.isValid,
      reasons,
      modeApplied: input.geofencingSettings.geofenceMode
    };
  }

  const nearestDoc = candidates.find((item) => item._id.toString() === nearest.location?.id);
  const locationRadius = nearestDoc?.geofenceRadiusMeters ?? input.geofencingSettings.defaultRadiusMeters;

  const isWithin = nearest.distanceMeters <= locationRadius;

  if (!isWithin) {
    const distance = Math.round(nearest.distanceMeters);
    const overBy = Math.max(0, distance - locationRadius);

    if (input.geofencingSettings.geofenceMode === 'strict') {
      reasons.push(
        reason(
          'OUTSIDE_GEOFENCE',
          `Punch is outside geofence by ${overBy} meters`,
          'invalid',
          {
            nearestLocation: nearest.location.name,
            distanceMeters: distance,
            radiusMeters: locationRadius
          }
        )
      );
    }

    if (input.geofencingSettings.geofenceMode === 'flexible') {
      if (distance > input.geofencingSettings.maxAllowedDistanceMeters) {
        reasons.push(
          reason(
            'OUTSIDE_MAX_ALLOWED_DISTANCE',
            `Punch is beyond max allowed distance (${input.geofencingSettings.maxAllowedDistanceMeters}m)`,
            'invalid',
            {
              nearestLocation: nearest.location.name,
              distanceMeters: distance
            }
          )
        );
      } else {
        reasons.push(
          reason(
            'OUTSIDE_GEOFENCE_FLEXIBLE',
            `Punch is outside geofence but within flexible distance (${distance}m)`,
            'warning',
            {
              nearestLocation: nearest.location.name,
              distanceMeters: distance,
              radiusMeters: locationRadius
            }
          )
        );
      }
    }

    if (input.geofencingSettings.geofenceMode === 'warning_only') {
      reasons.push(
        reason(
          'OUTSIDE_GEOFENCE_WARNING',
          `Punch is outside geofence (${distance}m from office)`,
          'warning',
          {
            nearestLocation: nearest.location.name,
            distanceMeters: distance,
            radiusMeters: locationRadius
          }
        )
      );
    }
  } else {
    reasons.push(
      reason('WITHIN_GEOFENCE', 'Punch location is within allowed office radius', 'info', {
        nearestLocation: nearest.location.name,
        distanceMeters: Math.round(nearest.distanceMeters),
        radiusMeters: locationRadius
      })
    );
  }

  return {
    isWithinGeofence: isWithin,
    nearestLocationId: nearest.location.id,
    nearestLocationName: nearest.location.name,
    distanceMeters: nearest.distanceMeters,
    isAccuracyValid: accuracyCheck.isValid,
    reasons,
    modeApplied: input.geofencingSettings.geofenceMode
  };
};
