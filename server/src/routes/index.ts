import { Router } from 'express';

import { authRouter } from './authRoutes';
import { employeesRouter } from './employeesRoutes';
import { platformRouter } from './platformRoutes';

const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/employees', employeesRouter);
apiRouter.use('/platform', platformRouter);

export { apiRouter };
