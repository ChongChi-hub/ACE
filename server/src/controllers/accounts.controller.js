import bcrypt from 'bcryptjs';
import { sheetsService } from '../services/sheets.service.js';
import { ADMIN_ROLES } from '../config/permissions.js';

export async function getAccounts(req, res) {
  try {
    const year = req.query.year || '2026';
    const accounts = await sheetsService.getAccounts(year);

    // Bỏ passwordHash khi trả về client
    const safeAccounts = accounts.map(({ passwordHash, ...rest }) => rest);

    return res.json({
      success: true,
      data: safeAccounts
    });
  } catch (err) {
    console.error('Lỗi getAccounts:', err);
    return res.status(500).json({
      success: false,
      message: 'Không thể đọc danh sách tài khoản: ' + err.message
    });
  }
}

export async function createAccount(req, res) {
  const { username, password, tenIngame, canEditFund } = req.body;
  const year = req.query.year || '2026';

  try {
    // 1. Kiểm tra thành viên có thuộc ban quản trị không (Leader, Co-Leader, QTV)
    const yearData = await sheetsService.getYearSheetData(year);
    const member = yearData.members.find(
      m => m.tenIngame.trim().toLowerCase() === tenIngame.trim().toLowerCase()
    );

    if (!member) {
      return res.status(400).json({
        success: false,
        message: `Không tìm thấy thành viên "${tenIngame}" trong sheet năm ${year}!`
      });
    }

    if (!ADMIN_ROLES.includes(member.chucVu)) {
      return res.status(400).json({
        success: false,
        message: `Chỉ thành viên thuộc Ban quản trị (Leader, Co-Leader, QTV) mới được cấp tài khoản! Chức vụ hiện tại của ${tenIngame} là "${member.chucVu}".`
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await sheetsService.createAccount(
      {
        username,
        passwordHash,
        tenIngame: member.tenIngame,
        status: 'active',
        canEditFund: member.chucVu === 'Leader' ? true : Boolean(canEditFund)
      },
      req.user.username
    );

    return res.status(201).json({
      success: true,
      message: `Đã tạo tài khoản cho "${tenIngame}" (${username}) thành công!`,
      data: result
    });
  } catch (err) {
    console.error('Lỗi createAccount:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });
  }
}

export async function updateFundPermission(req, res) {
  const { username } = req.params;
  const { canEditFund } = req.body;

  try {
    const result = await sheetsService.updateFundPermission(
      username,
      Boolean(canEditFund),
      req.user.username
    );

    return res.json({
      success: true,
      message: `Đã ${canEditFund ? 'cấp' : 'thu hồi'} quyền ghi quỹ cho tài khoản "${username}" thành công!`,
      data: result
    });
  } catch (err) {
    console.error('Lỗi updateFundPermission:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });
  }
}

export async function updateAccountStatus(req, res) {
  const { username } = req.params;
  const { status } = req.body;

  if (!['active', 'disabled'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Trạng thái chỉ có thể là "active" hoặc "disabled"!'
    });
  }

  try {
    const result = await sheetsService.updateAccountStatus(
      username,
      status,
      req.user.username
    );

    return res.json({
      success: true,
      message: `Đã cập nhật trạng thái tài khoản "${username}" thành "${status}"!`,
      data: result
    });
  } catch (err) {
    console.error('Lỗi updateAccountStatus:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });
  }
}

export async function resetPassword(req, res) {
  const { username } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Mật khẩu mới phải có tối thiểu 8 ký tự!'
    });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    await sheetsService.resetPassword(username, newPasswordHash, req.user.username);

    return res.json({
      success: true,
      message: `Đã reset mật khẩu cho tài khoản "${username}" thành công!`
    });
  } catch (err) {
    console.error('Lỗi resetPassword:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });
  }
}

export async function deleteAccount(req, res) {
  const { username } = req.params;

  try {
    await sheetsService.deleteAccount(username, req.user.username);

    return res.json({
      success: true,
      message: `Đã xoá tài khoản "${username}" thành công!`
    });
  } catch (err) {
    console.error('Lỗi deleteAccount:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });
  }
}
