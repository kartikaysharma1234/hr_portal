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

employeesRouter.get('/', requireRoles('admin', 'hr', 'manager'), listEmployees);
employeesRouter.get('/:id', requireRoles('admin', 'hr', 'manager'), getEmployeeById);
employeesRouter.post('/', requireRoles('admin', 'hr'), createEmployee);
employeesRouter.put('/:id', requireRoles('admin', 'hr', 'manager'), updateEmployee);
employeesRouter.delete('/:id', requireRoles('admin'), deleteEmployee);

export { employeesRouter };
