import type { NextFunction, Request, Response } from 'express';
import createHttpError from 'http-errors';

import { OrganizationModel } from '../models/Organization';
import { asyncHandler } from '../utils/asyncHandler';
import { extractSubdomain } from '../utils/subdomain';
import { env } from '../config/env';

const getHostFromRequest = (req: Request): string | null => {
  const forwardedHost = req.headers['x-forwarded-host'];
  const hostValue = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost ?? req.headers.host;

  if (!hostValue) {
    return null;
  }

  return hostValue.split(',')[0].trim().toLowerCase();
};

export const resolveTenant = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const tenantFromHeader = req.header('x-tenant-subdomain')?.trim().toLowerCase() || null;

  let subdomain = tenantFromHeader;
  if (!subdomain) {
    const host = getHostFromRequest(req);
    if (host) {
      subdomain = extractSubdomain(host, env.allowedRootDomain);
    }
  }

  if (!subdomain) {
    throw createHttpError(
      400,
      `Unable to resolve tenant. Provide x-tenant-subdomain or use {tenant}.${env.allowedRootDomain}`
    );
  }

  const organization = await OrganizationModel.findOne({ subdomain, isActive: true }).lean();
  if (!organization) {
    throw createHttpError(404, `No active organization found for subdomain "${subdomain}"`);
  }

  req.tenant = {
    subdomain,
    organizationId: organization._id.toString(),
    organizationName: organization.name
  };

  next();
});
