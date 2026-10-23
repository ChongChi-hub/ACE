import { sheetsService } from '../services/sheets.service.js';
import { canDeleteMember, hasFundEditPermission } from '../config/permissions.js';

export async function getMembers(req, res) {
  const year = req.query.year || '2026';

  try {
    const [sheetData, availableYears] = await Promise.all([
      sheetsService.getYearSheetData(year),
      sheetsService.getAvailableYears()
    ]);

    return res.json({
      success: true,
      data: {
        year: sheetData.year,
        availableYears,
        stats: sheetData.stats,
        totalRow: sheetData.totalRow,
        members: sheetData.members
      }
    });
  } catch (err) {
    console.error('Lỗi getMembers:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: 'Không thể đọc dữ liệu thành viên: ' + err.message
    });
  }
}

export async function addMember(req, res) {
  const year = req.query.year || '2026';
  const { tenIngame, gameId, facebookName, facebookUrl, chucVu } = req.body;

  try {
    const result = await sheetsService.addMember(
      year,
      {
        tenIngame,
        gameId,
        facebookName,
        facebookUrl,
        chucVu: chucVu || 'Thành viên'
      },
      req.user.username
    );

    return res.status(201).json({
      success: true,
      message: `Đã thêm thành viên "${tenIngame}" thành công!`,
      data: result
    });
  } catch (err) {
    console.error('Lỗi addMember:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });
  }
}

export async function editMember(req, res) {
  const year = req.query.year || '2026';
  const rowIndex = parseInt(req.params.rowIndex, 10);
  const clientData = { ...req.body };

  // Nếu người gọi không có quyền ghi quỹ thì loại bỏ toàn bộ các field tiền
  const canEditFund = hasFundEditPermission(req.user);
  if (!canEditFund) {
    delete clientData.ungHo;
    delete clientData.tienPhat;
    delete clientData.ttv;
    for (let m = 1; m <= 12; m++) {
      delete clientData[`month_${m}`];
    }
  }

  try {
    const result = await sheetsService.editMember(year, rowIndex, clientData, req.user);
    return res.json({
      success: true,
      message: 'Cập nhật thông tin thành viên thành công!',
      data: result
    });
  } catch (err) {
    console.error('Lỗi editMember:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });
  }
}

export async function deleteMember(req, res) {
  const year = req.query.year || '2026';
  const rowIndex = parseInt(req.params.rowIndex, 10);
  const { expectedIngame } = req.body;

  try {
    const result = await sheetsService.deleteMember(
      year,
      rowIndex,
      { expectedIngame },
      req.user
    );

    return res.json({
      success: true,
      message: `Đã xoá thành viên "${result.deletedMember}" thành công!`,
      data: result
    });
  } catch (err) {
    console.error('Lỗi deleteMember:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });
  }
}
