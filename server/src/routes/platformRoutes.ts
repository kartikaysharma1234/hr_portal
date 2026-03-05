import { Router } from 'express';

import { loginSuperAdmin } from '../controllers/platformAuthController';
import {
  createOrganization,
  getOrganizationSettings,
  getOrganizationOverview,
  deleteOrganization,
  listOrganizations,
  updateOrganizationStatus,
  updateOrganizationSubscription,
  updateOrganizationSettings
} from '../controllers/platformController';
import { requirePlatformAccess } from '../middleware/platformAuth';

const platformRouter = Router();

platformRouter.post('/auth/login', loginSuperAdmin);
platformRouter.post('/organizations', requirePlatformAccess, createOrganization);
platformRouter.get('/organizations', requirePlatformAccess, listOrganizations);
platformRouter.delete('/organizations/:id', requirePlatformAccess, deleteOrganization);
platformRouter.patch('/organizations/:id/status', requirePlatformAccess, updateOrganizationStatus);
platformRouter.patch(
  '/organizations/:id/subscription',
  requirePlatformAccess,
  updateOrganizationSubscription
);
platformRouter.get('/organizations/:id/overview', requirePlatformAccess, getOrganizationOverview);
platformRouter.get('/organizations/:id/settings', requirePlatformAccess, getOrganizationSettings);
platformRouter.put('/organizations/:id/settings', requirePlatformAccess, updateOrganizationSettings);

export { platformRouter };
