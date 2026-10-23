import { Router } from 'express';
import { login, refreshToken, logout, getMe, changePassword } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middlewares/auth.js';
import { loginRateLimiter } from '../middlewares/rateLimit.js';
import { validateBody } from '../middlewares/validate.js';
import { loginSchema, changePasswordSchema } from '../schemas/index.js';

const router = Router();

router.post('/login', loginRateLimiter, validateBody(loginSchema), login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', authenticateToken, getMe);
router.post('/change-password', authenticateToken, validateBody(changePasswordSchema), changePassword);

export default router;
