import { Router } from 'express';

import { loginSuperAdmin } from '../controllers/platformAuthController';
import {
  createOrganization,
  getOrganizationSettings,
  deleteOrganization,
  listOrganizations,
  updateOrganizationSettings
} from '../controllers/platformController';
import { requirePlatformAccess } from '../middleware/platformAuth';

const platformRouter = Router();

platformRouter.post('/auth/login', loginSuperAdmin);
platformRouter.post('/organizations', requirePlatformAccess, createOrganization);
platformRouter.get('/organizations', requirePlatformAccess, listOrganizations);
platformRouter.delete('/organizations/:id', requirePlatformAccess, deleteOrganization);
platformRouter.get('/organizations/:id/settings', requirePlatformAccess, getOrganizationSettings);
platformRouter.put('/organizations/:id/settings', requirePlatformAccess, updateOrganizationSettings);

export { platformRouter };
