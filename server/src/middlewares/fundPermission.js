import { hasFundEditPermission } from '../config/permissions.js';
import { sheetsService } from '../services/sheets.service.js';

/**
 * Middleware kiểm tra quyền ghi quỹ:
 * - Leader: luôn được phép
 * - Co-Leader / QTV: chỉ khi canEditFund === true
 * - Đọc lại trạng thái mới nhất từ sheet Account để đảm bảo khi Leader thu hồi quyền thì chặn NGAY LẬP TỨC
 */
export async function requireFundPermission(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Chưa xác thực người dùng!'
    });
  }

  // Leader luôn có quyền
  if (req.user.role === 'Leader') {
    return next();
  }

  try {
    // Đọc trực tiếp cờ mới nhất từ sheet Account
    const accounts = await sheetsService.getAccounts();
    const account = accounts.find(
      a => a.username.toLowerCase() === req.user.username.toLowerCase()
    );

    if (!account || !account.canEditFund) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền ghi quỹ! Quyền này phải do Leader cấp.'
      });
    }

    req.user.canEditFund = true;
    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Không thể xác minh quyền ghi quỹ: ' + err.message
    });
  }
}
