import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Clan 『ACE SUN』 Backend Server đang chạy`);
  console.log(`📍 Cổng: http://localhost:${PORT}`);
  console.log(`🌐 Frontend Origin: ${process.env.FRONTEND_ORIGIN || 'http://localhost:5173'}`);
  console.log(`📊 Chế độ Google Sheets: ${process.env.MOCK_SHEETS === 'true' ? 'MOCK / OFFLINE' : 'LIVE API'}`);
  console.log(`===============================================`);
});
