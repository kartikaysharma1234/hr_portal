import { Router } from 'express';

import {
  createEmployee,
  deleteEmployee,
  getEmployeeById,
  listEmployees,
  updateEmployee
} from '../controllers/employeeController';
import { requireAuth, requireRoles } from '../middleware/authMiddleware';
import { resolveTenant } from '../middleware/tenantMiddleware';

const employeesRouter = Router();

employeesRouter.use(resolveTenant, requireAuth);

employeesRouter.get('/', requireRoles('admin', 'manager'), listEmployees);
employeesRouter.get('/:id', requireRoles('admin', 'manager'), getEmployeeById);
employeesRouter.post('/', requireRoles('admin'), createEmployee);
employeesRouter.put('/:id', requireRoles('admin', 'manager'), updateEmployee);
employeesRouter.delete('/:id', requireRoles('admin'), deleteEmployee);

export { employeesRouter };
