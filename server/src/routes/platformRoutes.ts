import { Router } from 'express';

import { loginSuperAdmin } from '../controllers/platformAuthController';
import { createOrganization, listOrganizations } from '../controllers/platformController';
import { requirePlatformAccess } from '../middleware/platformAuth';

const platformRouter = Router();

platformRouter.post('/auth/login', loginSuperAdmin);
platformRouter.post('/organizations', requirePlatformAccess, createOrganization);
platformRouter.get('/organizations', requirePlatformAccess, listOrganizations);

export { platformRouter };
