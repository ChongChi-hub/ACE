import { z } from 'zod';
import { VALID_ROLES } from '../config/permissions.js';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username không được để trống'),
  password: z.string().min(1, 'Mật khẩu không được để trống')
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Mật khẩu hiện tại không được để trống'),
  newPassword: z.string().min(8, 'Mật khẩu mới phải có tối thiểu 8 ký tự')
});

export const addMemberSchema = z.object({
  tenIngame: z.string().min(1, 'Tên Ingame không được để trống'),
  gameId: z.string().regex(/^\d*$/, 'ID game chỉ được chứa chữ số').optional().or(z.literal('')),
  facebookName: z.string().optional(),
  facebookUrl: z.string().url('Link Facebook phải là URL hợp lệ').optional().or(z.literal('')),
  chucVu: z.enum(VALID_ROLES).default('Thành viên')
});

export const editMemberSchema = z.object({
  expectedIngame: z.string().optional(),
  expectedGameId: z.string().optional(),
  tenIngame: z.string().min(1, 'Tên Ingame không được để trống').optional(),
  gameId: z.string().regex(/^\d*$/, 'ID game chỉ được chứa chữ số').optional().or(z.literal('')),
  facebookName: z.string().optional(),
  facebookUrl: z.string().url('Link Facebook phải là URL hợp lệ').optional().or(z.literal('')),
  chucVu: z.enum(VALID_ROLES).optional()
}).passthrough();

export const deleteMemberSchema = z.object({
  expectedIngame: z.string().optional()
});

export const recordFundSchema = z.object({
  rowIndex: z.number().int().positive('Chỉ số dòng không hợp lệ'),
  field: z.string().min(1, 'Tên cột quỹ không được để trống'),
  amount: z.number().min(0, 'Số tiền không được âm')
});

export const createAccountSchema = z.object({
  username: z.string().min(3, 'Username tối thiểu 3 ký tự').regex(/^[a-zA-Z0-9_.-]+$/, 'Username chỉ chứa chữ, số, gạch dưới, chấm'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
  tenIngame: z.string().min(1, 'Tên Ingame liên kết không được để trống'),
  canEditFund: z.boolean().default(false)
});

export const updateFundPermissionSchema = z.object({
  canEditFund: z.boolean()
});

export const updateAccountStatusSchema = z.object({
  status: z.enum(['active', 'disabled'])
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Mật khẩu mới phải có tối thiểu 8 ký tự')
});
