import { sheetsService } from '../services/sheets.service.js';

export async function getLogs(req, res) {
  const limit = parseInt(req.query.limit, 10) || 200;

  try {
    const logs = await sheetsService.getLogs(limit);
    return res.json({
      success: true,
      data: logs
    });
  } catch (err) {
    console.error('Lỗi getLogs:', err);
    return res.status(500).json({
      success: false,
      message: 'Không thể đọc nhật ký: ' + err.message
    });
  }
}
