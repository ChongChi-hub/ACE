# HỆ THỐNG QUẢN TRỊ CLAN PUBG MOBILE 『ACE SUN』 👑

Hệ thống web quản trị toàn diện dành riêng cho Ban Quản Trị (Leader, Co-Leader, QTV) của Clan PUBG Mobile **『ACE SUN』**.
Toàn bộ dữ liệu thành viên, tài khoản và lịch sử thao tác được lưu trữ và đọc/ghi trực tiếp vào **Google Sheets** thông qua Google Sheets API v4 (Service Account), **không dùng database riêng**.

---

## 🌟 TÍNH NĂNG NỔI BẬT

1. **Kiến Trúc Đọc/Ghi Trực Tiếp Google Sheets (Realtime Sync)**:
   - Tự động nhận diện cột (header dòng 7) và dòng `TỔNG CỘNG` động (quét cột B).
   - Thêm thành viên: Dùng `insertDimension` chèn trước dòng `TỔNG CỘNG` giúp mọi công thức SUM/COUNT tự động mở rộng; hỗ trợ công thức `=HYPERLINK(...)` cho Facebook và `=SUM(...)` cho Tổng đóng góp.
   - Xoá thành viên: Dùng `deleteDimension` xoá hẳn dòng và tự động đánh lại STT liên tục 1..N.
   - Concurrency Mutex Queue: Đảm bảo các request ghi tuần tự, chống race condition và xung đột dữ liệu.
   - Chống Stale Data: Tự động so sánh Tên Ingame + ID game trước khi sửa/xoá; trả mã 409 nếu dữ liệu trên sheet đã bị thay đổi bởi người khác.
   - Sửa lỗi công thức ô **K4** trên sheet: Tự động sửa từ `=COUNTIF(G8:G{last}, "Thành viên")` sang `=COUNTIF(F8:F{last}, "Thành viên")`.
   - Cột **TTV**: Được hiển thị riêng biệt và ghi chú rõ ràng trên giao diện là "không tính vào Tổng đóng góp" theo đúng công thức `=SUM(G{r}:T{r})`.

2. **Hệ Thống Phân Quyền 2 Lớp (Central Permissions)**:
   - **Lớp 1 - Vai trò (Role)**: Lấy trực tiếp từ cột "Chức vụ" trong sheet năm (`Leader`, `Co-Leader`, `QTV`).
     - **Leader**: Toàn quyền. Luôn luôn có quyền ghi quỹ, quản lý tài khoản BQT, đổi Chức vụ, xem Nhật ký (Logs).
     - **Co-Leader**: Xem Dashboard, xem Quỹ, thêm/sửa/xoá thành viên (không được đổi Chức vụ, không được xoá thành viên đã đóng góp > 0).
     - **QTV**: Xem Dashboard, danh sách thành viên và Quỹ (chế độ chỉ xem).
   - **Lớp 2 - Cờ `canEditFund` (Cột G sheet Account)**:
     - Do Leader bật/tắt cho từng Co-Leader/QTV.
     - Kiểm tra trực tiếp từ sheet Account theo thời gian thực (realtime) cho mỗi thao tác ghi quỹ. Khi Leader thu hồi quyền, người dùng bị chặn ngay lập tức mà không cần đăng nhập lại.

3. **Bảo Mật Tiêu Chuẩn Cao**:
   - Xác thực JWT: Access Token ngắn hạn (15m) + Refresh Token trong cookie `httpOnly` (7 ngày).
   - Rate limit đăng nhập: Khoá 15 phút sau 5 lần nhập sai theo IP + Username.
   - Chống Formula Injection: Tự động prefix `'` nếu dữ liệu nhập bắt đầu bằng `=`, `+`, `-`, `@`.
   - Bảo mật Helmet, CORS whitelisting, Zod input validation toàn diện.

4. **Trải Nghiệm Mobile-First & Dark Mode Đẳng Cấp**:
   - Giao diện Dark/Light mode phong cách PUBG Mobile (Tone màu Amber Hoàng Kim và Slate sang trọng).
   - Responsive hoàn hảo trên iPhone/Android (360px, 390px, 768px, 1280px).
   - Bottom Tab Bar cố định ở đáy màn hình điện thoại (tôn trọng iPhone safe-area `env(safe-area-inset-bottom)`).
   - Trang Quỹ trên mobile: Dạng danh sách thành viên mở rộng (Collapse) với lưới 12 chip tháng tròn (xanh = đã đóng, xám = chưa đóng), chạm để sửa nhanh qua Bottom Sheet.
   - Hỗ trợ cài đặt PWA ("Thêm vào màn hình chính").

---

## 🛠 TECH STACK

- **Frontend**: React 18, Vite, Ant Design v5 (ngôn ngữ Tiếng Việt), Tailwind CSS (đã tắt preflight tránh xung đột Antd), React Router v6, Axios, TanStack Query v5, Recharts, XLSX.
- **Backend**: Node.js, Express, `googleapis` (Google Sheets API v4), `async-mutex`, `jsonwebtoken`, `bcryptjs`, `cookie-parser`, `helmet`, `cors`, `zod`.
- **Testing**: Vitest + Supertest.

