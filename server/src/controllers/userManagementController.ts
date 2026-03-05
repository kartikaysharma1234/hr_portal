import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import createHttpError from 'http-errors';
import mongoose from 'mongoose';

import { UserModel, type UserRole } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';

const managedRoleValues: UserRole[] = ['admin', 'hr', 'manager', 'employee'];

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

const mapUserRow = (user: {
  _id: unknown;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  authProvider: string;
  emailVerified: boolean;
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
