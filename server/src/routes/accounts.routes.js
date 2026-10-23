import { Router } from 'express';
import {
  getAccounts,
  createAccount,
  updateFundPermission,
  updateAccountStatus,
  resetPassword,
  deleteAccount
} from '../controllers/accounts.controller.js';
import { authenticateToken } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { validateBody } from '../middlewares/validate.js';
import {
  createAccountSchema,
  updateFundPermissionSchema,
  updateAccountStatusSchema,
  resetPasswordSchema
} from '../schemas/index.js';

const router = Router();

// Tất cả thao tác tài khoản chỉ dành riêng cho Leader
router.use(authenticateToken, requireRole('Leader'));

router.get('/', getAccounts);
router.post('/', validateBody(createAccountSchema), createAccount);
router.patch('/:username/fund-permission', validateBody(updateFundPermissionSchema), updateFundPermission);
router.patch('/:username/status', validateBody(updateAccountStatusSchema), updateAccountStatus);
router.post('/:username/reset-password', validateBody(resetPasswordSchema), resetPassword);
router.delete('/:username', deleteAccount);

export default router;
