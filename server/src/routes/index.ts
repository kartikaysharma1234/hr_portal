import { Router } from 'express';

import { authRouter } from './authRoutes';
import { employeesRouter } from './employeesRoutes';
import { platformRouter } from './platformRoutes';
import { attendanceRouter } from './attendanceRoutes';

const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/employees', employeesRouter);
apiRouter.use('/platform', platformRouter);
apiRouter.use('/v1/attendance', attendanceRouter);

export { apiRouter };
