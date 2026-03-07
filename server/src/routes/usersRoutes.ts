import { Router } from 'express';

import {
  createUser,
  deleteUser,
  listUsers,
  updateUserPunchWindow,
  updateUserRole,
  updateUserStatus,
} from '../controllers/userManagementController';
import { requireAuth, requireRoles } from '../middleware/authMiddleware';
import { resolveTenant } from '../middleware/tenantMiddleware';

const usersRouter = Router();

usersRouter.use(resolveTenant, requireAuth, requireRoles('admin', 'super_admin'));

usersRouter.get('/', listUsers);
usersRouter.post('/', createUser);
usersRouter.patch('/:id/role', updateUserRole);
usersRouter.patch('/:id/punch-window', updateUserPunchWindow);
usersRouter.patch('/:id/status', updateUserStatus);
usersRouter.delete('/:id', deleteUser);

export { usersRouter };
