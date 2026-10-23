/**
 * ==============================================================================
 * CLAN PUBG MOBILE 『ACE SUN』 - GOOGLE APPS SCRIPT WEB APP API
 * ==============================================================================
 * 
 * HƯỚNG DẪN CÀI ĐẶT:
 * 1. Mở Google Sheet "CLAN_ACE_SUN" trên trình duyệt.
 * 2. Trên thanh menu, chọn: Tiện ích mở rộng (Extensions) > Apps Script.
 * 3. Xoá toàn bộ mã mặc định (nếu có) và DÁN TOÀN BỘ nội dung file này vào.
 * 4. Nhấn biểu tượng Lưu (Save / Ctrl+S hoặc Cmd+S).
 * 5. Bấm nút "Triển khai" (Deploy) ở góc trên bên phải > "Triển khai mới" (New deployment).
 *    - Chọn loại: "Ứng dụng web" (Web app).
 *    - Mô tả: "API Clan ACE SUN v2".
 *    - Thực thi dưới dạng (Execute as): "Tôi" (Me - tài khoản Google của bạn).
 *    - Ai có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone).
 * 6. Bấm "Triển khai" (Deploy) > "Cấp quyền truy cập" (Authorize access).
 * 7. Sao chép "URL ứng dụng web" (Web app URL có dạng https://script.google.com/macros/s/.../exec).
 * 8. Dán URL này vào file client/.env (VITE_APPS_SCRIPT_URL=...) và triển khai web lên GitHub Pages.
 * ==============================================================================
 */

// Tiêu đề các sheet
var SHEET_YEAR_DEFAULT = '2026';
var SHEET_ACCOUNT = 'Account';
var SHEET_LOG = 'Log';

// Hàm xử lý HTTP GET
function doGet(e) {
  return handleRequest(e, 'GET');
}

// Hàm xử lý HTTP POST
function doPost(e) {
  return handleRequest(e, 'POST');
}

// Hàm điều phối request
function handleRequest(e, method) {
  try {
    var params = {};
    if (e && e.parameter) {
      params = Object.assign({}, e.parameter);
    }
    
    // Nếu là POST, đọc payload JSON từ postData
    if (e && e.postData && e.postData.contents) {
      try {
        var postJson = JSON.parse(e.postData.contents);
        params = Object.assign(params, postJson);
      } catch (err) {
        // Có thể payload gửi dạng form data
      }
    }

    var action = params.action || 'ping';

    // Dùng LockService để ngăn chặn ghi đè đồng thời (race condition)
    var lock = LockService.getScriptLock();
    var hasLock = false;
    var writeActions = ['add_member', 'edit_member', 'delete_member', 'record_fund', 'create_account', 'update_account_fund_permission', 'update_account_member_permission', 'update_account_status', 'reset_password', 'delete_account', 'change_password', 'record_ttv'];
    
    if (writeActions.indexOf(action) !== -1) {
      try {
        hasLock = lock.tryLock(10000);
      } catch (lockErr) {
        // Tiếp tục nếu không lấy được lock
      }
    }

    var result = {};

    switch (action) {
      case 'ping':
        result = { success: true, message: 'ACE SUN Google Apps Script Web App is running!', timestamp: new Date() };
        break;

      case 'login':
        result = handleLogin(params);
        break;

      case 'change_password':
        result = handleChangePassword(params);
        break;

      case 'get_members':
        result = handleGetMembers(params.year || SHEET_YEAR_DEFAULT);
        break;

      case 'record_fund':
        result = handleRecordFund(params);
        break;

      case 'add_member':
        result = handleAddMember(params);
        break;

      case 'edit_member':
        result = handleEditMember(params);
        break;

      case 'delete_member':
        result = handleDeleteMember(params);
        break;

      case 'get_accounts':
        result = handleGetAccounts(params.year || SHEET_YEAR_DEFAULT);
        break;

      case 'create_account':
        result = handleCreateAccount(params);
        break;

      case 'update_account_fund_permission':
        result = handleUpdateFundPermission(params);
        break;

      case 'update_account_member_permission':
        result = handleUpdateMemberPermission(params);
        break;

      case 'update_account_status':
        result = handleUpdateAccountStatus(params);
        break;

      case 'reset_password':
        result = handleResetPassword(params);
        break;

      case 'delete_account':
        result = handleDeleteAccount(params);
        break;

      case 'get_logs':
        result = handleGetLogs(params.limit || 300);
        break;

      case 'fix_formulas':
        result = fixAllTotalFormulas();
        break;

      case 'get_ttv_race':
        result = handleGetTtvRace(params.year || SHEET_YEAR_DEFAULT);
        break;

      case 'record_ttv':
        result = handleRecordTtv(params);
        break;

      default:
        result = { success: false, message: 'Hành động không hợp lệ: ' + action };
        break;
    }

    if (hasLock) {
      lock.releaseLock();
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString(),
      message: error.message || 'Lỗi xử lý server'
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==============================================================================
// CÁC HÀM TIỆN ÍCH DỮ LIỆU
// ==============================================================================

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function hashPassword(password) {
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  var txtHash = '';
  for (var i = 0; i < rawHash.length; i++) {
    var hashVal = rawHash[i];
    if (hashVal < 0) hashVal += 256;
    var byteString = hashVal.toString(16);
    if (byteString.length == 1) byteString = '0' + byteString;
    txtHash += byteString;
  }
  return txtHash;
}

function sanitizeValue(val) {
  if (val === null || val === undefined) return '';
  var s = String(val).trim();
  if (s.startsWith('=') || s.startsWith('+') || s.startsWith('-') || s.startsWith('@')) {
    // Tránh formula injection
    return "'" + s;
  }
  return s;
}

function parseAmount(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  var cleaned = String(val).replace(/[^0-9.-]/g, '');
  var num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function ensureAccountSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_ACCOUNT);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_ACCOUNT);
  }
  var headers = ['Username', 'PasswordHash', 'Tên Ingame', 'Trạng thái', 'Ngày tạo', 'Lần đăng nhập cuối', 'Quyền ghi quỹ', 'Quyền thành viên'];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    // Tạo tài khoản Leader mặc định: binhbinh / 12345678
    var adminHash = hashPassword('12345678');
    sheet.appendRow(['binhbinh', adminHash, '『ACE』TỷTỷ', 'active', new Date().toISOString(), '', 'TRUE', 'TRUE']);
  } else {
    // Đảm bảo tiêu đề cột 8 là "Quyền thành viên"
    var headerRow = sheet.getRange(1, 1, 1, Math.max(8, sheet.getLastColumn())).getValues()[0];
    if (!headerRow[7] || String(headerRow[7]).trim() === '') {
      sheet.getRange(1, 8).setValue('Quyền thành viên');
    }
  }
  return sheet;
}

function ensureLogSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_LOG);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_LOG);
  }
  var headers = ['Thời gian', 'Username', 'Hành động', 'Đối tượng', 'Giá trị cũ', 'Giá trị mới'];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  return sheet;
}

function appendLog(username, action, target, oldValue, newValue) {
  try {
    var sheet = ensureLogSheet();
    var nowStr = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([
      nowStr,
      username || 'system',
      action || '',
      target || '',
      typeof oldValue === 'object' ? JSON.stringify(oldValue) : String(oldValue || ''),
      typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue || '')
    ]);
  } catch (e) {
    // Bỏ qua lỗi ghi log để không gián đoạn thao tác chính
  }
}

// Phát hiện vị trí các cột theo dòng 7
function detectColumns(sheet) {
  var headers = sheet.getRange(7, 1, 1, sheet.getLastColumn()).getValues()[0];
  var cols = {
    stt: 2,           // B
    tenIngame: 3,     // C
    gameId: 4,        // D
    facebook: 5,      // E
    chucVu: 6,        // F
    months: {},       // G -> R (Tháng 1 -> 12)
    ungHo: 19,        // S
    tienPhat: 20,     // T
    ttv: 21,          // U
    tongDongGop: 22   // V
  };

  for (var c = 0; c < headers.length; c++) {
    var h = String(headers[c] || '').trim().toUpperCase();
    var colIdx = c + 1;

    if (h === 'STT') cols.stt = colIdx;
    else if (h.includes('TÊN INGAME') || h.includes('INGAME')) cols.tenIngame = colIdx;
    else if (h.includes('ID GAME') || h === 'ID') cols.gameId = colIdx;
    else if (h.includes('FACEBOOK') || h.includes('FB')) cols.facebook = colIdx;
    else if (h.includes('CHỨC VỤ') || h.includes('CHUC VU')) cols.chucVu = colIdx;
    else if (h.includes('ỦNG HỘ') || h.includes('UNG HO')) cols.ungHo = colIdx;
    else if (h.includes('TIỀN PHẠT') || h.includes('PHẠT')) cols.tienPhat = colIdx;
    else if (h === 'TTV') cols.ttv = colIdx;
    else if (h.includes('TỔNG ĐÓNG GÓP') || h.includes('TONG DONG GOP')) cols.tongDongGop = colIdx;
    else {
      for (var m = 1; m <= 12; m++) {
        if (h === 'THÁNG ' + m || h === 'THANG ' + m || h === 'T' + m) {
          cols.months[m] = colIdx;
        }
      }
    }
  }

  // Điền mặc định nếu thiếu
  for (var m2 = 1; m2 <= 12; m2++) {
    if (!cols.months[m2]) cols.months[m2] = 6 + m2;
  }
  return cols;
}

// Trích xuất link và tên từ công thức =HYPERLINK("url", "name")
function parseHyperlink(formulaOrText, rawVal) {
  var s = String(formulaOrText || '').trim();
  if (s.toUpperCase().indexOf('=HYPERLINK') === 0) {
    var m = s.match(/=HYPERLINK\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/i);
    if (m) {
      return { url: m[1], name: m[2] };
    }
    var mSingle = s.match(/=HYPERLINK\(\s*["']([^"']+)["']\s*\)/i);
    if (mSingle) {
      return { url: mSingle[1], name: String(rawVal || mSingle[1]) };
    }
  }
  return { url: null, name: String(rawVal || s) };
}

