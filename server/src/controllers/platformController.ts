import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import createHttpError from 'http-errors';
import mongoose from 'mongoose';

import { getDefaultAttendanceSettings } from '../config/defaultAttendanceSettings';
import { AttendanceSettingsModel } from '../models/AttendanceSettings';
import { getDefaultOrganizationSettings } from '../config/defaultOrganizationSettings';
import { AuthActionTokenModel } from '../models/AuthActionToken';
import { AttendanceLeaveLedgerModel } from '../models/AttendanceLeaveLedger';
import { AttendanceLeaveRequestModel } from '../models/AttendanceLeaveRequest';
import { AttendancePunchModel } from '../models/AttendancePunch';
import { AttendanceRegularizationModel } from '../models/AttendanceRegularization';
import { AppreciationRequestModel } from '../models/AppreciationRequest';
import { EmployeeModel } from '../models/Employee';
import { HelpDeskRequestModel } from '../models/HelpDeskRequest';
import { LeaveEncashmentRequestModel } from '../models/LeaveEncashmentRequest';
import { OrganizationModel } from '../models/Organization';
import { OfficeLocationModel } from '../models/OfficeLocation';
import { RefreshTokenModel } from '../models/RefreshToken';
import { ResignationRequestModel } from '../models/ResignationRequest';
import { UserModel } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { deepMerge, isRecord } from '../utils/objectMerge';

const subdomainRegex = /^[a-z0-9-]{3,30}$/;
const allowedLogoPrefixRegex = /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/i;
const maxLogoDataUrlBytes = 2 * 1024 * 1024;
const subscriptionPlanValues = ['Free', 'Starter', 'Growth', 'Enterprise'] as const;

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

const resolveSubscriptionSnapshot = (settingsRaw: unknown): {
  currentPlan: string;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  employeeLimit: number;
} => {
  const fallbackSettings = getDefaultOrganizationSettings();
  const fallbackCompany = isRecord(fallbackSettings.company) ? fallbackSettings.company : {};
  const fallbackSubscription = isRecord(fallbackCompany.subscriptionAndLicensing)
    ? fallbackCompany.subscriptionAndLicensing
    : {};

  const settings = isRecord(settingsRaw) ? settingsRaw : {};
  const company = isRecord(settings.company) ? settings.company : {};
  const subscription = isRecord(company.subscriptionAndLicensing)
    ? company.subscriptionAndLicensing
    : {};

  const currentPlan = String(
    subscription.currentPlan ?? fallbackSubscription.currentPlan ?? 'Free'
  ).trim();
  const subscriptionStartDate = String(
    subscription.subscriptionStartDate ?? fallbackSubscription.subscriptionStartDate ?? ''
  ).trim();
  const subscriptionEndDate = String(
    subscription.subscriptionEndDate ?? fallbackSubscription.subscriptionEndDate ?? ''
  ).trim();
  const employeeLimit = Number(
    subscription.employeeLimit ?? fallbackSubscription.employeeLimit ?? 0
  );

  return {
    currentPlan,
    subscriptionStartDate,
    subscriptionEndDate,
    employeeLimit: Number.isFinite(employeeLimit) && employeeLimit >= 0 ? employeeLimit : 0,
  };
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
    data: organizations.map((org) => {
      const subscription = resolveSubscriptionSnapshot(org.settings);
      return {
        id: org._id,
        name: org.name,
        subdomain: org.subdomain,
        isActive: org.isActive,
        logoDataUrl: org.logoDataUrl ?? '',
        createdAt: org.createdAt,
        currentPlan: subscription.currentPlan,
        subscriptionStartDate: subscription.subscriptionStartDate,
        subscriptionEndDate: subscription.subscriptionEndDate,
        employeeLimit: subscription.employeeLimit,
      };
    })
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
    AttendanceLeaveRequestModel.deleteMany({ organization: organizationId }),
    AttendancePunchModel.deleteMany({ organization: organizationId }),
    AttendanceRegularizationModel.deleteMany({ organization: organizationId }),
    HelpDeskRequestModel.deleteMany({ organization: organizationId }),
    AppreciationRequestModel.deleteMany({ organization: organizationId }),
    ResignationRequestModel.deleteMany({ organization: organizationId }),
    LeaveEncashmentRequestModel.deleteMany({ organization: organizationId }),
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

export const updateOrganizationStatus = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(organizationId)) {
    throw createHttpError(400, 'Invalid organization id');
  }

  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    throw createHttpError(400, 'isActive must be boolean');
  }

  const organization = await OrganizationModel.findById(organizationId).exec();
  if (!organization) {
    throw createHttpError(404, 'Organization not found');
  }

  organization.isActive = isActive;
  await organization.save();

  res.json({
    success: true,
    message: isActive
      ? `Organization "${organization.name}" approved and enabled`
      : `Organization "${organization.name}" disabled`,
    data: {
      id: organization._id,
      name: organization.name,
      isActive: organization.isActive,
    },
  });
});

