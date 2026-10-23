import { Router } from 'express';
import { recordFund } from '../controllers/fund.controller.js';
import { authenticateToken } from '../middlewares/auth.js';
import { requireFundPermission } from '../middlewares/fundPermission.js';
import { validateBody } from '../middlewares/validate.js';
import { recordFundSchema } from '../schemas/index.js';

const router = Router();

// Ghi nhận quỹ: bắt buộc có quyền ghi quỹ (Leader hoặc canEditFund=true)
router.post('/record', authenticateToken, requireFundPermission, validateBody(recordFundSchema), recordFund);

export default router;