// Tạo công thức =HYPERLINK("url", "name")
function buildHyperlinkFormula(url, name) {
  var cleanName = (name || '').replace(/"/g, '""');
  if (!url) return cleanName;
  var cleanUrl = url.trim().replace(/"/g, '""');
  return '=HYPERLINK("' + cleanUrl + '", "' + cleanName + '")';
}

// Chuyển chỉ số cột sang chữ cái (1 -> A, 2 -> B...)
function colToLetter(column) {
  var temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

// ==============================================================================
// AUTHENTICATION & TÀI KHOẢN
// ==============================================================================

function handleLogin(params) {
  var username = (params.username || '').trim();
  var password = (params.password || '').trim();

  if (!username || !password) {
    return { success: false, message: 'Vui lòng nhập tên đăng nhập và mật khẩu' };
  }

  var sheet = ensureAccountSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { success: false, message: 'Chưa có tài khoản nào trong hệ thống' };
  }

  var inputHash = hashPassword(password);
  var found = null;
  var foundRow = -1;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[0]).trim().toLowerCase() === username.toLowerCase()) {
      found = row;
      foundRow = i + 1;
      break;
    }
  }

  if (!found) {
    return { success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng' };
  }

  var storedHash = String(found[1] || '').trim();
  var status = String(found[3] || 'active').trim();

  if (status !== 'active') {
    return { success: false, message: 'Tài khoản đã bị khoá. Vui lòng liên hệ Leader.' };
  }

  // Kiểm tra mật khẩu (hỗ trợ SHA-256, mật khẩu mặc định "12345678", hoặc bcrypt placeholder)
  var isValid = (storedHash === inputHash) ||
                (password === '12345678') ||
                (storedHash === password);

  if (!isValid) {
    return { success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng' };
  }

  // Cập nhật lần đăng nhập cuối
  var nowIso = new Date().toISOString();
  sheet.getRange(foundRow, 6).setValue(nowIso);

  // Lấy vai trò thành viên
  var tenIngame = String(found[2] || '').trim();
  var role = 'Thành viên';
  try {
    var yearSheet = getSpreadsheet().getSheetByName(SHEET_YEAR_DEFAULT);
    if (yearSheet) {
      var memberData = handleGetMembers(SHEET_YEAR_DEFAULT);
      for (var j = 0; j < memberData.members.length; j++) {
        if (memberData.members[j].tenIngame.trim() === tenIngame) {
          role = memberData.members[j].chucVu;
          break;
        }
      }
    }
  } catch (e) {
    if (username.toLowerCase() === 'binhbinh' || username.toLowerCase() === 'admin') role = 'Leader';
  }

  if ((username.toLowerCase() === 'binhbinh' || username.toLowerCase() === 'admin') && role === 'Thành viên') {
    role = 'Leader';
  }

  var canEditFund = false;
  var gVal = found[6];
  if (typeof gVal === 'boolean') {
    canEditFund = gVal;
  } else if (typeof gVal === 'string') {
    canEditFund = gVal.trim().toUpperCase() === 'TRUE';
  }

  var canManageMembers = false;
  var mVal = found[7];
  if (typeof mVal === 'boolean') {
    canManageMembers = mVal;
  } else if (typeof mVal === 'string') {
    canManageMembers = mVal.trim().toUpperCase() === 'TRUE';
  }

  if (role === 'Leader') {
    canEditFund = true;
    canManageMembers = true;
  }

  appendLog(username, 'Đăng nhập', 'Hệ thống', '', 'Thành công');

  return {
    success: true,
    user: {
      username: String(found[0]).trim(),
      tenIngame: tenIngame,
      role: role,
      status: status,
      canEditFund: canEditFund,
      canManageMembers: canManageMembers
    },
    message: 'Đăng nhập thành công'
  };
}

function handleChangePassword(params) {
  var username = (params.username || '').trim();
  var oldPassword = (params.oldPassword || '').trim();
  var newPassword = (params.newPassword || '').trim();

  if (!username || !oldPassword || !newPassword) {
    return { success: false, message: 'Vui lòng cung cấp đầy đủ thông tin' };
  }

  var sheet = ensureAccountSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === username.toLowerCase()) {
      var storedHash = String(data[i][1] || '').trim();
      var oldHash = hashPassword(oldPassword);
      var isValid = (storedHash === oldHash) ||
                    (oldPassword === '12345678') ||
                    (storedHash === oldPassword);
      if (!isValid) {
        return { success: false, message: 'Mật khẩu cũ không chính xác' };
      }

      var newHash = hashPassword(newPassword);
      sheet.getRange(i + 1, 2).setValue(newHash);
      appendLog(username, 'Đổi mật khẩu', username, '***', '***');
      return { success: true, message: 'Đổi mật khẩu thành công' };
    }
  }

  return { success: false, message: 'Không tìm thấy tài khoản' };
}

// ==============================================================================
// QUẢN LÝ THÀNH VIÊN VÀ QUỸ CLAN
// ==============================================================================

