import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sheetsService } from '../services/sheets.service.js';
import { recordFailedLogin, resetLoginAttempts } from '../middlewares/rateLimit.js';

const JWT_SECRET = process.env.JWT_SECRET || 'ace_sun_jwt_secret_dev_key_2026_xyz!@#';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'ace_sun_refresh_secret_dev_key_2026_abc$%^';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export async function login(req, res) {
  const { username, password } = req.body;
  const rateLimitKey = req.rateLimitKey;

  try {
    const accounts = await sheetsService.getAccounts();
    const account = accounts.find(
      a => a.username.toLowerCase() === username.trim().toLowerCase()
    );

    if (!account) {
      recordFailedLogin(rateLimitKey);
      return res.status(401).json({
        success: false,
        message: 'Tài khoản hoặc mật khẩu không chính xác!'
      });
    }

    if (account.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị khoá. Vui lòng liên hệ Leader!'
      });
    }

    const isValidPassword = await bcrypt.compare(password, account.passwordHash);
    if (!isValidPassword) {
      recordFailedLogin(rateLimitKey);
      return res.status(401).json({
        success: false,
        message: 'Tài khoản hoặc mật khẩu không chính xác!'
      });
    }

    // Reset bộ đếm số lần sai sau khi login thành công
    resetLoginAttempts(rateLimitKey);

    const payload = {
      username: account.username,
      tenIngame: account.tenIngame,
      role: account.role
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

    // Lưu refreshToken vào cookie httpOnly
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // Cập nhật lastLogin
    await sheetsService.updateLastLogin(account.username);

    // Ghi Log đăng nhập
    await sheetsService.appendLog({
      username: account.username,
      action: 'DANG_NHAP',
      target: 'Hệ thống',
      oldValue: '',
      newValue: 'Thành công'
    });

    return res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      accessToken,
      user: {
        username: account.username,
        tenIngame: account.tenIngame,
        role: account.role,
        canEditFund: account.role === 'Leader' ? true : Boolean(account.canEditFund)
      }
    });
  } catch (err) {
    console.error('Lỗi login:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi đăng nhập: ' + err.message
    });
  }
}

export async function refreshToken(req, res) {
  const token = req.cookies?.refreshToken;
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Không tìm thấy refresh token!'
    });
  }

  try {
    const decoded = jwt.verify(token, REFRESH_SECRET);
    const accounts = await sheetsService.getAccounts();
    const account = accounts.find(
      a => a.username.toLowerCase() === decoded.username.toLowerCase()
    );

    if (!account || account.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản không hợp lệ hoặc đã bị vô hiệu hoá!'
      });
    }

    const payload = {
      username: account.username,
      tenIngame: account.tenIngame,
      role: account.role
    };

    const newAccessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

    return res.json({
      success: true,
      accessToken: newAccessToken,
      user: {
        username: account.username,
        tenIngame: account.tenIngame,
        role: account.role,
        canEditFund: account.role === 'Leader' ? true : Boolean(account.canEditFund)
      }
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token đã hết hạn hoặc không hợp lệ!'
    });
  }
}

export function logout(req, res) {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  return res.json({
    success: true,
    message: 'Đăng xuất thành công!'
  });
}

export async function getMe(req, res) {
  return res.json({
    success: true,
    user: req.user
  });
}

export async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body;
  const username = req.user.username;

  try {
    const accounts = await sheetsService.getAccounts();
    const account = accounts.find(
      a => a.username.toLowerCase() === username.toLowerCase()
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản!'
      });
    }

    const isValid = await bcrypt.compare(oldPassword, account.passwordHash);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu hiện tại không chính xác!'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await sheetsService.resetPassword(username, newHash, username);

    return res.json({
      success: true,
      message: 'Đổi mật khẩu thành công!'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi đổi mật khẩu: ' + err.message
    });
  }
}
