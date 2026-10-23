import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { sheetsService } from '../src/services/sheets.service.js';

describe('Hệ Thống Phân Quyền & Bảo Mật Clan ACE SUN', () => {
  let leaderToken = '';
  let coleaderToken = '';
  let qtvToken = '';

  const leaderPassword = 'LeaderPassword123!';
  const coleaderPassword = 'CoLeaderPassword123!';
  const qtvPassword = 'QtvPassword123!';

  beforeAll(async () => {
    const salt = await bcrypt.genSalt(10);
    const leaderHash = await bcrypt.hash(leaderPassword, salt);

    // 1. Leader (『ACE』TỷTỷ) - kiểm tra xem có tài khoản nào liên kết với 『ACE』TỷTỷ chưa
    const accounts = await sheetsService.getAccounts();
    const existingLeaderAcc = accounts.find(a => a.tenIngame === '『ACE』TỷTỷ');

    let leaderUsername = 'admin';
    if (existingLeaderAcc) {
      leaderUsername = existingLeaderAcc.username;
      await sheetsService.resetPassword(leaderUsername, leaderHash, 'system');
    } else {
      leaderUsername = 'test_leader';
      await sheetsService.createAccount(
        {
          username: leaderUsername,
          passwordHash: leaderHash,
          tenIngame: '『ACE』TỷTỷ',
          status: 'active',
          canEditFund: true
        },
        'system'
      );
    }

    // 2. Co-Leader (『ACE』Meoww)
    const coleaderHash = await bcrypt.hash(coleaderPassword, salt);
    const existingCoLeaderAcc = accounts.find(a => a.tenIngame === '『ACE』Meoww');
    let coleaderUsername = 'test_coleader';
    if (existingCoLeaderAcc) {
      coleaderUsername = existingCoLeaderAcc.username;
      await sheetsService.resetPassword(coleaderUsername, coleaderHash, 'system');
      await sheetsService.updateFundPermission(coleaderUsername, false, 'system');
    } else {
      await sheetsService.createAccount(
        {
          username: coleaderUsername,
          passwordHash: coleaderHash,
          tenIngame: '『ACE』Meoww',
          status: 'active',
          canEditFund: false
        },
        'system'
      );
    }

    // 3. QTV (『ACE』NoLove)
    const qtvHash = await bcrypt.hash(qtvPassword, salt);
    const existingQtvAcc = accounts.find(a => a.tenIngame === '『ACE』NoLove');
    let qtvUsername = 'test_qtv';
    if (existingQtvAcc) {
      qtvUsername = existingQtvAcc.username;
      await sheetsService.resetPassword(qtvUsername, qtvHash, 'system');
      await sheetsService.updateFundPermission(qtvUsername, false, 'system');
    } else {
      await sheetsService.createAccount(
        {
          username: qtvUsername,
          passwordHash: qtvHash,
          tenIngame: '『ACE』NoLove',
          status: 'active',
          canEditFund: false
        },
        'system'
      );
    }

    // Đăng nhập lấy Token
    const resLeader = await request(app)
      .post('/api/auth/login')
      .send({ username: leaderUsername, password: leaderPassword });
    leaderToken = resLeader.body.accessToken;

    const resCoLeader = await request(app)
      .post('/api/auth/login')
      .send({ username: coleaderUsername, password: coleaderPassword });
    coleaderToken = resCoLeader.body.accessToken;

    const resQTV = await request(app)
      .post('/api/auth/login')
      .send({ username: qtvUsername, password: qtvPassword });
    qtvToken = resQTV.body.accessToken;
  });

  // TEST 1: Người chưa đăng nhập nhận 401
  it('1. Người chưa đăng nhập gọi API thành viên hoặc ghi quỹ phải nhận mã 401', async () => {
    const resGetMembers = await request(app).get('/api/members');
    expect(resGetMembers.status).toBe(401);
    expect(resGetMembers.body.success).toBe(false);

    const resRecordFund = await request(app)
      .post('/api/fund/record')
      .send({ rowIndex: 8, field: 'month_1', amount: 50000 });
    expect(resRecordFund.status).toBe(401);
  });

  // TEST 2: QTV và Co-Leader chưa được cấp canEditFund gọi API ghi quỹ nhận 403
  it('2. QTV và Co-Leader chưa được cấp quyền gọi API ghi quỹ phải nhận mã 403', async () => {
    const resQtv = await request(app)
      .post('/api/fund/record')
      .set('Authorization', `Bearer ${qtvToken}`)
      .send({ rowIndex: 8, field: 'month_1', amount: 50000 });

    expect(resQtv.status).toBe(403);
    expect(resQtv.body.message).toContain('Bạn không có quyền ghi quỹ');

    const resCoLeader = await request(app)
      .post('/api/fund/record')
      .set('Authorization', `Bearer ${coleaderToken}`)
      .send({ rowIndex: 8, field: 'month_1', amount: 50000 });

    expect(resCoLeader.status).toBe(403);
    expect(resCoLeader.body.message).toContain('Bạn không có quyền ghi quỹ');
  });

  // TEST 3: Sau khi Leader cấp quyền canEditFund = true thì Co-Leader ghi quỹ thành công
  it('3. Sau khi Leader bật canEditFund thì Co-Leader gọi API ghi quỹ thành công (200)', async () => {
    // Leader cấp quyền cho test_coleader
    const grantRes = await request(app)
      .patch('/api/accounts/test_coleader/fund-permission')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ canEditFund: true });

    expect(grantRes.status).toBe(200);
    expect(grantRes.body.success).toBe(true);

    // Co-Leader thực hiện ghi quỹ (vẫn dùng coleaderToken cũ, chứng minh kiểm tra realtime từ sheet)
    const fundRes = await request(app)
      .post('/api/fund/record')
      .set('Authorization', `Bearer ${coleaderToken}`)
      .send({ rowIndex: 8, field: 'month_1', amount: 50000 });

    expect(fundRes.status).toBe(200);
    expect(fundRes.body.success).toBe(true);
    expect(fundRes.body.data.amount).toBe(50000);
  });

  // TEST 4: Sau khi Leader thu hồi quyền thì Co-Leader lại nhận 403 NGAY LẬP TỨC
  it('4. Sau khi Leader thu hồi quyền ghi quỹ thì Co-Leader bị chặn 403 ngay lập tức', async () => {
    // Leader thu hồi quyền
    const revokeRes = await request(app)
      .patch('/api/accounts/test_coleader/fund-permission')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ canEditFund: false });

    expect(revokeRes.status).toBe(200);

    // Co-Leader gọi lại ngay lập tức -> Phải 403
    const fundRes = await request(app)
      .post('/api/fund/record')
      .set('Authorization', `Bearer ${coleaderToken}`)
      .send({ rowIndex: 8, field: 'month_1', amount: 50000 });

    expect(fundRes.status).toBe(403);
    expect(fundRes.body.message).toContain('Bạn không có quyền ghi quỹ');
  });

  // TEST 5: Co-Leader / QTV không thể tự bật quyền cho mình hoặc người khác
  it('5. Co-Leader và QTV không thể tự bật quyền cho mình hoặc người khác (403)', async () => {
    // Co-Leader cố gắng cấp quyền cho chính mình
    const coLeaderSelfGrant = await request(app)
      .patch('/api/accounts/test_coleader/fund-permission')
      .set('Authorization', `Bearer ${coleaderToken}`)
      .send({ canEditFund: true });

    expect(coLeaderSelfGrant.status).toBe(403);

    // QTV cố gắng cấp quyền cho Co-Leader
    const qtvGrant = await request(app)
      .patch('/api/accounts/test_coleader/fund-permission')
      .set('Authorization', `Bearer ${qtvToken}`)
      .send({ canEditFund: true });

    expect(qtvGrant.status).toBe(403);
  });

  // TEST 6: Co-Leader không được phép đổi Chức vụ (role)
  it('6. Co-Leader không có quyền thay đổi Chức vụ của thành viên khác (403)', async () => {
    const editRoleRes = await request(app)
      .put('/api/members/11')
      .set('Authorization', `Bearer ${coleaderToken}`)
      .send({ chucVu: 'Co-Leader' });

    expect(editRoleRes.status).toBe(403);
    expect(editRoleRes.body.message).toContain('Chỉ Leader');
  });

  // TEST 7: Co-Leader không được xoá thành viên đã có đóng góp > 0
  it('7. Co-Leader không được phép xoá thành viên đã có đóng góp quỹ > 0 (403)', async () => {
    // Dòng 37 là 『ACE』Lionel (Thành viên có đóng góp 150.000 ₫, không có tài khoản)
    const deleteRes = await request(app)
      .delete('/api/members/37')
      .set('Authorization', `Bearer ${coleaderToken}`)
      .send({ expectedIngame: '『ACE』Lionel' });

    expect(deleteRes.status).toBe(403);
    expect(deleteRes.body.message).toContain('đã có đóng góp quỹ > 0');
  });

  // TEST 8: Không được xoá thành viên đang có tài khoản quản trị
  it('8. Chặn xoá thành viên đang có tài khoản quản trị (400)', async () => {
    // Leader thử xoá 『ACE』TỷTỷ (đã có tài khoản test_leader)
    const deleteRes = await request(app)
      .delete('/api/members/8')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ expectedIngame: '『ACE』TỷTỷ' });

    expect(deleteRes.status).toBe(400);
    expect(deleteRes.body.message).toContain('tài khoản quản trị');
  });
});
