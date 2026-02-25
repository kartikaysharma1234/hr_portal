import { getDefaultAttendanceSettings } from '../../config/defaultAttendanceSettings';
import { AttendanceSettingsModel, type AttendanceSettings } from '../../models/AttendanceSettings';
import { deepMerge } from '../../utils/objectMerge';

export interface ResolvedAttendanceSettings {
  source: {
    companySettingsId: string;
    departmentSettingsId: string | null;
    shiftSettingsId: string | null;
  };
  settings: AttendanceSettings;
}

const asObject = (value: AttendanceSettings): Record<string, unknown> => {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
};

const toAttendanceSettings = (value: Record<string, unknown>): AttendanceSettings => {
  return value as unknown as AttendanceSettings;
};

export const ensureDefaultCompanyAttendanceSettings = async (
  organizationId: string
): Promise<AttendanceSettings> => {
  const existing = await AttendanceSettingsModel.findOne({
    organization: organizationId,
    scopeType: 'company',
    scopeRef: 'company'
  }).exec();

  if (existing) {
    return existing;
  }

  const created = await AttendanceSettingsModel.create(getDefaultAttendanceSettings(organizationId));
  return created;
};

export const getAttendanceSettingsById = async (
  organizationId: string,
  settingsId: string
): Promise<AttendanceSettings | null> => {
  return AttendanceSettingsModel.findOne({
    _id: settingsId,
    organization: organizationId
  }).exec();
};

export const getAttendanceSettingsForScope = async (params: {
  organizationId: string;
  scopeType: 'company' | 'department' | 'shift';
  scopeRef: string;
}): Promise<AttendanceSettings | null> => {
  return AttendanceSettingsModel.findOne({
    organization: params.organizationId,
    scopeType: params.scopeType,
    scopeRef: params.scopeRef,
    active: true
  }).exec();
};

export const getEffectiveAttendanceSettings = async (params: {
  organizationId: string;
  departmentId?: string | null;
  shiftCode?: string | null;
}): Promise<ResolvedAttendanceSettings> => {
  const company = await ensureDefaultCompanyAttendanceSettings(params.organizationId);

  const department = params.departmentId
    ? await AttendanceSettingsModel.findOne({
        organization: params.organizationId,
        scopeType: 'department',
        scopeRef: params.departmentId,
        active: true
      }).exec()
    : null;

  const shift = params.shiftCode
    ? await AttendanceSettingsModel.findOne({
        organization: params.organizationId,
        scopeType: 'shift',
        scopeRef: params.shiftCode,
        active: true
      }).exec()
    : null;

  let merged = asObject(company.toObject());

  if (department) {
    merged = deepMerge(merged, asObject(department.toObject()));
  }

  if (shift) {
    merged = deepMerge(merged, asObject(shift.toObject()));
  }

  return {
    source: {
      companySettingsId: company._id.toString(),
      departmentSettingsId: department ? department._id.toString() : null,
      shiftSettingsId: shift ? shift._id.toString() : null
    },
    settings: toAttendanceSettings(merged)
  };
};

export const listAttendanceSettingsForOrganization = async (
  organizationId: string
): Promise<AttendanceSettings[]> => {
  await ensureDefaultCompanyAttendanceSettings(organizationId);

  return AttendanceSettingsModel.find({ organization: organizationId })
    .sort({ scopeType: 1, scopeRef: 1 })
    .exec();
};