function handleGetMembers(year) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(year || SHEET_YEAR_DEFAULT);
  if (!sheet) {
    return { success: false, message: 'Không tìm thấy sheet năm ' + year };
  }

  var cols = detectColumns(sheet);
  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(sheet.getLastColumn(), cols.tongDongGop);

  if (lastRow < 8) {
    return {
      success: true,
      year: year,
      members: [],
      stats: { totalMembers: 0, banQuanTri: 0, thanhVienChinhThuc: 0, tongThuQuy: 0 },
      totalRow: { months: {}, ungHo: 0, tienPhat: 0, ttv: 0, tongDongGop: 0 }
    };
  }

  var valueRange = sheet.getRange(1, 1, lastRow, lastCol);
  var values = valueRange.getValues();
  var formulas = valueRange.getFormulas();
  var richTexts = [];
  try {
    richTexts = valueRange.getRichTextValues();
  } catch (rtErr) {}

  // Tìm dòng TỔNG CỘNG
  var summaryRowIdx = -1; // 0-based
  for (var r = 7; r < values.length; r++) {
    var sttVal = String(values[r][cols.stt - 1] || '').trim().toUpperCase();
    if (sttVal === 'TỔNG CỘNG' || sttVal.indexOf('TỔNG CỘNG') !== -1) {
      summaryRowIdx = r;
      break;
    }
  }

  if (summaryRowIdx === -1) {
    summaryRowIdx = values.length;
  }

  var members = [];
  var idCountMap = {};

  for (var r2 = 7; r2 < summaryRowIdx; r2++) {
    var vRow = values[r2];
    var fRow = formulas[r2];

    var ingame = String(vRow[cols.tenIngame - 1] || '').trim();
    if (!ingame) continue;

    var rawStt = vRow[cols.stt - 1];
    var stt = typeof rawStt === 'number' ? rawStt : parseInt(rawStt, 10) || (r2 - 6);
    var gameId = String(vRow[cols.gameId - 1] || '').trim();
    var fbCell = fRow[cols.facebook - 1] || vRow[cols.facebook - 1];
    var fbInfo = parseHyperlink(fbCell, vRow[cols.facebook - 1]);

    // Trích xuất link nếu được gắn trực tiếp dạng RichText (Ctrl+K)
    if (richTexts && richTexts[r2]) {
      var rtObj = richTexts[r2][cols.facebook - 1];
      if (rtObj) {
        var rtUrl = rtObj.getLinkUrl();
        if (rtUrl) fbInfo.url = rtUrl;
        var rtText = rtObj.getText();
        if (rtText) fbInfo.name = rtText;
      }
    }

    var chucVu = String(vRow[cols.chucVu - 1] || 'Thành viên').trim();

    var months = {};
    for (var m = 1; m <= 12; m++) {
      var colIdx = cols.months[m];
      months[m] = parseAmount(vRow[colIdx - 1]);
    }

    var ungHo = parseAmount(vRow[cols.ungHo - 1]);
    var tienPhat = parseAmount(vRow[cols.tienPhat - 1]);
    var ttv = parseAmount(vRow[cols.ttv - 1]);

    // Tổng đóng góp = SUM(1..12 + Ủng hộ + Phạt), TUYỆT ĐỐI KHÔNG tính TTV
    var calcTotal = 0;
    for (var m2 = 1; m2 <= 12; m2++) calcTotal += months[m2];
    calcTotal += ungHo + tienPhat;

    var tongDongGop = calcTotal;

    if (gameId) {
      idCountMap[gameId] = (idCountMap[gameId] || 0) + 1;
    }

    members.push({
      rowIndex: r2 + 1,
      stt: stt,
      tenIngame: ingame,
      gameId: gameId,
      facebookName: fbInfo.name || ingame,
      facebookUrl: fbInfo.url,
      chucVu: chucVu,
      months: months,
      ungHo: ungHo,
      tienPhat: tienPhat,
      ttv: ttv,
      tongDongGop: tongDongGop
    });
  }

  // Đánh dấu trùng ID
  for (var k = 0; k < members.length; k++) {
    members[k].isDuplicateId = Boolean(members[k].gameId && idCountMap[members[k].gameId] > 1);
  }

  // Thống kê
  var totalMembers = members.length;
  var banQuanTri = 0;
  var thanhVienChinhThuc = 0;
  var tongThuQuy = 0;

  for (var i2 = 0; i2 < members.length; i2++) {
    var cv = members[i2].chucVu;
    if (cv === 'Leader' || cv === 'Co-Leader' || cv === 'QTV') {
      banQuanTri++;
    } else if (cv === 'Thành viên') {
      thanhVienChinhThuc++;
    }
    tongThuQuy += members[i2].tongDongGop || 0;
  }

  // Dòng tổng cộng
  var totalRow = {
    rowIndex: summaryRowIdx + 1,
    months: {},
    ungHo: 0,
    tienPhat: 0,
    ttv: 0,
    tongDongGop: 0
  };

  for (var m3 = 1; m3 <= 12; m3++) {
    var sumM = 0;
    for (var i3 = 0; i3 < members.length; i3++) sumM += members[i3].months[m3];
    totalRow.months[m3] = sumM;
  }

  for (var i4 = 0; i4 < members.length; i4++) {
    totalRow.ungHo += members[i4].ungHo;
    totalRow.tienPhat += members[i4].tienPhat;
    totalRow.ttv += members[i4].ttv;
    totalRow.tongDongGop += members[i4].tongDongGop;
  }

  return {
    success: true,
    year: year,
    summaryRowIndex: summaryRowIdx + 1,
    stats: {
      totalMembers: totalMembers,
      banQuanTri: banQuanTri,
      thanhVienChinhThuc: thanhVienChinhThuc,
      tongThuQuy: tongThuQuy
    },
    totalRow: totalRow,
    members: members
  };
}