export const updateOrganizationSubscription = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(organizationId)) {
    throw createHttpError(400, 'Invalid organization id');
  }

  const organization = await OrganizationModel.findById(organizationId).exec();
  if (!organization) {
    throw createHttpError(404, 'Organization not found');
  }

  const patch: Record<string, unknown> = {};

  if (req.body.currentPlan !== undefined) {
    const currentPlan = String(req.body.currentPlan).trim();
    if (!(subscriptionPlanValues as readonly string[]).includes(currentPlan)) {
      throw createHttpError(400, 'currentPlan must be Free/Starter/Growth/Enterprise');
    }
    patch.currentPlan = currentPlan;
  }

  if (req.body.subscriptionStartDate !== undefined) {
    patch.subscriptionStartDate = String(req.body.subscriptionStartDate).trim();
  }

  if (req.body.subscriptionEndDate !== undefined) {
    patch.subscriptionEndDate = String(req.body.subscriptionEndDate).trim();
  }

  if (req.body.employeeLimit !== undefined) {
    const employeeLimit = Number(req.body.employeeLimit);
    if (!Number.isFinite(employeeLimit) || employeeLimit < 0) {
      throw createHttpError(400, 'employeeLimit must be a non-negative number');
    }
    patch.employeeLimit = employeeLimit;
  }

  if (!Object.keys(patch).length) {
    throw createHttpError(
      400,
      'At least one field is required: currentPlan/subscriptionStartDate/subscriptionEndDate/employeeLimit'
    );
  }

  const currentSettings = isRecord(organization.settings)
    ? (organization.settings as Record<string, unknown>)
    : getDefaultOrganizationSettings();

  organization.settings = deepMerge(currentSettings, {
    company: {
      subscriptionAndLicensing: patch,
    },
  });

  await organization.save();

  const subscription = resolveSubscriptionSnapshot(organization.settings);
  res.json({
    success: true,
    message: 'Organization subscription updated successfully',
    data: {
      id: organization._id,
      ...subscription,
    },
  });
});

export const getOrganizationOverview = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(organizationId)) {
    throw createHttpError(400, 'Invalid organization id');
  }

  const [organization, userCount, activeUserCount, employeeCount, roleBreakdown] =
    await Promise.all([
      OrganizationModel.findById(organizationId).lean(),
      UserModel.countDocuments({ organization: organizationId }),
      UserModel.countDocuments({ organization: organizationId, isActive: true }),
      EmployeeModel.countDocuments({ organization: organizationId }),
      UserModel.aggregate<{ _id: string; count: number }>([
        { $match: { organization: new mongoose.Types.ObjectId(organizationId) } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
    ]);

  if (!organization) {
    throw createHttpError(404, 'Organization not found');
  }

  const roleCounts = {
    admin: 0,
    hr: 0,
    manager: 0,
    employee: 0,
  };

  for (const row of roleBreakdown) {
    if (row._id in roleCounts) {
      roleCounts[row._id as keyof typeof roleCounts] = row.count;
    }
  }

  const subscription = resolveSubscriptionSnapshot(organization.settings);

  res.json({
    success: true,
    data: {
      id: organization._id,
      name: organization.name,
      subdomain: organization.subdomain,
      isActive: organization.isActive,
      currentPlan: subscription.currentPlan,
      subscriptionStartDate: subscription.subscriptionStartDate,
      subscriptionEndDate: subscription.subscriptionEndDate,
      employeeLimit: subscription.employeeLimit,
      metrics: {
        totalUsers: userCount,
        activeUsers: activeUserCount,
        employees: employeeCount,
      },
      roleCounts,
    },
  });
});