---

## 📁 CẤU TRÚC THƯ MỤC

```
clan_ace_sun_v2/
├── package.json             # Root monorepo scripts (dev, test, seed)
├── CLAN_ACE_SUN.xlsx        # File mẫu Google Sheet ban đầu
├── server/
│   ├── .env.example         # File mẫu biến môi trường server
│   ├── .env                 # File cấu hình server
│   ├── src/
│   │   ├── app.js           # Cấu hình Express app, CORS, security
│   │   ├── index.js         # Khởi động server (Port 5001)
│   │   ├── config/
│   │   │   └── permissions.js # Bảng phân quyền trung tâm duy nhất
│   │   ├── controllers/     # Auth, Members, Fund, Accounts, Logs controllers
│   │   ├── middlewares/     # Auth, Role, FundPermission, RateLimit, Validate
│   │   ├── routes/          # Express Routers
│   │   ├── schemas/         # Zod schemas validate input
│   │   ├── services/
│   │   │   └── sheets.service.js # Toàn bộ xử lý Google Sheets API v4
│   │   ├── utils/
│   │   │   └── sheetUtils.js # Formula parsing, hyperlink, anti-injection
│   │   └── scripts/
│   │       └── seedLeader.js # Script CLI khởi tạo tài khoản Leader
│   └── test/
│       └── auth_and_permissions.test.js # Test suite kiểm thử phân quyền
└── client/
    ├── vite.config.js       # Vite config + Proxy API về port 5001
    ├── tailwind.config.js   # Tailwind config (preflight: false)
    ├── src/
    │   ├── api/client.js    # Axios instance + auto refresh token
    │   ├── context/         # AuthContext, ThemeContext
    │   ├── layouts/         # MainLayout (Navbar, Sidebar, Mobile Tab Bar)
    │   ├── pages/           # Login, Dashboard, Members, Fund, Accounts, Logs, Profile
    │   ├── components/      # RoleTag, ChangePasswordModal
    │   └── hooks/           # useIsMobile responsive hook
```

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT & CHẠY DỰ ÁN

### 1. Cài đặt Dependencies
Tại thư mục gốc của dự án:
```bash
npm install
```

### 2. Thiết lập Biến Môi Trường (.env)
Sao chép file mẫu tại thư mục `server/.env.example` thành `server/.env`:
```bash
cp server/.env.example server/.env
```

Nội dung file `server/.env`:
```env
PORT=5001
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173

JWT_SECRET=ace_sun_jwt_secret_dev_key_2026_xyz!@#
REFRESH_SECRET=ace_sun_refresh_secret_dev_key_2026_abc$%^

# Cấu hình Google Sheets API (Xem hướng dẫn Google Cloud bên dưới)
GOOGLE_SHEET_ID=1HvMMh0bJXSAg6iVNTtHBHi_faW9GKS3kAmCcBGlhuRg
GOOGLE_SERVICE_ACCOUNT_EMAIL=ace-sun-service@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"

# Khi chưa điền credentials Google, hệ thống tự động chạy Mock Mode với file CLAN_ACE_SUN.xlsx
```

### 3. Khởi tạo Tài Khoản Leader Đầu Tiên
Chạy script seed từ dòng lệnh:
```bash
npm run seed:leader
```
Hoặc truyền trực tiếp username và mật khẩu:
```bash
npm run seed:leader admin Leader@2026!
```

### 4. Chạy Ứng Dụng ở Chế Độ Phát Triển (Development)
Chạy đồng thời cả Server và Client:
```bash
npm run dev
```
- **Backend API**: `http://localhost:5001`
- **Frontend Web**: `http://localhost:5173`

Đăng nhập tài khoản Leader:
- **Tài khoản**: `admin`
- **Mật khẩu**: `Leader@2026!`

---

## 🧪 CHẠY BỘ KIỂM THỬ TỰ ĐỘNG (TEST SUITE)

Hệ thống đi kèm bộ test tự động kiểm thử toàn diện 8 kịch bản phân quyền và bảo mật:
1. Người chưa đăng nhập nhận `401 Unauthorized`.
2. Co-Leader/QTV chưa được cấp quyền ghi quỹ nhận `403 Forbidden`.
3. Sau khi Leader bật `canEditFund` thì Co-Leader ghi quỹ thành công `200 OK`.
4. Sau khi Leader thu hồi quyền thì Co-Leader bị chặn `403 Forbidden` ngay lập tức (kiểm tra realtime từ sheet).
5. Co-Leader và QTV không thể tự bật quyền cho mình hoặc người khác.
6. Co-Leader không có quyền thay đổi Chức vụ thành viên (`403 Forbidden`).
7. Co-Leader không được xoá thành viên đã có đóng góp quỹ > 0 (`403 Forbidden`).
8. Chặn xoá thành viên đang có tài khoản quản trị (`400 Bad Request`).

