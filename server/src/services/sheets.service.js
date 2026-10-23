import { google } from 'googleapis';
import { Mutex } from 'async-mutex';
import dotenv from 'dotenv';
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  colIndexToLetter,
  letterToColIndex,
  sanitizeSheetValue,
  parseHyperlink,
  buildHyperlinkFormula,
  parseAmount
} from '../utils/sheetUtils.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mutex = new Mutex();

// Cache lưu trữ trạng thái khi chạy Mock hoặc bộ đệm dữ liệu
let inMemoryStore = null;

class SheetsService {
  constructor() {
    this.sheetId = process.env.GOOGLE_SHEET_ID;
    this.clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    this.privateKey = process.env.GOOGLE_PRIVATE_KEY
      ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : null;

    this.isMock =
      process.env.MOCK_SHEETS === 'true' ||
      !this.clientEmail ||
      !this.privateKey ||
      this.clientEmail.includes('your-project-id');

    this.sheetsClient = null;
    this.sheetMetadataCache = {};

    if (!this.isMock) {
      try {
        const auth = new google.auth.JWT(
          this.clientEmail,
          null,
          this.privateKey,
          ['https://www.googleapis.com/auth/spreadsheets']
        );
        this.sheetsClient = google.sheets({ version: 'v4', auth });
      } catch (err) {
        console.warn('⚠️ Không thể khởi tạo Google Sheets Client. Chuyển sang mock mode:', err.message);
        this.isMock = true;
      }
    }
  }

  // Lưu Mock store ra file để các tiến trình (như seed:leader và server) đồng bộ dữ liệu với nhau
  _saveMockStore() {
    try {
      const storePath = path.resolve(__dirname, '../../.mock_sheets_store.json');
      fs.writeFileSync(storePath, JSON.stringify(inMemoryStore, null, 2), 'utf8');
    } catch (e) {
      // ignore
    }
  }

  // Khởi tạo In-memory store từ file CLAN_ACE_SUN.xlsx nếu cần mock
  _initMockStore() {
    if (inMemoryStore) return inMemoryStore;

    const storePath = path.resolve(__dirname, '../../.mock_sheets_store.json');
    if (fs.existsSync(storePath)) {
      try {
        inMemoryStore = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        return inMemoryStore;
      } catch (e) {
        // file lỗi thì load lại từ excel
      }
    }

    const excelPath = path.resolve(__dirname, '../../../CLAN_ACE_SUN.xlsx');
    if (!fs.existsSync(excelPath)) {
      throw new Error(`Không tìm thấy file mẫu tại: ${excelPath}`);
    }

    const wb = xlsx.readFile(excelPath, { cellFormula: true, cellStyles: true });
    inMemoryStore = {};

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const range = xlsx.utils.decode_range(ws['!ref'] || 'A1:V45');
      const matrix = [];

      for (let R = 0; R <= range.e.r; ++R) {
        const row = [];
        for (let C = 0; C <= range.e.c; ++C) {
          const cellAddress = xlsx.utils.encode_cell({ r: R, c: C });
          const cell = ws[cellAddress];
          if (!cell) {
            row.push(null);
          } else if (cell.f) {
            row.push(`=${cell.f}`);
          } else {
            row.push(cell.v !== undefined ? cell.v : null);
          }
        }
        matrix.push(row);
      }
      inMemoryStore[sheetName] = matrix;
    }

    // Đảm bảo có sheet Account
    if (!inMemoryStore['Account'] || inMemoryStore['Account'].length === 0) {
      inMemoryStore['Account'] = [
        ['Username', 'PasswordHash', 'Tên Ingame', 'Trạng thái', 'Ngày tạo', 'Lần đăng nhập cuối', 'Quyền ghi quỹ']
      ];
    }

    // Nếu chưa có tài khoản nào trong sheet Account, khởi tạo mặc định tài khoản Leader
    if (inMemoryStore['Account'].length <= 1) {
      // Hash của "Leader@2026!"
      const defaultHash = '$2a$10$0k4LpW7.hP2x7lG7.iJ9A.c9bK0vN2k5M4x7lG7.iJ9A.c9bK0vN2';
      // Tạo hash chuẩn bằng bcrypt
      import('bcryptjs').then(({ default: bcrypt }) => {
        bcrypt.hash('Leader@2026!', 10).then(hash => {
          if (inMemoryStore['Account'].length <= 1) {
            inMemoryStore['Account'].push([
              'admin',
              hash,
              '『ACE』TỷTỷ',
              'active',
              new Date().toISOString(),
              '',
              'TRUE'
            ]);
            this._saveMockStore();
          }
        });
      });
    }

    // Đảm bảo có sheet Log
    if (!inMemoryStore['Log'] || inMemoryStore['Log'].length === 0) {
      inMemoryStore['Log'] = [
        ['Thời gian', 'Username', 'Hành động', 'Đối tượng', 'Giá trị cũ', 'Giá trị mới']
      ];
    }