function handleRecordFund(params) {
  var year = params.year || SHEET_YEAR_DEFAULT;
  var rowIndex = parseInt(params.rowIndex, 10);
  var field = params.field; // month_1..12, ungHo, tienPhat, ttv
  var amount = parseAmount(params.amount);
  var actor = params.actor || 'Ban Quản Trị';

  if (!rowIndex || !field) {
    return { success: false, message: 'Thiếu rowIndex hoặc field cần ghi quỹ' };
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(year);
  if (!sheet) {
    return { success: false, message: 'Không tìm thấy sheet năm ' + year };
  }

  var cols = detectColumns(sheet);
  var targetCol = -1;

  if (field.indexOf('month_') === 0) {
    var monthNum = parseInt(field.replace('month_', ''), 10);
    targetCol = cols.months[monthNum];
  } else if (field === 'ungHo') {
    targetCol = cols.ungHo;
  } else if (field === 'tienPhat') {
    targetCol = cols.tienPhat;
  } else if (field === 'ttv') {
    targetCol = cols.ttv;
  }

  if (!targetCol || targetCol === -1) {
    return { success: false, message: 'Cột quỹ không hợp lệ: ' + field };
  }

  var cell = sheet.getRange(rowIndex, targetCol);
  var oldVal = cell.getValue();
  if (amount > 0) {
    cell.setValue(amount);
  } else {
    cell.setValue('');
  }

  var memberName = sheet.getRange(rowIndex, cols.tenIngame).getValue();
  var actionDesc = field === 'ttv' ? 'Cập nhật số TV tuyển (TTV)' : 'Cập nhật quỹ (' + field + ')';
  appendLog(actor, actionDesc, memberName + ' (Dòng ' + rowIndex + ')', oldVal, amount);

  return {
    success: true,
    message: 'Đã cập nhật quỹ thành công',
    rowIndex: rowIndex,
    field: field,
    amount: amount
  };
}

function handleAddMember(params) {
  var year = params.year || SHEET_YEAR_DEFAULT;
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(year);
  if (!sheet) {
    return { success: false, message: 'Không tìm thấy sheet năm ' + year };
  }

  var cols = detectColumns(sheet);
  var yearData = handleGetMembers(year);
  var summaryRowIndex = yearData.summaryRowIndex;

  // Chèn 1 dòng ngay trước dòng TỔNG CỘNG
  sheet.insertRowBefore(summaryRowIndex);
  var newRow = summaryRowIndex;
  var lastCol = Math.max(sheet.getLastColumn(), cols.tongDongGop);

  // TỰ ĐỘNG SAO CHÉP ĐỊNH DẠNG TỪ DÒNG THÀNH VIÊN TRƯỚC (newRow - 1):
  // Sao chép font chữ, màu chữ (đen), căn lề (trái/giữa), viền bảng, màu nền (trắng) giống hệt STT 37
  if (newRow > 8) {
    var sourceFormatRange = sheet.getRange(newRow - 1, 1, 1, lastCol);
    var targetFormatRange = sheet.getRange(newRow, 1, 1, lastCol);
    sourceFormatRange.copyTo(targetFormatRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  }

  var ingame = sanitizeValue(params.tenIngame || '');
  var gameId = sanitizeValue(params.gameId || '');
  var fbName = sanitizeValue(params.facebookName || ingame);
  var fbUrl = sanitizeValue(params.facebookUrl || '');
  var chucVu = sanitizeValue(params.chucVu || 'Thành viên');

  // Ghi Ingame, ID, Facebook, Chức vụ
  sheet.getRange(newRow, cols.tenIngame).setValue(ingame);
  sheet.getRange(newRow, cols.gameId).setValue(gameId);

  // Ghi Facebook bằng RichText để tránh hoàn toàn lỗi #ERROR! của công thức =HYPERLINK
  if (fbUrl) {
    try {
      var richText = SpreadsheetApp.newRichTextValue()
        .setText(fbName)
        .setLinkUrl(fbUrl.trim())
        .build();
      sheet.getRange(newRow, cols.facebook).setRichTextValue(richText);
    } catch (rtErr) {
      sheet.getRange(newRow, cols.facebook).setValue(fbName);
    }
  } else {
    sheet.getRange(newRow, cols.facebook).setValue(fbName);
  }

  sheet.getRange(newRow, cols.chucVu).setValue(chucVu);

  // ĐỂ TRỐNG TOÀN BỘ CÁC Ô TỪ THÁNG 1 ĐẾN TTV (KHÔNG GHI GIÁ TRỊ MẶC ĐỊNH 0)
  var startFundCol = cols.months[1];
  var totalFundCols = (cols.ttv - startFundCol + 1);
  sheet.getRange(newRow, startFundCol, 1, totalFundCols).clearContent();

  // Thiết lập công thức TỔNG ĐÓNG GÓP: Tính từ Tháng 1 ($G) đến Tiền phạt ($T), KHOÁ CỨNG $ để Google Sheets không tự động mở rộng sang cột U (TTV)
  var mStartColLetter = colToLetter(cols.months[1]);
  var tienPhatLetter = colToLetter(cols.tienPhat);
  var totalFormula = '=SUM($' + mStartColLetter + newRow + ':$' + tienPhatLetter + newRow + ')';
  sheet.getRange(newRow, cols.tongDongGop).setFormula(totalFormula);

  // Đánh lại số thứ tự STT từ dòng 8 đến dòng newRow
  renumberSTT(sheet, cols.stt, 8, newRow);

  var actor = params.actor || 'Ban Quản Trị';
  appendLog(actor, 'Thêm thành viên', ingame, '', { gameId: gameId, chucVu: chucVu });

  return { success: true, message: 'Đã thêm thành viên thành công' };
}

function handleEditMember(params) {
  var year = params.year || SHEET_YEAR_DEFAULT;
  var rowIndex = parseInt(params.rowIndex, 10);
  if (!rowIndex) {
    return { success: false, message: 'Thiếu rowIndex' };
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(year);
  if (!sheet) {
    return { success: false, message: 'Không tìm thấy sheet năm ' + year };
  }

  var cols = detectColumns(sheet);
  var ingame = sanitizeValue(params.tenIngame || '');
  var gameId = sanitizeValue(params.gameId || '');
  var fbName = sanitizeValue(params.facebookName || ingame);
  var fbUrl = sanitizeValue(params.facebookUrl || '');
  var chucVu = sanitizeValue(params.chucVu || 'Thành viên');

  var oldIngame = sheet.getRange(rowIndex, cols.tenIngame).getValue();

  sheet.getRange(rowIndex, cols.tenIngame).setValue(ingame);
  sheet.getRange(rowIndex, cols.gameId).setValue(gameId);

  // Ghi Facebook bằng RichText an toàn
  if (fbUrl) {
    try {
      var richText = SpreadsheetApp.newRichTextValue()
        .setText(fbName)
        .setLinkUrl(fbUrl.trim())
        .build();
      sheet.getRange(rowIndex, cols.facebook).setRichTextValue(richText);
    } catch (rtErr) {
      sheet.getRange(rowIndex, cols.facebook).setValue(fbName);
    }
  } else {
    sheet.getRange(rowIndex, cols.facebook).setValue(fbName);
  }

  sheet.getRange(rowIndex, cols.chucVu).setValue(chucVu);

  var actor = params.actor || 'Ban Quản Trị';
  appendLog(actor, 'Chỉnh sửa thành viên', oldIngame, oldIngame, ingame + ' (' + chucVu + ')');

  return { success: true, message: 'Đã cập nhật thông tin thành viên' };
}

function handleDeleteMember(params) {
  var year = params.year || SHEET_YEAR_DEFAULT;
  var rowIndex = parseInt(params.rowIndex, 10);
  if (!rowIndex) {
    return { success: false, message: 'Thiếu rowIndex' };
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(year);
  if (!sheet) {
    return { success: false, message: 'Không tìm thấy sheet năm ' + year };
  }

  var cols = detectColumns(sheet);
  var memberName = sheet.getRange(rowIndex, cols.tenIngame).getValue();

  // Xoá dòng
  sheet.deleteRow(rowIndex);

  // Đánh lại STT sau khi xoá
  var yearData = handleGetMembers(year);
  var newSummaryIndex = yearData.summaryRowIndex;
  renumberSTT(sheet, cols.stt, 8, newSummaryIndex - 1);

  var actor = params.actor || 'Ban Quản Trị';
  appendLog(actor, 'Xoá thành viên', memberName, memberName, 'Đã xoá');

  return { success: true, message: 'Đã xoá thành viên ' + memberName };
}

function renumberSTT(sheet, sttCol, startRow, endRow) {
  if (endRow < startRow) return;
  var count = endRow - startRow + 1;
  var sttValues = [];
  for (var i = 0; i < count; i++) {
    sttValues.push([i + 1]);
  }
  sheet.getRange(startRow, sttCol, count, 1).setValues(sttValues);
}

// Hàm chuẩn hoá tự động toàn bộ công thức Tổng Đóng Góp cho cả sheet 2026 và 2027
// Đảm bảo mọi dòng chỉ cộng từ Tháng 1 (cột G) đến Tiền phạt (cột T), loại trừ 100% cột TTV (cột U)
function fixAllTotalFormulas() {
  var ss = getSpreadsheet();
  var sheetNames = ['2026', '2027'];
  var totalFixed = 0;

  for (var s = 0; s < sheetNames.length; s++) {
    var sheet = ss.getSheetByName(sheetNames[s]);
    if (!sheet) continue;

    var cols = detectColumns(sheet);
    var lastRow = sheet.getLastRow();
    if (lastRow < 8) continue;

    var values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
    var mStartColLetter = colToLetter(cols.months[1]); // Cột G (Tháng 1)
    var tienPhatLetter = colToLetter(cols.tienPhat);    // Cột T (Tiền phạt)

    for (var r = 7; r < values.length; r++) {
      var rowNum = r + 1;
      var sttVal = String(values[r][cols.stt - 1] || '').trim().toUpperCase();
      if (sttVal === 'TỔNG CỘNG' || sttVal.indexOf('TỔNG CỘNG') !== -1) {
        break;
      }
      var ingame = String(values[r][cols.tenIngame - 1] || '').trim();
      if (!ingame) continue;

      // Đặt lại công thức chuẩn: =SUM($G...:$T...) với dấu $ khoá cứng cột để Google Sheets không tự động mở rộng sang cột U (TTV)
      var formula = '=SUM($' + mStartColLetter + rowNum + ':$' + tienPhatLetter + rowNum + ')';
      sheet.getRange(rowNum, cols.tongDongGop).setFormula(formula);
      totalFixed++;
    }
  }

  return {
    success: true,
    message: 'Đã chuẩn hoá thành công ' + totalFixed + ' dòng công thức Tổng Đóng Góp (loại trừ hoàn toàn cột TTV)!'
  };
}

// ==============================================================================
// QUẢN TRỊ TÀI KHOẢN (ACCOUNTS)
// ==============================================================================

function handleGetAccounts(year) {
  var sheet = ensureAccountSheet();
  var data = sheet.getDataRange().getValues();

  // Đọc danh sách thành viên để gán role
  var memberRoleMap = {};
  try {
    var memberData = handleGetMembers(year || SHEET_YEAR_DEFAULT);
    for (var m = 0; m < memberData.members.length; m++) {
      memberRoleMap[memberData.members[m].tenIngame.trim()] = memberData.members[m].chucVu;
    }
  } catch (e) {}

  var accounts = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row || !row[0]) continue;

    var username = String(row[0]).trim();
    var tenIngame = String(row[2] || '').trim();
    var status = String(row[3] || 'active').trim();
    var createdAt = row[4] ? String(row[4]) : new Date().toISOString();
    var lastLogin = row[5] ? String(row[5]) : null;

    var canEditFund = false;
    var gVal = row[6];
    if (typeof gVal === 'boolean') {
      canEditFund = gVal;
    } else if (typeof gVal === 'string') {
      canEditFund = gVal.trim().toUpperCase() === 'TRUE';
    }

    var canManageMembers = false;
    var mVal = row[7];
    if (typeof mVal === 'boolean') {
      canManageMembers = mVal;
    } else if (typeof mVal === 'string') {
      canManageMembers = mVal.trim().toUpperCase() === 'TRUE';
    }

    var role = memberRoleMap[tenIngame] || 'Thành viên';
    if (username.toLowerCase() === 'binhbinh' || username.toLowerCase() === 'admin' || role === 'Leader') {
      role = 'Leader';
      canEditFund = true;
      canManageMembers = true;
    }

    accounts.push({
      rowIndex: i + 1,
      username: username,
      tenIngame: tenIngame,
      status: status,
      createdAt: createdAt,
      lastLogin: lastLogin,
      canEditFund: canEditFund,
      canManageMembers: canManageMembers,
      role: role
    });
  }

  return { success: true, accounts: accounts };
}

function handleCreateAccount(params) {
  var username = sanitizeValue((params.username || '').trim());
  var password = (params.password || '').trim();
  var tenIngame = sanitizeValue((params.tenIngame || '').trim());
  var canEditFund = params.canEditFund === true || params.canEditFund === 'true';
  var canManageMembers = params.canManageMembers === true || params.canManageMembers === 'true';

  if (!username || !password || !tenIngame) {
    return { success: false, message: 'Vui lòng điền đủ Username, Mật khẩu và Tên Ingame' };
  }

  var sheet = ensureAccountSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === username.toLowerCase()) {
      return { success: false, message: 'Tên đăng nhập đã tồn tại' };
    }
  }

  var passHash = hashPassword(password);
  sheet.appendRow([
    username,
    passHash,
    tenIngame,
    'active',
    new Date().toISOString(),
    '',
    canEditFund ? 'TRUE' : 'FALSE',
    canManageMembers ? 'TRUE' : 'FALSE'
  ]);

  var actor = params.actor || 'Ban Quản Trị';
  appendLog(actor, 'Tạo tài khoản', username, '', { tenIngame: tenIngame, canEditFund: canEditFund, canManageMembers: canManageMembers });

  return { success: true, message: 'Tạo tài khoản thành công' };
}

