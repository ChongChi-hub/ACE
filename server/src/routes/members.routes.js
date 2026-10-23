import { Router } from 'express';
import { getMembers, addMember, editMember, deleteMember } from '../controllers/members.controller.js';
import { authenticateToken } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { validateBody } from '../middlewares/validate.js';
import { addMemberSchema, editMemberSchema, deleteMemberSchema } from '../schemas/index.js';

const router = Router();

// Mọi người trong ban quản trị đều được xem danh sách thành viên
router.get('/', authenticateToken, getMembers);

// Thêm, sửa, xoá thành viên: Leader và Co-Leader
router.post(
  '/',
  authenticateToken,
  requireRole(['Leader', 'Co-Leader']),
  validateBody(addMemberSchema),
  addMember
);

router.put(
  '/:rowIndex',
  authenticateToken,
  requireRole(['Leader', 'Co-Leader']),
  validateBody(editMemberSchema),
  editMember
);

router.delete(
  '/:rowIndex',
  authenticateToken,
  requireRole(['Leader', 'Co-Leader']),
  validateBody(deleteMemberSchema),
  deleteMember
);

export default router;
