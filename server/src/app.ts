import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware';
import { env } from './config/env';

const app = express();

app.set('trust proxy', true);
app.use(helmet());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(cookieParser());
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'HRMS API is running'
  });
});

app.use('/api', apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