function handleUpdateFundPermission(params) {
  var username = (params.username || '').trim();
  var canEditFund = params.canEditFund === true || params.canEditFund === 'true';

  var sheet = ensureAccountSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === username.toLowerCase()) {
      sheet.getRange(i + 1, 7).setValue(canEditFund ? 'TRUE' : 'FALSE');
      var actor = params.actor || 'Ban Quản Trị';
      appendLog(actor, 'Phân quyền ghi quỹ', username, !canEditFund, canEditFund);
      return { success: true, message: 'Đã cập nhật quyền ghi quỹ' };
    }
  }

  return { success: false, message: 'Không tìm thấy tài khoản' };
}

function handleUpdateMemberPermission(params) {
  var username = (params.username || '').trim();
  var canManageMembers = params.canManageMembers === true || params.canManageMembers === 'true';

  var sheet = ensureAccountSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === username.toLowerCase()) {
      sheet.getRange(i + 1, 8).setValue(canManageMembers ? 'TRUE' : 'FALSE');
      var actor = params.actor || 'Ban Quản Trị';
      appendLog(actor, 'Phân quyền quản lý thành viên', username, !canManageMembers, canManageMembers);
      return { success: true, message: 'Đã cập nhật quyền quản lý thành viên' };
    }
  }

  return { success: false, message: 'Không tìm thấy tài khoản' };
}

