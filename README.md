# 👑 『ACE SUN』- Cổng Quản Lý Clan PUBG Mobile

Hệ thống quản lý clan PUBG Mobile **『ACE SUN』** phiên bản 2.0 hoạt động 100% Serverless trên nền tảng **React 18 + Vite + Tailwind CSS + Ant Design** và lưu trữ đồng bộ thời gian thực với **Google Sheets & Google Apps Script**.

---

## ✨ Tính Năng Nổi Bật

- 🛡️ **Quản Lý Thành Viên**:
  - Xem danh sách dạng Thẻ (Cards) hoặc Bảng (Table).
  - Tìm kiếm theo Ingame, ID Game, Facebook.
  - Phân quyền Leader, Co-Leader, QTV, Thành viên.
  - Hỗ trợ đổi theme Sáng / Tối (Light & Dark mode).
- 💰 **Quản Lý Thu Quỹ Clan**:
  - Theo dõi quỹ 12 tháng, Quỹ ủng hộ, Tiền phạt và Tuyển thành viên (TTV).
  - Chuyển đổi linh hoạt giữa Dạng Bảng ma trận và Dạng Thẻ gọn gàng.
  - Lọc nhanh thành viên chưa đóng quỹ theo từng tháng.
  - **Báo Cáo Nhanh**: Tự động tổng hợp và soạn sẵn nội dung nhắc nhở danh sách thành viên chưa đóng quỹ, hỗ trợ 1-click sao chép gửi vào Zalo / Messenger.
  - Đồng bộ và tự động tính toán hai chiều với Google Sheets.
- 🔐 **Bảo Mật & Phân Quyền**:
  - Xác thực tài khoản BQT bằng SHA-256.
  - Phân quyền ghi quỹ riêng biệt cho từng thành viên BQT.
  - Ghi nhật ký thao tác (Log) tự động theo thời gian thực.

---

## 🚀 Cài Đặt & Phát Triển Cục Bộ

1. **Clone repository**:
   ```bash
   git clone git@github.com:ChongChi-hub/ACE.git
   cd ACE
   ```

2. **Cài đặt dependencies**:
   ```bash
   npm run install:all
   ```

3. **Cấu hình môi trường**:
   Tạo file `client/.env`:
   ```env
   VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycb.../exec
   ```

4. **Chạy máy chủ dev**:
   ```bash
   npm run dev
   ```
   Truy cập: `http://localhost:5173/`

5. **Build cho GitHub Pages**:
   ```bash
   npm run build
   ```

---

## 📜 Giấy Phép & Bản Quyền

Dự án phát triển riêng cho Clan PUBG Mobile **『ACE SUN』**.
Mọi quyền được bảo lưu © 2026.
