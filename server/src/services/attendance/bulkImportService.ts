import createHttpError from 'http-errors';
import { DateTime } from 'luxon';

import { AttendancePunchModel } from '../../models/AttendancePunch';
import { EmployeeModel } from '../../models/Employee';
import { UserModel } from '../../models/User';
import { runMainPunchValidation } from './punchValidationService';
import { resolveEmployeeContextForUser } from './attendanceQueryService';
import type { PunchSource, PunchType } from '../../types/attendance';

export interface ImportedPunchRow {
  employeeCode?: string;
  employeeEmail?: string;
  punchType: PunchType;
  timestamp: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  deviceId: string;
  source: PunchSource;
}

export interface BulkImportSummary {
  processed: number;
  saved: number;
  invalid: number;
  blocked: number;
  failed: number;
  errors: Array<{ index: number; message: string }>;
}

export const parseCsvPunchRows = (csv: string): ImportedPunchRow[] => {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(',').map((item) => item.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((item) => item.trim());
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));

    return {
      employeeCode: row.employeeCode || undefined,
      employeeEmail: row.employeeEmail || undefined,
      punchType: (row.punchType as PunchType) || 'IN',
      timestamp: row.timestamp,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      accuracy: Number(row.accuracy),
      deviceId: row.deviceId || `import-${Date.now()}`,
      source: (row.source as PunchSource) || 'csv_import'
    };
  });
};

const resolveEmployee = async (params: {
  organizationId: string;
  employeeCode?: string;
  employeeEmail?: string;
}): Promise<{ id: string; name: string; department: string; shiftCode: string }> => {
  if (!params.employeeCode && !params.employeeEmail) {
    throw createHttpError(400, 'employeeCode or employeeEmail is required');
  }

  const employee = await EmployeeModel.findOne({
    organization: params.organizationId,
    ...(params.employeeCode ? { employeeCode: params.employeeCode } : {}),
    ...(params.employeeEmail ? { workEmail: params.employeeEmail.toLowerCase() } : {})
  }).lean();

  if (!employee) {
    throw createHttpError(404, 'Employee not found for import row');
  }

  return {
    id: employee._id.toString(),
    name: `${employee.firstName} ${employee.lastName}`.trim(),
    department: employee.department || 'general',
    shiftCode: 'default'
  };
};

export const importAttendancePunches = async (params: {
  organizationId: string;
  importedByUserId: string;
  rows: ImportedPunchRow[];
  cutoffTimeHHmm?: string;
}): Promise<BulkImportSummary> => {
  const summary: BulkImportSummary = {
    processed: params.rows.length,
    saved: 0,
    invalid: 0,
    blocked: 0,
    failed: 0,
    errors: []
  };

  const importedBy = await UserModel.findOne({
    _id: params.importedByUserId,
    organization: params.organizationId
  })
    .select({ _id: 1, email: 1 })
    .lean();

  if (!importedBy) {
    throw createHttpError(404, 'Import user not found');
  }

  for (let index = 0; index < params.rows.length; index += 1) {
    const row = params.rows[index];

    try {
      const employee = await resolveEmployee({
        organizationId: params.organizationId,
        employeeCode: row.employeeCode,
        employeeEmail: row.employeeEmail
      });

      const punchTime = new Date(row.timestamp);
      if (Number.isNaN(punchTime.getTime())) {
        throw createHttpError(400, 'Invalid timestamp');
      }

      const validation = await runMainPunchValidation({
        organizationId: params.organizationId,
        employeeId: employee.id,
        employeeDepartment: employee.department,
        shiftCode: employee.shiftCode,
        punchType: row.punchType,
        punchTime,
        source: row.source,
        location: {
          latitude: row.latitude,
          longitude: row.longitude,
          accuracy: row.accuracy
        },
        device: {
          deviceId: row.deviceId,
          ipAddress: '',
          userAgent: 'bulk-import'
        }
      });

      const timezone = validation.settings.settings.timingRules.timezone;
      const punchDate = DateTime.fromJSDate(punchTime, { zone: timezone }).toFormat('yyyy-LL-dd');

      let postCutoffInvalid = false;
      if (params.cutoffTimeHHmm) {
        const [cutoffHour, cutoffMinute] = params.cutoffTimeHHmm.split(':').map(Number);
        const punchLocal = DateTime.fromJSDate(punchTime, { zone: timezone });
        const cutoff = punchLocal.set({ hour: cutoffHour || 0, minute: cutoffMinute || 0, second: 0 });
        if (punchLocal > cutoff) {
          postCutoffInvalid = true;
          validation.result.reasons.push({
            code: 'POST_CUTOFF_PUNCH',
            message: `Punch occurred after cutoff ${params.cutoffTimeHHmm}`,
            severity: 'invalid',
            meta: {
              cutoff: params.cutoffTimeHHmm
            }
          });
          validation.result.finalStatus = 'invalid';
        }
      }

      if (validation.result.blockPunch) {
        summary.blocked += 1;
        continue;
      }

      if (validation.result.finalStatus !== 'valid') {
        summary.invalid += 1;
      }

      await AttendancePunchModel.create({
        organization: params.organizationId,
        employee: employee.id,
        user: importedBy._id,
        punchDate,
        punchTime,
        punchType: row.punchType,
        gps: {
          latitude: row.latitude,
          longitude: row.longitude,
          accuracy: row.accuracy,
          address: ''
        },
        gpsPoint: {
          type: 'Point',
          coordinates: [row.longitude, row.latitude]
        },
        nearestOfficeLocation: validation.result.nearestLocationId,
        distanceFromOfficeMeters: validation.result.distanceMeters,
        punchSource: row.source,
        device: {
          deviceId: row.deviceId,
          macAddress: '',
          ipAddress: '',
          userAgent: 'bulk-import',
          platform: 'import',
          appVersion: '',
          fingerprint: 'bulk',
          isRooted: false,
          isJailBroken: false
        },
        validation: {
          status: validation.result.finalStatus,
          reasons: validation.result.reasons,
          colorHex: postCutoffInvalid
            ? validation.settings.settings.invalidPunchHandling.colorCodes.outOfGeofence
            : validation.result.finalColor.hex,
          colorClass: validation.result.finalColor.cssClass,
          modeApplied: validation.settings.settings.invalidPunchHandling.mode,
          checks: {
            geofence: validation.result.geofence.isWithinGeofence ? 'pass' : 'fail',
            time: validation.result.time.isWithinWindow ? 'pass' : 'fail',
            device: validation.result.device.isAllowed ? 'pass' : 'fail',
            photo: validation.result.photo.isValid ? 'pass' : 'fail'
          },
          evaluatedAt: new Date()
        },
        approvalWorkflow: {
          required: validation.result.requiresApproval,
          status: validation.result.requiresApproval ? 'pending' : 'not_required',
          requestedAt: validation.result.requiresApproval ? new Date() : null,
          requestedBy: validation.result.requiresApproval ? importedBy._id : null,
          auditTrail: [
            {
              action: 'created',
              byUser: importedBy._id,
              at: new Date(),
              comment: 'Created via bulk import'
            }
          ]
        },
        syncMeta: {
          sourceBatchId: `bulk-${Date.now()}`,
          importedBy: importedBy._id,
          importedAt: new Date()
        }
      });

      summary.saved += 1;
    } catch (error) {
      summary.failed += 1;
      const message = error instanceof Error ? error.message : 'Unknown import error';
      summary.errors.push({ index, message });
    }
  }

  return summary;
};