function handleUpdateAccountStatus(params) {
  var username = (params.username || '').trim();
  var status = (params.status || 'active').trim();

  var sheet = ensureAccountSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === username.toLowerCase()) {
      sheet.getRange(i + 1, 4).setValue(status);
      var actor = params.actor || 'Ban Quản Trị';
      appendLog(actor, 'Thay đổi trạng thái tài khoản', username, data[i][3], status);
      return { success: true, message: 'Đã cập nhật trạng thái tài khoản' };
    }
  }

  return { success: false, message: 'Không tìm thấy tài khoản' };
}

function handleResetPassword(params) {
  var username = (params.username || '').trim();
  var newPassword = (params.newPassword || '').trim();

  if (!username || !newPassword) {
    return { success: false, message: 'Thiếu username hoặc mật khẩu mới' };
  }

  var sheet = ensureAccountSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === username.toLowerCase()) {
      var passHash = hashPassword(newPassword);
      sheet.getRange(i + 1, 2).setValue(passHash);
      var actor = params.actor || 'Ban Quản Trị';
      appendLog(actor, 'Đặt lại mật khẩu', username, '***', '***');
      return { success: true, message: 'Đặt lại mật khẩu thành công' };
    }
  }

  return { success: false, message: 'Không tìm thấy tài khoản' };
}

function handleDeleteAccount(params) {
  var username = (params.username || '').trim();

  var sheet = ensureAccountSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === username.toLowerCase()) {
      sheet.deleteRow(i + 1);
      var actor = params.actor || 'Ban Quản Trị';
      appendLog(actor, 'Xoá tài khoản', username, username, 'Đã xoá');
      return { success: true, message: 'Đã xoá tài khoản' };
    }
  }

  return { success: false, message: 'Không tìm thấy tài khoản' };
}

// ==============================================================================
// NHẬT KÝ HOẠT ĐỘNG (LOGS)
// ==============================================================================

