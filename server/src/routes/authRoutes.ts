import { Router } from 'express';

import {
  forgotPassword,
  googleLogin,
  login,
  logout,
  me,
  refresh,
  register,
  resendVerification,
  resetPassword,
  verifyEmail
} from '../controllers/authController';
import { requireAuth } from '../middleware/authMiddleware';
import { resolveTenant } from '../middleware/tenantMiddleware';

const authRouter = Router();

authRouter.post('/register', resolveTenant, register);
authRouter.post('/login', resolveTenant, login);
authRouter.post('/google-login', resolveTenant, googleLogin);
authRouter.post('/forgot-password', resolveTenant, forgotPassword);
authRouter.post('/reset-password', resetPassword);
authRouter.post('/verify-email', verifyEmail);
authRouter.post('/resend-verification', resolveTenant, resendVerification);
authRouter.post('/refresh-token', resolveTenant, refresh);
authRouter.post('/logout', resolveTenant, logout);
authRouter.get('/me', resolveTenant, requireAuth, me);

export { authRouter };
