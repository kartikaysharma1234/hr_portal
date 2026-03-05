import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import createHttpError from 'http-errors';
import mongoose from 'mongoose';

import { getDefaultAttendanceSettings } from '../config/defaultAttendanceSettings';
import { AttendanceSettingsModel } from '../models/AttendanceSettings';
import { getDefaultOrganizationSettings } from '../config/defaultOrganizationSettings';
import { AuthActionTokenModel } from '../models/AuthActionToken';
import { AttendanceLeaveLedgerModel } from '../models/AttendanceLeaveLedger';
import { AttendancePunchModel } from '../models/AttendancePunch';
import { AttendanceRegularizationModel } from '../models/AttendanceRegularization';
import { EmployeeModel } from '../models/Employee';
import { OrganizationModel } from '../models/Organization';
import { OfficeLocationModel } from '../models/OfficeLocation';
import { RefreshTokenModel } from '../models/RefreshToken';
import { UserModel } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { deepMerge, isRecord } from '../utils/objectMerge';

const subdomainRegex = /^[a-z0-9-]{3,30}$/;
const allowedLogoPrefixRegex = /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/i;
const maxLogoDataUrlBytes = 2 * 1024 * 1024;

const validateAndNormalizeLogo = (rawLogo: unknown): string => {
  const logoDataUrl = String(rawLogo ?? '').trim();
  if (!logoDataUrl) {
    return '';
  }

  if (!allowedLogoPrefixRegex.test(logoDataUrl)) {
    throw createHttpError(400, 'logo must be png, jpg, jpeg, webp, or svg image');
  }

  const base64Part = logoDataUrl.split(',')[1] ?? '';
  const bytes = Math.ceil((base64Part.length * 3) / 4);
  if (bytes > maxLogoDataUrlBytes) {
    throw createHttpError(400, 'logo size must be less than 2MB');
  }

  return logoDataUrl;
};

export const createOrganization = asyncHandler(async (req: Request, res: Response) => {
  const name = String(req.body.name ?? '').trim();
  const subdomain = String(req.body.subdomain ?? '').trim().toLowerCase();
  const adminName = String(req.body.adminName ?? '').trim();
  const adminEmail = String(req.body.adminEmail ?? '').trim().toLowerCase();
  const adminPassword = String(req.body.adminPassword ?? '').trim();
  const logoDataUrl = validateAndNormalizeLogo(req.body.logoDataUrl);

  if (!name || !subdomain || !adminName || !adminEmail || !adminPassword) {
    throw createHttpError(400, 'name, subdomain, adminName, adminEmail and adminPassword are required');
  }

  if (!subdomainRegex.test(subdomain)) {
    throw createHttpError(400, 'subdomain must be 3-30 chars and contain only lowercase letters, numbers, hyphen');
  }

  const existingOrg = await OrganizationModel.findOne({ subdomain }).lean();
  if (existingOrg) {
    throw createHttpError(409, 'Subdomain already in use');
  }

  const organization = await OrganizationModel.create({
    name,
    subdomain,
    logoDataUrl,
    settings: getDefaultOrganizationSettings()
  });

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const adminUser = await UserModel.create({
    organization: organization._id,
    name: adminName,
    email: adminEmail,
    passwordHash,
    role: 'admin',
    authProvider: 'local',
    emailVerified: true
  });

  await AttendanceSettingsModel.create(getDefaultAttendanceSettings(organization._id.toString()));

  res.status(201).json({
    success: true,
    data: {
      organization: {
        id: organization._id,
        name: organization.name,
        subdomain: organization.subdomain,
        isActive: organization.isActive,
        logoDataUrl: organization.logoDataUrl
      },
      adminUser: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role
      }
    }
  });
});

export const listOrganizations = asyncHandler(async (_req: Request, res: Response) => {
  const organizations = await OrganizationModel.find().sort({ createdAt: -1 }).lean();

  res.json({
    success: true,
    data: organizations.map((org) => ({
      id: org._id,
      name: org.name,
      subdomain: org.subdomain,
      isActive: org.isActive,
      logoDataUrl: org.logoDataUrl ?? '',
      createdAt: org.createdAt
    }))
  });
});

export const deleteOrganization = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(organizationId)) {
    throw createHttpError(400, 'Invalid organization id');
  }

  const organization = await OrganizationModel.findById(organizationId).lean();
  if (!organization) {
    throw createHttpError(404, 'Organization not found');
  }

  await Promise.all([
    OrganizationModel.deleteOne({ _id: organizationId }),
    UserModel.deleteMany({ organization: organizationId }),
    EmployeeModel.deleteMany({ organization: organizationId }),
    AttendanceSettingsModel.deleteMany({ organization: organizationId }),
    OfficeLocationModel.deleteMany({ organization: organizationId }),
    AttendanceLeaveLedgerModel.deleteMany({ organization: organizationId }),
    AttendancePunchModel.deleteMany({ organization: organizationId }),
    AttendanceRegularizationModel.deleteMany({ organization: organizationId }),
    RefreshTokenModel.deleteMany({ organization: organizationId }),
    AuthActionTokenModel.deleteMany({ organization: organizationId })
  ]);

  res.json({
    success: true,
    message: `Organization "${organization.name}" deleted`
  });
});

export const getOrganizationSettings = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(organizationId)) {
    throw createHttpError(400, 'Invalid organization id');
  }

  const organization = await OrganizationModel.findById(organizationId).lean();
  if (!organization) {
    throw createHttpError(404, 'Organization not found');
  }

  res.json({
    success: true,
    data: {
      id: organization._id,
      name: organization.name,
      subdomain: organization.subdomain,
      logoDataUrl: organization.logoDataUrl ?? '',
      settings: organization.settings ?? getDefaultOrganizationSettings()
    }
  });
});

export const updateOrganizationSettings = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(organizationId)) {
    throw createHttpError(400, 'Invalid organization id');
  }

  const settingsPatch = req.body.settings;
  if (!isRecord(settingsPatch)) {
    throw createHttpError(400, 'settings object is required');
  }

  const organization = await OrganizationModel.findById(organizationId).exec();
  if (!organization) {
    throw createHttpError(404, 'Organization not found');
  }

  const currentSettings = isRecord(organization.settings)
    ? (organization.settings as Record<string, unknown>)
    : getDefaultOrganizationSettings();

  organization.settings = deepMerge(currentSettings, settingsPatch);
  await organization.save();

  res.json({
    success: true,
    message: 'Organization settings updated successfully',
    data: {
      id: organization._id,
      settings: organization.settings
    }
  });
});
