import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import createHttpError from 'http-errors';

import { OrganizationModel } from '../models/Organization';
import { UserModel } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';

const subdomainRegex = /^[a-z0-9-]{3,30}$/;

export const createOrganization = asyncHandler(async (req: Request, res: Response) => {
  const name = String(req.body.name ?? '').trim();
  const subdomain = String(req.body.subdomain ?? '').trim().toLowerCase();
  const adminName = String(req.body.adminName ?? '').trim();
  const adminEmail = String(req.body.adminEmail ?? '').trim().toLowerCase();
  const adminPassword = String(req.body.adminPassword ?? '').trim();

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
    subdomain
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

  res.status(201).json({
    success: true,
    data: {
      organization: {
        id: organization._id,
        name: organization.name,
        subdomain: organization.subdomain,
        isActive: organization.isActive
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
      createdAt: org.createdAt
    }))
  });
});
