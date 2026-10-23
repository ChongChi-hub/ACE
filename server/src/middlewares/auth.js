import jwt from 'jsonwebtoken';
import { sheetsService } from '../services/sheets.service.js';

const JWT_SECRET = process.env.JWT_SECRET || 'ace_sun_jwt_secret_dev_key_2026_xyz!@#';

/**
 * Middleware xác thực Access Token và nạp thông tin quyền hạn mới nhất từ Google Sheet
 */
export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Yêu cầu đăng nhập để truy cập tài nguyên này!'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Luôn đọc lại thông tin mới nhất từ sheet Account để không tin cờ trong JWT (thu hồi quyền có hiệu lực ngay)
    const accounts = await sheetsService.getAccounts();
    const account = accounts.find(
      a => a.username.toLowerCase() === decoded.username.toLowerCase()
    );

    if (!account) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản không tồn tại hoặc đã bị xoá!'
      });
    }

    if (account.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị vô hiệu hoá. Vui lòng liên hệ Leader!'
      });
    }

    req.user = {
      username: account.username,
      tenIngame: account.tenIngame,
      role: account.role,
      canEditFund: account.role === 'Leader' ? true : Boolean(account.canEditFund)
    };

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại!'
    });
  }
}
