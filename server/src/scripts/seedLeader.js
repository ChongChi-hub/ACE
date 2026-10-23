import readline from 'readline';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { sheetsService } from '../services/sheets.service.js';

dotenv.config();

function promptInput(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function seedLeader() {
  console.log('====================================================');
  console.log('👑 SCRIPT KHỞI TẠO TÀI KHOẢN LEADER - CLAN ACE SUN');
  console.log('====================================================\n');

  try {
    // 1. Đọc danh sách thành viên để tìm Leader
    console.log('🔍 Đang kiểm tra cấu trúc sheet và tìm Leader...');
    const yearData = await sheetsService.getYearSheetData('2026');
    const leaderMember = yearData.members.find(m => m.chucVu === 'Leader');

    if (!leaderMember) {
      console.error('❌ Không tìm thấy thành viên có Chức vụ "Leader" trong sheet 2026!');
      process.exit(1);
    }

    console.log(`✅ Đã tìm thấy Leader ingame: "${leaderMember.tenIngame}" (ID: ${leaderMember.gameId})\n`);

    // 2. Nhận thông tin từ command line argument hoặc prompt tương tác
    const args = process.argv.slice(2);
    let username = args[0];
    let password = args[1];

    if (!username) {
      username = await promptInput('👉 Nhập Username cho Leader (mặc định: admin): ');
      if (!username) username = 'admin';
    }

    if (!password) {
      password = await promptInput('👉 Nhập Mật khẩu cho Leader (tối thiểu 8 ký tự): ');
      while (!password || password.length < 8) {
        console.log('⚠️ Mật khẩu phải có tối thiểu 8 ký tự!');
        password = await promptInput('👉 Vui lòng nhập lại mật khẩu: ');
      }
    }

    // 3. Kiểm tra xem tài khoản đã tồn tại chưa
    const accounts = await sheetsService.getAccounts();
    const existing = accounts.find(
      a => a.username.toLowerCase() === username.toLowerCase() ||
           a.tenIngame.toLowerCase() === leaderMember.tenIngame.toLowerCase()
    );

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    if (existing) {
      console.log(`⚠️ Tài khoản (${existing.username} / ${existing.tenIngame}) đã tồn tại.`);
      console.log('🔄 Đang cập nhật lại mật khẩu cho Leader...');
      await sheetsService.resetPassword(existing.username, passwordHash, 'seed:leader');
      console.log('✅ Đã cập nhật mật khẩu cho Leader thành công!');
    } else {
      console.log('💾 Đang tạo tài khoản Leader mới vào Google Sheet (sheet Account)...');
      await sheetsService.createAccount(
        {
          username,
          passwordHash,
          tenIngame: leaderMember.tenIngame,
          status: 'active',
          canEditFund: true
        },
        'seed:leader'
      );
      console.log('🎉 Tạo tài khoản Leader thành công!');
    }

    console.log('\n====================================================');
    console.log('📋 THÔNG TIN ĐĂNG NHẬP LEADER:');
    console.log(`   - Username    : ${username}`);
    console.log(`   - Mật khẩu    : ${password}`);
    console.log(`   - Tên Ingame  : ${leaderMember.tenIngame}`);
    console.log(`   - Quyền hạn   : Leader (Toàn quyền + Quyền ghi quỹ)`);
    console.log('====================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi khi khởi tạo tài khoản Leader:', err.message);
    process.exit(1);
  }
}

seedLeader();
