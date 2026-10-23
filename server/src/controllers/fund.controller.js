import { sheetsService } from '../services/sheets.service.js';

export async function recordFund(req, res) {
  const year = req.query.year || req.body.year || '2026';
  const { rowIndex, field, amount } = req.body;

  try {
    const result = await sheetsService.recordFund(
      year,
      parseInt(rowIndex, 10),
      field,
      amount,
      req.user
    );

    return res.json({
      success: true,
      message: `Đã ghi nhận quỹ cho ${result.member} (${result.field}: ${result.amount.toLocaleString('vi-VN')} ₫)`,
      data: result
    });
  } catch (err) {
    console.error('Lỗi recordFund:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });
  }
}