    this._saveMockStore();
    return inMemoryStore;
  }

  /**
   * Lấy ID số (sheetId) của một sheet trong Spreadsheet (dùng cho insertDimension/deleteDimension)
   */
  async getSheetId(sheetName) {
    if (this.isMock) return 0;
    if (this.sheetMetadataCache[sheetName]) return this.sheetMetadataCache[sheetName];

    const res = await this.sheetsClient.spreadsheets.get({
      spreadsheetId: this.sheetId
    });

    for (const s of res.data.sheets || []) {
      this.sheetMetadataCache[s.properties.title] = s.properties.sheetId;
    }

    if (this.sheetMetadataCache[sheetName] !== undefined) {
      return this.sheetMetadataCache[sheetName];
    }

    // Nếu sheet chưa tồn tại (như Log hoặc Account), tự tạo sheet mới
    const addRes = await this.sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: this.sheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }
        ]
      }
    });

    const newId = addRes.data.replies[0].addSheet.properties.sheetId;
    this.sheetMetadataCache[sheetName] = newId;
    return newId;
  }

  /**
   * Lấy danh sách các năm/sheet có sẵn trong Spreadsheet
   */
  async getAvailableYears() {
    if (this.isMock) {
      const store = this._initMockStore();
      return Object.keys(store).filter(name => /^\d{4}$/.test(name));
    }

    const res = await this.sheetsClient.spreadsheets.get({
      spreadsheetId: this.sheetId
    });
    const sheetTitles = (res.data.sheets || []).map(s => s.properties.title);
    const years = sheetTitles.filter(t => /^\d{4}$/.test(t));
    return years.length > 0 ? years : ['2026'];
  }

  /**
   * Đọc dữ liệu thô của 1 range trong sheet
   */
  async getRangeValues(sheetName, range, valueRenderOption = 'FORMATTED_VALUE') {
    if (this.isMock) {
      const store = this._initMockStore();
      const sheet = store[sheetName] || [];
      return sheet;
    }

    const res = await this.sheetsClient.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: `${sheetName}!${range}`,
      valueRenderOption
    });
    return res.data.values || [];
  }

  /**
   * Quét và map header dòng 7 để xác định vị trí các cột
   */
  async detectColumns(sheetName = '2026') {
    // Đọc dòng 7 (index 6 0-based)
    let headerRow = [];
    if (this.isMock) {
      const store = this._initMockStore();
      const sheet = store[sheetName] || [];
      headerRow = sheet[6] || [];
    } else {
      const vals = await this.getRangeValues(sheetName, 'A7:Z7', 'FORMATTED_VALUE');
      headerRow = vals[0] || [];
    }

    const cols = {
      stt: -1,
      tenIngame: -1,
      gameId: -1,
      facebook: -1,
      chucVu: -1,
      months: {}, // 1..12: colIndex
      ungHo: -1,
      tienPhat: -1,
      ttv: -1,
      tongDongGop: -1
    };

    for (let c = 0; c < headerRow.length; c++) {
      const colIdx = c + 1; // 1-indexed
      const title = String(headerRow[c] || '').trim().toLowerCase();

      if (title === 'stt') {
        cols.stt = colIdx;
      } else if (title.includes('ingame') || title.includes('tên ingame')) {
        cols.tenIngame = colIdx;
      } else if (title.includes('id game') || title === 'id') {
        cols.gameId = colIdx;
      } else if (title.includes('facebook')) {
        cols.facebook = colIdx;
      } else if (title.includes('chức vụ') || title.includes('role')) {
        cols.chucVu = colIdx;
      } else if (title.includes('ủng hộ')) {
        cols.ungHo = colIdx;
      } else if (title.includes('phạt')) {
        cols.tienPhat = colIdx;
      } else if (title === 'ttv' || title.includes('ttv')) {
        cols.ttv = colIdx;
      } else if (title.includes('tổng đóng góp') || title.includes('tổng cộng')) {
        cols.tongDongGop = colIdx;
      }

      // Check Tháng 1..12
      const monthMatch = title.match(/tháng\s*(\d{1,2})/i);
      if (monthMatch) {
        const m = parseInt(monthMatch[1], 10);
        if (m >= 1 && m <= 12) {
          cols.months[m] = colIdx;
        }
      }
    }

    // Fallback chuẩn theo template CLAN ACE SUN nếu không nhận diện đủ
    if (cols.stt === -1) cols.stt = 2; // B
    if (cols.tenIngame === -1) cols.tenIngame = 3; // C
    if (cols.gameId === -1) cols.gameId = 4; // D
    if (cols.facebook === -1) cols.facebook = 5; // E
    if (cols.chucVu === -1) cols.chucVu = 6; // F
    for (let m = 1; m <= 12; m++) {
      if (!cols.months[m]) cols.months[m] = 6 + m; // G..R (7..18)
    }
    if (cols.ungHo === -1) cols.ungHo = 19; // S
    if (cols.tienPhat === -1) cols.tienPhat = 20; // T
    if (cols.ttv === -1) cols.ttv = 21; // U
    if (cols.tongDongGop === -1) cols.tongDongGop = 22; // V

    return cols;
  }

  /**
   * Đọc danh sách thành viên và thống kê từ sheet năm
   */
  async getYearSheetData(sheetName = '2026') {
    const cols = await this.detectColumns(sheetName);

    // Đọc 2 lần: FORMULA (để lấy HYPERLINK cột E) và UNFORMATTED_VALUE (để lấy giá trị số chuẩn)
    let formulaMatrix = [];
    let valueMatrix = [];

    if (this.isMock) {
      const store = this._initMockStore();
      formulaMatrix = store[sheetName] || [];
      valueMatrix = store[sheetName] || [];
    } else {
      const [fData, vData] = await Promise.all([
        this.getRangeValues(sheetName, 'A1:Z100', 'FORMULA'),
        this.getRangeValues(sheetName, 'A1:Z100', 'UNFORMATTED_VALUE')
      ]);
      formulaMatrix = fData;
      valueMatrix = vData;
    }

    // Tìm dòng TỔNG CỘNG ở cột B (sttCol - 1 trong 0-based matrix)
    const sttColIdx = cols.stt - 1;
    let summaryRowIdx = -1; // 0-based
    for (let r = 7; r < valueMatrix.length; r++) {
      const row = valueMatrix[r] || [];
      const val = String(row[sttColIdx] || '').trim().toUpperCase();
      if (val === 'TỔNG CỘNG' || val.includes('TỔNG CỘNG')) {
        summaryRowIdx = r;
        break;
      }
    }

    if (summaryRowIdx === -1) {
      summaryRowIdx = valueMatrix.length;
    }

    const members = [];
    const idCountMap = {};

    // Duyệt từ dòng 8 (index 7) đến trước dòng TỔNG CỘNG
    for (let r = 7; r < summaryRowIdx; r++) {
      const vRow = valueMatrix[r] || [];
      const fRow = formulaMatrix[r] || [];

      const ingame = String(vRow[cols.tenIngame - 1] || '').trim();
      if (!ingame) continue; // Bỏ qua dòng trống

      const rawStt = vRow[cols.stt - 1];
      const stt = typeof rawStt === 'number' ? rawStt : parseInt(rawStt, 10) || (r - 6);
      const gameId = String(vRow[cols.gameId - 1] || '').trim();
      const fbCell = fRow[cols.facebook - 1] || vRow[cols.facebook - 1];
      const fbInfo = parseHyperlink(fbCell);
      const chucVu = String(vRow[cols.chucVu - 1] || 'Thành viên').trim();

      // Tiền 12 tháng
      const months = {};
      for (let m = 1; m <= 12; m++) {
        const colIdx = cols.months[m];
        months[m] = parseAmount(vRow[colIdx - 1]);
      }

      const ungHo = parseAmount(vRow[cols.ungHo - 1]);
      const tienPhat = parseAmount(vRow[cols.tienPhat - 1]);
      const ttv = parseAmount(vRow[cols.ttv - 1]);

      // Tổng đóng góp = SUM(Tháng 1..12 + Ủng hộ + Phạt), KHÔNG tính TTV
      let calculatedTotal = 0;
      for (let m = 1; m <= 12; m++) calculatedTotal += months[m];
      calculatedTotal += ungHo + tienPhat;

      const rawTotal = vRow[cols.tongDongGop - 1];
      const tongDongGop = typeof rawTotal === 'number' ? rawTotal : calculatedTotal;

      if (gameId) {
        idCountMap[gameId] = (idCountMap[gameId] || 0) + 1;
      }

      members.push({
        rowIndex: r + 1, // 1-indexed trong sheet
        stt,
        tenIngame: ingame,
        gameId,
        facebookName: fbInfo.name || ingame,
        facebookUrl: fbInfo.url,
        chucVu,
        months,
        ungHo,
        tienPhat,
        ttv,
        tongDongGop
      });
    }

    // Đánh dấu cảnh báo trùng ID game (ví dụ STT 22 và 23 trùng ID 568217293)
    members.forEach(m => {
      m.isDuplicateId = Boolean(m.gameId && idCountMap[m.gameId] > 1);
    });

    // Thống kê 4 ô
    const totalMembers = members.length;
    const banQuanTri = members.filter(m => ['Leader', 'Co-Leader', 'QTV'].includes(m.chucVu)).length;
    const thanhVienChinhThuc = members.filter(m => m.chucVu === 'Thành viên').length;
    const tongThuQuy = members.reduce((sum, m) => sum + (m.tongDongGop || 0), 0);

    // Dòng tổng cộng
    const totalRow = {
      rowIndex: summaryRowIdx + 1,
      months: {},
      ungHo: 0,
      tienPhat: 0,
      ttv: 0,
      tongDongGop: 0
    };

    for (let m = 1; m <= 12; m++) {
      totalRow.months[m] = members.reduce((sum, member) => sum + member.months[m], 0);
    }
    totalRow.ungHo = members.reduce((sum, member) => sum + member.ungHo, 0);
    totalRow.tienPhat = members.reduce((sum, member) => sum + member.tienPhat, 0);
    totalRow.ttv = members.reduce((sum, member) => sum + member.ttv, 0);
    totalRow.tongDongGop = members.reduce((sum, member) => sum + member.tongDongGop, 0);

    return {
      year: sheetName,
      summaryRowIndex: summaryRowIdx + 1,
      columns: cols,
      stats: {
        totalMembers,
        banQuanTri,
        thanhVienChinhThuc,
        tongThuQuy
      },
      totalRow,
      members
    };
  }

  /**
   * Đọc danh sách tài khoản từ sheet "Account"
   */
  async getAccounts(yearSheet = '2026') {
    await this.ensureAccountSheet();

    let rows = [];
    if (this.isMock) {
      const store = this._initMockStore();
      rows = store['Account'] || [];
    } else {
      const vals = await this.getRangeValues('Account', 'A1:G100', 'UNFORMATTED_VALUE');
      rows = vals;
    }

    if (rows.length <= 1) return [];

    // Đọc danh sách thành viên từ sheet năm để lấy Role tương ứng
    const yearData = await this.getYearSheetData(yearSheet);
    const memberRoleMap = {};
    for (const m of yearData.members) {
      memberRoleMap[m.tenIngame.trim()] = m.chucVu;
    }

    const accounts = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;

      const username = String(r[0]).trim();
      const passwordHash = String(r[1] || '');
      const tenIngame = String(r[2] || '').trim();
      const status = String(r[3] || 'active').trim();
      const createdAt = r[4] ? String(r[4]) : new Date().toISOString();
      const lastLogin = r[5] ? String(r[5]) : null;

      // Cột G: Quyền ghi quỹ (TRUE/FALSE)
      let canEditFund = false;
      const gVal = r[6];
      if (typeof gVal === 'boolean') {
        canEditFund = gVal;
      } else if (typeof gVal === 'string') {
        canEditFund = gVal.trim().toUpperCase() === 'TRUE';
      }

      // Role lấy từ Chức vụ trong sheet năm
      const role = memberRoleMap[tenIngame] || 'Thành viên';

      // Leader luôn có canEditFund = true
      if (role === 'Leader') {
        canEditFund = true;
      }

      accounts.push({
        rowIndex: i + 1,
        username,
        passwordHash,
        tenIngame,
        status,
        createdAt,
        lastLogin,
        canEditFund,
        role
      });
    }

    return accounts;
  }

  /**
   * Đảm bảo sheet Account có header chuẩn
   */
  async ensureAccountSheet() {
    const headers = [
      'Username',
      'PasswordHash',
      'Tên Ingame',
      'Trạng thái',
      'Ngày tạo',
      'Lần đăng nhập cuối',
      'Quyền ghi quỹ'
    ];

    if (this.isMock) {
      const store = this._initMockStore();
      if (!store['Account'] || store['Account'].length === 0) {
        store['Account'] = [headers];
      }
      return;
    }

    await this.getSheetId('Account');
    const existing = await this.getRangeValues('Account', 'A1:G1');
    if (!existing || existing.length === 0 || !existing[0] || existing[0].length === 0) {
      await this.sheetsClient.spreadsheets.values.update({
        spreadsheetId: this.sheetId,
        range: 'Account!A1:G1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [headers]
        }
      });
    }
  }

  /**
   * Đảm bảo sheet Log có header chuẩn
   */
  async ensureLogSheet() {
    const headers = ['Thời gian', 'Username', 'Hành động', 'Đối tượng', 'Giá trị cũ', 'Giá trị mới'];

    if (this.isMock) {
      const store = this._initMockStore();
      if (!store['Log'] || store['Log'].length === 0) {
        store['Log'] = [headers];
      }
      return;
    }

    await this.getSheetId('Log');
    const existing = await this.getRangeValues('Log', 'A1:F1');
    if (!existing || existing.length === 0 || !existing[0] || existing[0].length === 0) {
      await this.sheetsClient.spreadsheets.values.update({
        spreadsheetId: this.sheetId,
        range: 'Log!A1:F1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [headers]
        }
      });
    }
  }

  /**
   * Ghi Log hoạt động vào sheet Log
   */
  async appendLog({ username, action, target, oldValue = '', newValue = '' }) {
    await this.ensureLogSheet();
    const now = new Date().toISOString();
    const row = [
      now,
      sanitizeSheetValue(username || 'system'),
      sanitizeSheetValue(action || ''),
      sanitizeSheetValue(target || ''),
      typeof oldValue === 'object' ? JSON.stringify(oldValue) : sanitizeSheetValue(String(oldValue || '')),
      typeof newValue === 'object' ? JSON.stringify(newValue) : sanitizeSheetValue(String(newValue || ''))
    ];

    if (this.isMock) {
      const store = this._initMockStore();
      store['Log'].push(row);
      return;
    }

    await this.sheetsClient.spreadsheets.values.append({
      spreadsheetId: this.sheetId,
      range: 'Log!A:F',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row]
      }
    });
  }

  /**
   * Đọc danh sách Log từ sheet Log
   */
  async getLogs(limit = 100) {
    await this.ensureLogSheet();

    let rows = [];
    if (this.isMock) {
      const store = this._initMockStore();
      rows = store['Log'] || [];
    } else {
      const vals = await this.getRangeValues('Log', 'A1:F500', 'UNFORMATTED_VALUE');
      rows = vals;
    }

    if (rows.length <= 1) return [];

    const logs = [];
    // Đọc từ dưới lên để có log mới nhất trước
    for (let i = rows.length - 1; i >= 1; i--) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      logs.push({
        id: i,
        timestamp: r[0],
        username: r[1],
        action: r[2],
        target: r[3],
        oldValue: r[4],
        newValue: r[5]
      });
      if (logs.length >= limit) break;
    }

    return logs;
  }

  /**
   * Thêm thành viên mới (chèn dòng mới trước dòng TỔNG CỘNG)
   */
  async addMember(yearSheet = '2026', memberData, actorUsername) {
    return await mutex.runExclusive(async () => {
      const sheetData = await this.getYearSheetData(yearSheet);
      const cols = sheetData.columns;
      const summaryRow = sheetData.summaryRowIndex; // 1-indexed

      // Kiểm tra trùng Tên Ingame
      const existingName = sheetData.members.find(
        m => m.tenIngame.toLowerCase() === memberData.tenIngame.trim().toLowerCase()
      );
      if (existingName) {
        const error = new Error(`Tên Ingame "${memberData.tenIngame}" đã tồn tại!`);
        error.statusCode = 400;
        throw error;
      }

      const insertRow = summaryRow; // Chèn ngay trước dòng TỔNG CỘNG
      const newStt = insertRow - 7;
      const fbFormula = buildHyperlinkFormula(
        memberData.facebookName || memberData.tenIngame,
        memberData.facebookUrl || ''
      );

      // Công thức SUM cho dòng mới: từ Tháng 1 đến Tiền phạt (G..T)
      const startLetter = colIndexToLetter(cols.months[1]);
      const endLetter = colIndexToLetter(cols.tienPhat);
      const totalFormula = `=SUM(${startLetter}${insertRow}:${endLetter}${insertRow})`;

      // Xây dựng dòng mới với kích thước đúng 22 cột (A..V)
      const newRowVals = new Array(cols.tongDongGop).fill('');
      newRowVals[cols.stt - 1] = newStt;
      newRowVals[cols.tenIngame - 1] = sanitizeSheetValue(memberData.tenIngame.trim());
      newRowVals[cols.gameId - 1] = sanitizeSheetValue(memberData.gameId ? String(memberData.gameId).trim() : '');
      newRowVals[cols.facebook - 1] = fbFormula;
      newRowVals[cols.chucVu - 1] = memberData.chucVu || 'Thành viên';
      newRowVals[cols.tongDongGop - 1] = totalFormula;

      if (this.isMock) {
        const store = this._initMockStore();
        const sheet = store[yearSheet];
        // Chèn vào vị trí insertRow - 1 trong mảng 0-based
        sheet.splice(insertRow - 1, 0, newRowVals);

        // Đánh lại STT các dòng phía sau (nếu có)
        for (let r = 7; r < sheet.length; r++) {
          if (sheet[r][cols.stt - 1] === 'TỔNG CỘNG') break;
          sheet[r][cols.stt - 1] = r - 6;
        }
      } else {
        const sheetId = await this.getSheetId(yearSheet);

        // 1. Chèn thêm 1 dòng trống tại vị trí insertRow
        await this.sheetsClient.spreadsheets.batchUpdate({
          spreadsheetId: this.sheetId,
          requestBody: {
            requests: [
              {
                insertDimension: {
                  range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: insertRow - 1,
                    endIndex: insertRow
                  },
                  inheritFromBefore: true
                }
              }
            ]
          }
        });

        // 2. Ghi dữ liệu vào dòng vừa chèn
        const range = `${yearSheet}!A${insertRow}:${colIndexToLetter(cols.tongDongGop)}${insertRow}`;
        await this.sheetsClient.spreadsheets.values.update({
          spreadsheetId: this.sheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [newRowVals]
          }
        });

        // 3. Cập nhật lại công thức K4 để đếm đúng Thành viên ở cột F
        await this.fixStatisticsFormulas(yearSheet, insertRow + 1);
      }

      await this.appendLog({
        username: actorUsername,
        action: 'THEM_THANH_VIEN',
        target: memberData.tenIngame,
        oldValue: '',
        newValue: {
          tenIngame: memberData.tenIngame,
          gameId: memberData.gameId,
          chucVu: memberData.chucVu
        }
      });

      return {
        success: true,
        stt: newStt,
        rowIndex: insertRow,
        tenIngame: memberData.tenIngame
      };
    });
  }

  /**
   * Sửa công thức thống kê ở ô K4 (và đảm bảo chuẩn các ô thống kê hàng 4)
   */
  async fixStatisticsFormulas(yearSheet, summaryRow) {
    if (this.isMock) {
      const store = this._initMockStore();
      const sheet = store[yearSheet];
      if (sheet && sheet[3]) {
        sheet[3][10] = `=COUNTIF(F8:F${summaryRow - 1}, "Thành viên")`;
      }
      return;
    }

    try {
      const lastDataRow = summaryRow - 1;
      const k4Formula = `=COUNTIF(F8:F${lastDataRow}, "Thành viên")`;
      await this.sheetsClient.spreadsheets.values.update({
        spreadsheetId: this.sheetId,
        range: `${yearSheet}!K4`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[k4Formula]]
        }
      });
    } catch (e) {
      console.warn('Lỗi cập nhật K4:', e.message);
    }
  }

  /**
   * Chỉnh sửa thông tin thành viên (có kiểm tra chống ghi đè stale data)
   */
  async editMember(yearSheet = '2026', rowIndex, clientData, actorUser) {
    return await mutex.runExclusive(async () => {
      const sheetData = await this.getYearSheetData(yearSheet);
      const cols = sheetData.columns;
      const targetMember = sheetData.members.find(m => m.rowIndex === rowIndex);

      if (!targetMember) {
        const error = new Error(`Không tìm thấy thành viên tại dòng ${rowIndex}`);
        error.statusCode = 404;
        throw error;
      }

      // Kiểm tra Stale Data: so sánh Tên Ingame + ID game
      if (
        clientData.expectedIngame &&
        clientData.expectedIngame.trim() !== targetMember.tenIngame.trim()
      ) {
        const err = new Error('Dữ liệu đã bị thay đổi bởi người khác, vui lòng tải lại!');
        err.statusCode = 409;
        throw err;
      }

      if (
        clientData.expectedGameId &&
        String(clientData.expectedGameId).trim() !== String(targetMember.gameId).trim()
      ) {
        const err = new Error('Dữ liệu đã bị thay đổi bởi người khác, vui lòng tải lại!');
        err.statusCode = 409;
        throw err;
      }

      // Kiểm tra nếu đổi tên Ingame có bị trùng với người khác không
      if (clientData.tenIngame && clientData.tenIngame.trim() !== targetMember.tenIngame) {
        const dup = sheetData.members.find(
          m => m.rowIndex !== rowIndex && m.tenIngame.toLowerCase() === clientData.tenIngame.trim().toLowerCase()
        );
        if (dup) {
          const err = new Error(`Tên Ingame "${clientData.tenIngame}" đã tồn tại!`);
          err.statusCode = 400;
          throw err;
        }
      }

      const updates = [];
      const oldValues = {};
      const newValues = {};

      // 1. Tên Ingame
      if (clientData.tenIngame !== undefined && clientData.tenIngame !== targetMember.tenIngame) {
        oldValues.tenIngame = targetMember.tenIngame;
        newValues.tenIngame = clientData.tenIngame;
        updates.push({
          col: cols.tenIngame,
          value: sanitizeSheetValue(clientData.tenIngame.trim())
        });
      }

      // 2. ID game
      if (clientData.gameId !== undefined && String(clientData.gameId) !== String(targetMember.gameId)) {
        oldValues.gameId = targetMember.gameId;
        newValues.gameId = clientData.gameId;
        updates.push({
          col: cols.gameId,
          value: sanitizeSheetValue(String(clientData.gameId).trim())
        });
      }

      // 3. Facebook
      const nextFbName = clientData.facebookName !== undefined ? clientData.facebookName : targetMember.facebookName;
      const nextFbUrl = clientData.facebookUrl !== undefined ? clientData.facebookUrl : targetMember.facebookUrl;
      if (
        (clientData.facebookName !== undefined && clientData.facebookName !== targetMember.facebookName) ||
        (clientData.facebookUrl !== undefined && clientData.facebookUrl !== targetMember.facebookUrl)
      ) {
        oldValues.facebook = { name: targetMember.facebookName, url: targetMember.facebookUrl };
        newValues.facebook = { name: nextFbName, url: nextFbUrl };
        updates.push({
          col: cols.facebook,
          value: buildHyperlinkFormula(nextFbName, nextFbUrl)
        });
      }

      // 4. Chức vụ (Chỉ Leader mới được sửa Chức vụ)
      if (clientData.chucVu !== undefined && clientData.chucVu !== targetMember.chucVu) {
        if (actorUser.role !== 'Leader') {
          const err = new Error('Chỉ Leader mới có quyền thay đổi Chức vụ!');
          err.statusCode = 403;
          throw err;
        }
        oldValues.chucVu = targetMember.chucVu;
        newValues.chucVu = clientData.chucVu;
        updates.push({
          col: cols.chucVu,
          value: clientData.chucVu
        });
      }

      // Ghi các ô thay đổi
      if (updates.length > 0) {
        if (this.isMock) {
          const store = this._initMockStore();
          const sheet = store[yearSheet];
          for (const u of updates) {
            sheet[rowIndex - 1][u.col - 1] = u.value;
          }
        } else {
          const batchData = updates.map(u => ({
            range: `${yearSheet}!${colIndexToLetter(u.col)}${rowIndex}`,
            values: [[u.value]]
          }));

          await this.sheetsClient.spreadsheets.values.batchUpdate({
            spreadsheetId: this.sheetId,
            requestBody: {
              valueInputOption: 'USER_ENTERED',
              data: batchData
            }
          });
        }

        // Nếu đổi Tên Ingame và thành viên có tài khoản thì đổi luôn ở sheet Account
        if (newValues.tenIngame) {
          await this.syncAccountIngameName(targetMember.tenIngame, newValues.tenIngame);
        }

        await this.appendLog({
          username: actorUser.username,
          action: 'SUA_THANH_VIEN',
          target: targetMember.tenIngame,
          oldValue: oldValues,
          newValue: newValues
        });
      }

      return {
        success: true,
        rowIndex,
        updatedFields: newValues
      };
    });
  }

  /**
   * Xoá thành viên (dùng deleteDimension và đánh lại STT)
   */
  async deleteMember(yearSheet = '2026', rowIndex, clientData, actorUser) {
    return await mutex.runExclusive(async () => {
      const sheetData = await this.getYearSheetData(yearSheet);
      const cols = sheetData.columns;
      const targetMember = sheetData.members.find(m => m.rowIndex === rowIndex);

      if (!targetMember) {
        const error = new Error(`Không tìm thấy thành viên tại dòng ${rowIndex}`);
        error.statusCode = 404;
        throw error;
      }

      // Kiểm tra Stale Data
      if (
        clientData.expectedIngame &&
        clientData.expectedIngame.trim() !== targetMember.tenIngame.trim()
      ) {
        const err = new Error('Dữ liệu đã bị thay đổi bởi người khác, vui lòng tải lại!');
        err.statusCode = 409;
        throw err;
      }

      // Kiểm tra nếu thành viên có tài khoản quản trị thì CHẶN XOÁ
      const accounts = await this.getAccounts(yearSheet);
      const linkedAccount = accounts.find(
        a => a.tenIngame.toLowerCase() === targetMember.tenIngame.toLowerCase()
      );
      if (linkedAccount) {
        const err = new Error(
          `Thành viên này đang có tài khoản quản trị (${linkedAccount.username}). Vui lòng xoá tài khoản trước!`
        );
        err.statusCode = 400;
        throw err;
      }

      // Co-Leader không được xoá thành viên đã có đóng góp > 0
      if (actorUser.role === 'Co-Leader' && (targetMember.tongDongGop || 0) > 0) {
        const err = new Error('Co-Leader không được phép xoá thành viên đã có đóng góp quỹ > 0!');
        err.statusCode = 403;
        throw err;
      }

      const summaryRow = sheetData.summaryRowIndex;

      if (this.isMock) {
        const store = this._initMockStore();
        const sheet = store[yearSheet];
        // Xoá dòng tại rowIndex - 1
        sheet.splice(rowIndex - 1, 1);

        // Đánh lại STT
        for (let r = 7; r < sheet.length; r++) {
          if (sheet[r][cols.stt - 1] === 'TỔNG CỘNG') break;
          sheet[r][cols.stt - 1] = r - 6;
        }
      } else {
        const sheetId = await this.getSheetId(yearSheet);

        // 1. Xoá dòng bằng deleteDimension
        await this.sheetsClient.spreadsheets.batchUpdate({
          spreadsheetId: this.sheetId,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: rowIndex - 1,
                    endIndex: rowIndex
                  }
                }
              }
            ]
          }
        });

        // 2. Đánh lại STT liên tục cho các dòng dữ liệu (từ dòng 8 đến dòng tổng cộng mới)
        const newSummaryRow = summaryRow - 1;
        const totalDataRows = newSummaryRow - 8;
        if (totalDataRows > 0) {
          const sttVals = [];
          for (let i = 1; i <= totalDataRows; i++) {
            sttVals.push([i]);
          }
          await this.sheetsClient.spreadsheets.values.update({
            spreadsheetId: this.sheetId,
            range: `${yearSheet}!${colIndexToLetter(cols.stt)}8:${colIndexToLetter(cols.stt)}${newSummaryRow - 1}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: sttVals
            }
          });
        }

        // 3. Sửa lại công thức K4
        await this.fixStatisticsFormulas(yearSheet, newSummaryRow);
      }

      await this.appendLog({
        username: actorUser.username,
        action: 'XOA_THANH_VIEN',
        target: targetMember.tenIngame,
        oldValue: {
          stt: targetMember.stt,
          tenIngame: targetMember.tenIngame,
          gameId: targetMember.gameId,
          chucVu: targetMember.chucVu,
          tongDongGop: targetMember.tongDongGop
        },
        newValue: 'ĐÃ XOÁ'
      });

      return {
        success: true,
        deletedMember: targetMember.tenIngame
      };
    });
  }

  /**
   * Ghi nhận quỹ (Tháng 1-12, Ủng hộ, Phạt, TTV)
   */
  async recordFund(yearSheet = '2026', rowIndex, field, amount, actorUser) {
    return await mutex.runExclusive(async () => {
      const sheetData = await this.getYearSheetData(yearSheet);
      const cols = sheetData.columns;
      const targetMember = sheetData.members.find(m => m.rowIndex === rowIndex);

      if (!targetMember) {
        const error = new Error(`Không tìm thấy thành viên tại dòng ${rowIndex}`);
        error.statusCode = 404;
        throw error;
      }

      // Xác định cột tương ứng
      let targetCol = -1;
      let fieldLabel = field;

      if (field.startsWith('month_') || field.startsWith('thang_')) {
        const m = parseInt(field.replace(/\D/g, ''), 10);
        if (m >= 1 && m <= 12) {
          targetCol = cols.months[m];
          fieldLabel = `Tháng ${m}`;
        }
      } else if (field === 'ungHo' || field === 'ungho') {
        targetCol = cols.ungHo;
        fieldLabel = 'Ủng hộ clan';
      } else if (field === 'tienPhat' || field === 'phat') {
        targetCol = cols.tienPhat;
        fieldLabel = 'Tiền phạt';
      } else if (field === 'ttv') {
        targetCol = cols.ttv;
        fieldLabel = 'TTV';
      }

      if (targetCol === -1) {
        const error = new Error(`Cột quỹ "${field}" không hợp lệ!`);
        error.statusCode = 400;
        throw error;
      }

      const numAmount = parseAmount(amount);
      const oldValue = targetMember.months[parseInt(field.replace(/\D/g, ''), 10)] || targetMember[field] || 0;

      if (this.isMock) {
        const store = this._initMockStore();
        const sheet = store[yearSheet];
        sheet[rowIndex - 1][targetCol - 1] = numAmount;
      } else {
        const cell = `${yearSheet}!${colIndexToLetter(targetCol)}${rowIndex}`;
        await this.sheetsClient.spreadsheets.values.update({
          spreadsheetId: this.sheetId,
          range: cell,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[numAmount]]
          }
        });
      }

      await this.appendLog({
        username: actorUser.username,
        action: 'GHI_QUY',
        target: `${targetMember.tenIngame} (${fieldLabel})`,
        oldValue: oldValue,
        newValue: numAmount
      });

      return {
        success: true,
        rowIndex,
        member: targetMember.tenIngame,
        field: fieldLabel,
        amount: numAmount
      };
    });
  }

  /**
   * Tạo tài khoản mới trong sheet Account
   */
  async createAccount(accountData, actorUsername) {
    return await mutex.runExclusive(async () => {
      await this.ensureAccountSheet();

      // Kiểm tra username trùng
      const accounts = await this.getAccounts();
      const dupUser = accounts.find(
        a => a.username.toLowerCase() === accountData.username.trim().toLowerCase()
      );
      if (dupUser) {
        const err = new Error(`Username "${accountData.username}" đã tồn tại!`);
        err.statusCode = 400;
        throw err;
      }

      // Kiểm tra thành viên đã có tài khoản chưa
      const dupMember = accounts.find(
        a => a.tenIngame.toLowerCase() === accountData.tenIngame.trim().toLowerCase()
      );
      if (dupMember) {
        const err = new Error(`Thành viên "${accountData.tenIngame}" đã có tài khoản (${dupMember.username})!`);
        err.statusCode = 400;
        throw err;
      }

      const now = new Date().toISOString();
      const row = [
        sanitizeSheetValue(accountData.username.trim()),
        accountData.passwordHash,
        sanitizeSheetValue(accountData.tenIngame.trim()),
        accountData.status || 'active',
        now,
        '',
        accountData.canEditFund ? 'TRUE' : 'FALSE'
      ];

      if (this.isMock) {
        const store = this._initMockStore();
        store['Account'].push(row);
        this._saveMockStore();
      } else {
        await this.sheetsClient.spreadsheets.values.append({
          spreadsheetId: this.sheetId,
          range: 'Account!A:G',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [row]
          }
        });
      }

      await this.appendLog({
        username: actorUsername,
        action: 'TAO_TAI_KHOAN',
        target: accountData.username,
        oldValue: '',
        newValue: {
          username: accountData.username,
          tenIngame: accountData.tenIngame,
          canEditFund: accountData.canEditFund
        }
      });

      return { success: true, username: accountData.username };
    });
  }

  /**
   * Cập nhật quyền ghi quỹ (cột G sheet Account)
   */
  async updateFundPermission(username, canEditFund, actorUsername) {
    return await mutex.runExclusive(async () => {
      const accounts = await this.getAccounts();
      const acc = accounts.find(a => a.username.toLowerCase() === username.trim().toLowerCase());

      if (!acc) {
        const err = new Error(`Không tìm thấy tài khoản "${username}"`);
        err.statusCode = 404;
        throw err;
      }

      if (acc.role === 'Leader') {
        const err = new Error('Không thể thay đổi quyền ghi quỹ của Leader (luôn luôn có quyền)!');
        err.statusCode = 400;
        throw err;
      }

      const boolVal = Boolean(canEditFund);
      const strVal = boolVal ? 'TRUE' : 'FALSE';

      if (this.isMock) {
        const store = this._initMockStore();
        store['Account'][acc.rowIndex - 1][6] = strVal;
        this._saveMockStore();
      } else {
        await this.sheetsClient.spreadsheets.values.update({
          spreadsheetId: this.sheetId,
          range: `Account!G${acc.rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[strVal]]
          }
        });
      }

      await this.appendLog({
        username: actorUsername,
        action: boolVal ? 'CAP_QUYEN_GHI_QUY' : 'THU_HOI_QUYEN_GHI_QUY',
        target: `${acc.username} (${acc.tenIngame})`,
        oldValue: acc.canEditFund ? 'TRUE' : 'FALSE',
        newValue: strVal
      });

      return { success: true, username, canEditFund: boolVal };
    });
  }

  /**
   * Cập nhật trạng thái tài khoản (active/disabled)
   */
  async updateAccountStatus(username, status, actorUsername) {
    return await mutex.runExclusive(async () => {
      const accounts = await this.getAccounts();
      const acc = accounts.find(a => a.username.toLowerCase() === username.trim().toLowerCase());

      if (!acc) {
        const err = new Error(`Không tìm thấy tài khoản "${username}"`);
        err.statusCode = 404;
        throw err;
      }

      if (acc.role === 'Leader' && status === 'disabled') {
        const err = new Error('Không thể vô hiệu hoá tài khoản Leader!');
        err.statusCode = 400;
        throw err;
      }

      if (this.isMock) {
        const store = this._initMockStore();
        store['Account'][acc.rowIndex - 1][3] = status;
        this._saveMockStore();
      } else {
        await this.sheetsClient.spreadsheets.values.update({
          spreadsheetId: this.sheetId,
          range: `Account!D${acc.rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[status]]
          }
        });
      }

      await this.appendLog({
        username: actorUsername,
        action: 'DOI_TRANG_THAI_TK',
        target: username,
        oldValue: acc.status,
        newValue: status
      });

      return { success: true, username, status };
    });
  }

  /**
   * Reset mật khẩu tài khoản
   */
  async resetPassword(username, newPasswordHash, actorUsername) {
    return await mutex.runExclusive(async () => {
      const accounts = await this.getAccounts();
      const acc = accounts.find(a => a.username.toLowerCase() === username.trim().toLowerCase());

      if (!acc) {
        const err = new Error(`Không tìm thấy tài khoản "${username}"`);
        err.statusCode = 404;
        throw err;
      }

      if (this.isMock) {
        const store = this._initMockStore();
        store['Account'][acc.rowIndex - 1][1] = newPasswordHash;
        this._saveMockStore();
      } else {
        await this.sheetsClient.spreadsheets.values.update({
          spreadsheetId: this.sheetId,
          range: `Account!B${acc.rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[newPasswordHash]]
          }
        });
      }

      await this.appendLog({
        username: actorUsername,
        action: 'RESET_MAT_KHAU',
        target: username,
        oldValue: '***',
        newValue: '***'
      });

      return { success: true, username };
    });
  }

  /**
   * Cập nhật thời gian đăng nhập cuối
   */
  async updateLastLogin(username) {
    try {
      const accounts = await this.getAccounts();
      const acc = accounts.find(a => a.username.toLowerCase() === username.trim().toLowerCase());
      if (!acc) return;

      const now = new Date().toISOString();
      if (this.isMock) {
        const store = this._initMockStore();
        store['Account'][acc.rowIndex - 1][5] = now;
        this._saveMockStore();
      } else {
        await this.sheetsClient.spreadsheets.values.update({
          spreadsheetId: this.sheetId,
          range: `Account!F${acc.rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[now]]
          }
        });
      }
    } catch (e) {
      console.warn('Không thể cập nhật lastLogin:', e.message);
    }
  }

  /**
   * Đồng bộ Tên Ingame trong sheet Account khi đổi Tên Ingame ở sheet năm
   */
  async syncAccountIngameName(oldName, newName) {
    try {
      const accounts = await this.getAccounts();
      const acc = accounts.find(a => a.tenIngame.toLowerCase() === oldName.trim().toLowerCase());
      if (!acc) return;

      if (this.isMock) {
        const store = this._initMockStore();
        store['Account'][acc.rowIndex - 1][2] = newName.trim();
        this._saveMockStore();
      } else {
        await this.sheetsClient.spreadsheets.values.update({
          spreadsheetId: this.sheetId,
          range: `Account!C${acc.rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[sanitizeSheetValue(newName.trim())]]
          }
        });
      }
    } catch (e) {
      console.warn('Không thể syncAccountIngameName:', e.message);
    }
  }

  /**
   * Xoá tài khoản khỏi sheet Account
   */
  async deleteAccount(username, actorUsername) {
    return await mutex.runExclusive(async () => {
      const accounts = await this.getAccounts();
      const acc = accounts.find(a => a.username.toLowerCase() === username.trim().toLowerCase());

      if (!acc) {
        const err = new Error(`Không tìm thấy tài khoản "${username}"`);
        err.statusCode = 404;
        throw err;
      }

      if (acc.role === 'Leader') {
        const err = new Error('Không thể xoá tài khoản Leader!');
        err.statusCode = 400;
        throw err;
      }

      if (this.isMock) {
        const store = this._initMockStore();
        store['Account'].splice(acc.rowIndex - 1, 1);
        this._saveMockStore();
      } else {
        const sheetId = await this.getSheetId('Account');
        await this.sheetsClient.spreadsheets.batchUpdate({
          spreadsheetId: this.sheetId,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: acc.rowIndex - 1,
                    endIndex: acc.rowIndex
                  }
                }
              }
            ]
          }
        });
      }

      await this.appendLog({
        username: actorUsername,
        action: 'XOA_TAI_KHOAN',
        target: `${acc.username} (${acc.tenIngame})`,
        oldValue: acc.username,
        newValue: 'ĐÃ XOÁ'
      });

      return { success: true, username };
    });
  }
}

export const sheetsService = new SheetsService();