Chạy lệnh:
```bash
npm test
```

---

## ☁️ HƯỚNG DẪN KẾT NỐI GOOGLE CLOUD SERVICE ACCOUNT

Để kết nối web với Google Sheet thực tế của Clan:

### Bước 1: Tạo Dự án trên Google Cloud Console
1. Truy cập [Google Cloud Console](https://console.cloud.google.com/).
2. Tạo một Project mới (ví dụ: `Clan-ACE-SUN-Admin`).

### Bước 2: Bật Google Sheets API
1. Vào mục **APIs & Services** > **Library**.
2. Tìm kiếm **Google Sheets API** và bấm **Enable** (Bật).

### Bước 3: Tạo Service Account và Tải Private Key
1. Vào **APIs & Services** > **Credentials** > Bấm **Create Credentials** > Chọn **Service Account**.
2. Đặt tên Service Account (ví dụ: `ace-sun-sheet-service`) > Bấm **Create and Continue** > **Done**.
3. Nhấp vào Service Account vừa tạo > Chuyển sang tab **Keys** > Bấm **Add Key** > **Create new key** > Chọn định dạng **JSON** và tải file về máy.
4. Mở file JSON vừa tải, bạn sẽ thấy:
   - `client_email`: Địa chỉ email dạng `...iam.gserviceaccount.com`.
   - `private_key`: Chuỗi khoá bắt đầu bằng `-----BEGIN PRIVATE KEY-----`.

### Bước 4: Chia sẻ Google Sheet cho Email Service Account
1. Mở file Google Sheet của Clan trên trình duyệt.
2. Bấm nút **Chia sẻ** (Share) ở góc trên bên phải.
3. Dán địa chỉ email `client_email` của Service Account vào.
4. Phân quyền: **Người chỉnh sửa (Editor)** > Bỏ tích thông báo qua email > Bấm **Chia sẻ**.
5. Copy ID của Spreadsheet từ URL:
   `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`

### Bước 5: Cập nhật file `.env`
Điền các giá trị vào `server/.env`:
```env
GOOGLE_SHEET_ID=Điền_Spreadsheet_ID
GOOGLE_SERVICE_ACCOUNT_EMAIL=Điền_client_email
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

## 🌐 HƯỚNG DẪN TRIỂN KHAI (DEPLOY)

### 1. Triển khai Backend (Render / VPS / Railway)
- **Cấu hình trên Render/VPS**:
  - Root directory: `server`
  - Build command: `npm install`
  - Start command: `node src/index.js`
  - Environment variables: Điền đầy đủ các biến trong `.env` (`PORT`, `JWT_SECRET`, `REFRESH_SECRET`, `FRONTEND_ORIGIN`, `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`).

### 2. Triển khai Frontend (Vercel / GitHub Pages)
- **Vercel**:
  - Framework Preset: `Vite`
  - Root Directory: `client`
  - Build Command: `npm run build`
  - Output Directory: `dist`
  - Environment Variables:
    - Nếu deploy backend riêng biệt, trong `client/src/api/client.js` có thể cấu hình `baseURL` trỏ về domain backend (ví dụ: `https://api-clan-acesun.onrender.com/api`).
- **GitHub Pages**:
  - Dùng SPA fallback (file `404.html` sao chép từ `index.html`) hoặc chuyển sang `HashRouter` trong `client/src/App.jsx` để tránh lỗi 404 khi người dùng F5 tải lại trang.

---

## 📝 GHI CHÚ QUAN TRỌNG VỀ DỮ LIỆU GOOGLE SHEETS

1. **Sửa công thức ô K4 (Thành viên chính thức)**:
   - Trong file Excel mẫu, ô K4 có công thức `=COUNTIF(G8:G44, "Thành viên")` (đang đếm sai ở cột Tháng 1 - cột G).
   - Hệ thống tự động sửa ô K4 thành `=COUNTIF(F8:F{lastRow}, "Thành viên")` để đếm chính xác cột Chức vụ (cột F).
2. **Cột TTV (Cột U)**:
   - Theo định nghĩa của Clan, cột TTV là khoản riêng, không nằm trong công thức tổng đóng góp `=SUM(G{r}:T{r})`.
   - Web thể hiện cột TTV độc lập với chú thích rõ ràng để tránh nhầm lẫn cho Ban quản trị.
3. **Cảnh báo trùng ID Game (STT 22 và 23)**:
   - Trong dữ liệu hiện tại, STT 22 (`『ACE』BinJp`) và STT 23 (`『ACE』Títs`) đều có cùng ID game `568217293`.
   - Hệ thống hiển thị huy hiệu cảnh báo màu vàng **⚠️ Trùng ID** tại cột ID Game để Ban Quản Trị dễ dàng nhận diện và rà soát mà không chặn dữ liệu cũ.

---

*Clan ACE SUN PUBG Mobile © 2026 • Được xây dựng với tính bảo mật và trải nghiệm người dùng tối đa.*
