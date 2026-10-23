import { Router } from 'express';
import { getLogs } from '../controllers/logs.controller.js';
import { authenticateToken } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();

// Xem nhật ký hệ thống: chỉ Leader
router.get('/', authenticateToken, requireRole('Leader'), getLogs);

export default router;
