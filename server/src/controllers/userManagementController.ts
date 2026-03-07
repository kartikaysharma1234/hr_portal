import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import createHttpError, { isHttpError } from 'http-errors';
import mongoose from 'mongoose';

import { UserModel, type UserRole } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { parseHHmm } from '../utils/dateTimeUtils';

const managedRoleValues: UserRole[] = ['admin', 'hr', 'manager', 'employee'];
const defaultPunchWindow = {
  punchInStartTime: '09:00',
  punchInEndTime: '10:00',
  punchOutStartTime: '17:00',
  punchOutEndTime: '19:00'
} as const;

type ManagedPunchWindow = {
  punchInStartTime: string;
  punchInEndTime: string;
  punchOutStartTime: string;
  punchOutEndTime: string;
};

const requireTenantAndAdmin = (req: Request): { organizationId: string; userId: string } => {
  if (!req.tenant) {
    throw createHttpError(400, 'Tenant context is required');
  }

  if (!req.user) {
    throw createHttpError(401, 'Unauthorized');
  }

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createHttpError(403, 'Only organization admin can manage user accounts');
  }

  return {
    organizationId: req.tenant.organizationId,
    userId: req.user.sub,
  };
};

const normalizeRole = (rawRole: unknown): UserRole => {
  const role = String(rawRole ?? 'employee').trim().toLowerCase() as UserRole;
  if (!managedRoleValues.includes(role)) {
    throw createHttpError(400, 'role must be one of admin/hr/manager/employee');
  }

  return role;
};

const toMinutesOfDay = (hhmm: string): number => {
  const parsed = parseHHmm(hhmm);
  return parsed.hour * 60 + parsed.minute;
};

const normalizePunchWindow = (rawWindow: unknown): ManagedPunchWindow => {
  const source = typeof rawWindow === 'object' && rawWindow !== null ? rawWindow : {};

  const punchInStartTime = String(
    (source as Record<string, unknown>).punchInStartTime ?? defaultPunchWindow.punchInStartTime
  )
    .trim()
    .slice(0, 5);
  const punchInEndTime = String(
    (source as Record<string, unknown>).punchInEndTime ?? defaultPunchWindow.punchInEndTime
  )
    .trim()
    .slice(0, 5);
  const punchOutStartTime = String(
    (source as Record<string, unknown>).punchOutStartTime ?? defaultPunchWindow.punchOutStartTime
  )
    .trim()
    .slice(0, 5);
  const punchOutEndTime = String(
    (source as Record<string, unknown>).punchOutEndTime ?? defaultPunchWindow.punchOutEndTime
  )
    .trim()
    .slice(0, 5);

  try {
    const punchInStartMinutes = toMinutesOfDay(punchInStartTime);
    const punchInEndMinutes = toMinutesOfDay(punchInEndTime);
    const punchOutStartMinutes = toMinutesOfDay(punchOutStartTime);
    const punchOutEndMinutes = toMinutesOfDay(punchOutEndTime);

    if (punchInStartMinutes >= punchInEndMinutes) {
      throw createHttpError(400, 'Punch-in window must have start time before end time');
    }

    if (punchOutStartMinutes >= punchOutEndMinutes) {
      throw createHttpError(400, 'Punch-out window must have start time before end time');
    }
  } catch (error) {
    if (isHttpError(error)) {
      throw error;
    }

    throw createHttpError(400, 'Punch window time must be in HH:mm format');
  }

  return {
    punchInStartTime,
    punchInEndTime,
    punchOutStartTime,
    punchOutEndTime
  };
};

