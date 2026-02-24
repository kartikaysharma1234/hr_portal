import app from './app';
import { connectDatabase } from './config/db';
import { env } from './config/env';

const bootstrap = async (): Promise<void> => {
  await connectDatabase();

  app.listen(env.port, () => {
    console.log(`[server] listening on port ${env.port}`);
  });
};

bootstrap().catch((error: unknown) => {
  console.error('[server] startup failed', error);
  process.exit(1);
});