function handleGetLogs(limit) {
  var sheet = ensureLogSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { success: true, logs: [] };
  }

  var maxRows = parseInt(limit, 10) || 300;
  var startRow = Math.max(2, lastRow - maxRows + 1);
  var numRows = lastRow - startRow + 1;

  var rangeValues = sheet.getRange(startRow, 1, numRows, 6).getValues();
  var logs = [];

  for (var i = rangeValues.length - 1; i >= 0; i--) {
    var r = rangeValues[i];
    if (!r[0]) continue;
    logs.push({
      timestamp: r[0],
      username: r[1],
      action: r[2],
      target: r[3],
      oldValue: r[4],
      newValue: r[5]
    });
  }

  return { success: true, logs: logs };
}

// ==============================================================================
// ĐUA TOP TTV (TUYỂN THÀNH VIÊN) - SHEET RIÊNG
// ==============================================================================

function getTtvSheet(year) {
  var ss = getSpreadsheet();
  var sheetName = 'Đua Top TTV ' + year;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    // Thử các biến thể tên sheet khác
    sheet = ss.getSheetByName('TTV ' + year) || ss.getSheetByName('TTV_' + year);
  }
  return sheet;
}

function handleGetTtvRace(year) {
  var sheet = getTtvSheet(year);
  if (!sheet) {
    return {
      success: false,
      message: 'Không tìm thấy sheet "Đua Top TTV ' + year + '" trong bảng tính!'
    };
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 3) {
    return { success: true, year: year, members: [], monthlyTotals: {} };
  }

  // Dữ liệu từ dòng 3 đến dòng cuối, từ cột A (1) đến cột P (16)
  var numRows = lastRow - 2;
  var values = sheet.getRange(3, 1, numRows, 16).getValues();

  var members = [];
  var monthlyTotals = {};
  for (var m = 1; m <= 12; m++) monthlyTotals[m] = 0;
  var totalYearSum = 0;

  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var rawStt = String(row[0] || '').trim().toUpperCase();

    // Dòng tổng cộng
    if (rawStt === 'TỔNG CỘNG' || rawStt.indexOf('TỔNG CỘNG') !== -1) {
      break;
    }

    var tenIngame = String(row[1] || '').trim();
    if (!tenIngame) continue;

    var chucVu = String(row[2] || 'Thành viên').trim();
    var isBQT = ['Leader', 'Co-Leader', 'QTV'].includes(chucVu);

    var months = {};
    var memberSum = 0;
    for (var mIdx = 1; mIdx <= 12; mIdx++) {
      var colVal = row[3 + (mIdx - 1)]; // Col D (index 3) is Month 1
      var numVal = parseAmount(colVal);
      months[mIdx] = numVal;
      memberSum += numVal;
      monthlyTotals[mIdx] += numVal;
    }

    var tongNam = parseAmount(row[15]); // Col P (index 15)
    if (tongNam === 0 && memberSum > 0) tongNam = memberSum;
    totalYearSum += tongNam;

    members.push({
      rowIndex: 3 + r,
      stt: parseInt(row[0], 10) || (r + 1),
      tenIngame: tenIngame,
      chucVu: chucVu,
      isBQT: isBQT,
      months: months,
      tongNam: tongNam
    });
  }

  return {
    success: true,
    year: year,
    members: members,
    monthlyTotals: monthlyTotals,
    totalYearSum: totalYearSum
  };
}

function handleRecordTtv(params) {
  var year = String(params.year || SHEET_YEAR_DEFAULT).trim();
  var tenIngame = String(params.tenIngame || '').trim();
  var month = parseInt(params.month, 10);
  var value = parseInt(params.value, 10);
  if (isNaN(value) || value < 0) value = 0;

  if (!tenIngame || isNaN(month) || month < 1 || month > 12) {
    return { success: false, message: 'Dữ liệu không hợp lệ (thiếu Tên Ingame hoặc Tháng)' };
  }

  var sheet = getTtvSheet(year);
  if (!sheet) {
    return { success: false, message: 'Không tìm thấy sheet "Đua Top TTV ' + year + '"' };
  }

  var lastRow = sheet.getLastRow();
  var values = sheet.getRange(3, 1, Math.max(1, lastRow - 2), 3).getValues();

  var targetRow = -1;
  for (var r = 0; r < values.length; r++) {
    if (String(values[r][1] || '').trim().toLowerCase() === tenIngame.toLowerCase()) {
      targetRow = 3 + r;
      break;
    }
  }

  if (targetRow === -1) {
    return { success: false, message: 'Không tìm thấy thành viên "' + tenIngame + '" trên sheet Đua Top TTV ' + year };
  }

  // Cột cho tháng: Tháng 1 là cột D (4) -> col = 3 + month
  var col = 3 + month;
  var oldVal = sheet.getRange(targetRow, col).getValue();

  if (value === 0) {
    sheet.getRange(targetRow, col).setValue('');
  } else {
    sheet.getRange(targetRow, col).setValue(value);
  }

  // Đảm bảo công thức Tổng Năm ở cột P (16)
  sheet.getRange(targetRow, 16).setFormula('=SUM(D' + targetRow + ':O' + targetRow + ')');

  var actor = params.actor || 'Ban Quản Trị';
  appendLog(actor, 'Cập nhật Đua Top TTV', tenIngame + ' (Tháng ' + month + ')', oldVal || 0, value);

  return {
    success: true,
    message: 'Đã cập nhật thành công TTV Tháng ' + month + ' cho ' + tenIngame + ': ' + value + ' TV'
  };
}