const mapUserRow = (user: {
  _id: unknown;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  authProvider: string;
  emailVerified: boolean;
  punchWindow?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
}) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    authProvider: user.authProvider,
    emailVerified: user.emailVerified,
    punchWindow: normalizePunchWindow(user.punchWindow),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndAdmin(req);

  const search = String(req.query.search ?? '').trim();
  const roleRaw = String(req.query.role ?? '').trim().toLowerCase();
  const isActiveRaw = String(req.query.isActive ?? '').trim().toLowerCase();

  const filters: Record<string, unknown> = {
    organization: organizationId,
  };

  if (roleRaw) {
    const role = normalizeRole(roleRaw);
    filters.role = role;
  }

  if (isActiveRaw === 'true') {
    filters.isActive = true;
  } else if (isActiveRaw === 'false') {
    filters.isActive = false;
  }

  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safe, 'i');
    filters.$or = [{ name: regex }, { email: regex }];
  }

  const users = await UserModel.find(filters)
    .sort({ createdAt: -1 })
    .select({ passwordHash: 0 })
    .lean();

  res.json({
    success: true,
    data: users.map(mapUserRow),
  });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndAdmin(req);

  const name = String(req.body.name ?? '').trim();
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '').trim();
  const role = normalizeRole(req.body.role);
  const punchWindow = normalizePunchWindow(req.body.punchWindow);

  if (!name || !email || !password) {
    throw createHttpError(400, 'name, email, password and role are required');
  }

  if (password.length < 8) {
    throw createHttpError(400, 'Password must be at least 8 characters');
  }

  const existing = await UserModel.findOne({
    organization: organizationId,
    email,
  }).lean();

  if (existing) {
    throw createHttpError(409, 'User already exists in this organization');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await UserModel.create({
    organization: organizationId,
    name,
    email,
    passwordHash,
    role,
    authProvider: 'local',
    emailVerified: true,
    punchWindow,
    isActive: true,
  });

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: mapUserRow(created),
  });
});

export const updateUserRole = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, userId } = requireTenantAndAdmin(req);

  const targetUserId = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw createHttpError(400, 'Invalid user id');
  }

  if (targetUserId === userId) {
    throw createHttpError(400, 'You cannot change your own role');
  }

  const role = normalizeRole(req.body.role);
  const user = await UserModel.findOne({
    _id: targetUserId,
    organization: organizationId,
  }).exec();

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  user.role = role;
  await user.save();

  res.json({
    success: true,
    message: 'User role updated successfully',
    data: mapUserRow(user),
  });
});

export const updateUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, userId } = requireTenantAndAdmin(req);

  const targetUserId = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw createHttpError(400, 'Invalid user id');
  }

  if (targetUserId === userId) {
    throw createHttpError(400, 'You cannot deactivate your own account');
  }

  const isActive = req.body.isActive;
  if (typeof isActive !== 'boolean') {
    throw createHttpError(400, 'isActive must be boolean');
  }

  const user = await UserModel.findOne({
    _id: targetUserId,
    organization: organizationId,
  }).exec();

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  user.isActive = isActive;
  await user.save();

  res.json({
    success: true,
    message: 'User status updated successfully',
    data: mapUserRow(user),
  });
});

export const updateUserPunchWindow = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = requireTenantAndAdmin(req);

  const targetUserId = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw createHttpError(400, 'Invalid user id');
  }

  const user = await UserModel.findOne({
    _id: targetUserId,
    organization: organizationId
  }).exec();

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  user.punchWindow = normalizePunchWindow(req.body.punchWindow);
  await user.save();

  res.json({
    success: true,
    message: 'User punch window updated successfully',
    data: mapUserRow(user)
  });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, userId } = requireTenantAndAdmin(req);

  const targetUserId = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw createHttpError(400, 'Invalid user id');
  }

  if (targetUserId === userId) {
    throw createHttpError(400, 'You cannot delete your own account');
  }

  const deleted = await UserModel.findOneAndDelete({
    _id: targetUserId,
    organization: organizationId
  }).lean();

  if (!deleted) {
    throw createHttpError(404, 'User not found');
  }

  res.json({
    success: true,
    message: 'User deleted successfully'
  });
});
