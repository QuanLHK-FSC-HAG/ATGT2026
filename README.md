# 🚦 SafeRide EDU AI 2026 — Thế Giới 3D An Toàn Giao Thông Học Đường Việt Nam

<div align="center">

![SafeRide EDU AI Banner](https://img.shields.io/badge/SafeRide-EDU%20AI%202026-brightgreen?style=for-the-badge&logo=googlechrome&logoColor=white)
![Build Status](https://img.shields.io/badge/Build-Local%20verified-success?style=for-the-badge)
![Unit QA Tests](https://img.shields.io/badge/QA%20Tests-33%2F33%20PASS-blue?style=for-the-badge)

![License](https://img.shields.io/badge/License-MIT-blueviolet?style=for-the-badge)
![Google Sheets Online](https://img.shields.io/badge/Google%20Sheets-Live%20Sync%20(8%20Sheets)-yellow?style=for-the-badge&logo=googlesheets)

**Sáng kiến Giáo dục Kỹ năng Giao thông Học đường Thực tế ảo 3D dành cho Học sinh THCS & THPT Việt Nam**

[🌐 Trải nghiệm Trực tiếp](#-hướng-dẫn-chạy-ứng-dụng) • [🎮 Tính năng Nổi bật](#-tính-năng-nổi-bật) • [🏗️ Kiến trúc Công nghệ](#-kiến-trúc-công-nghệ) • [📊 Cấu trúc Dữ liệu](#-đồng-bộ-dữ-liệu-google-sheets)

</div>

---

## 🌟 Điểm Nhấn Sáng Tạo (Game-First Educational Experience)

SafeRide EDU AI không phải website thông thường, mà được thiết kế như một **trò chơi giáo dục 3D tương tác thực thụ** kết hợp triết lý **Duolingo-inspired Tactile UX**:
- **100% Thuần Việt**: Giao diện và lời dẫn chuẩn mực văn phong giáo dục Việt Nam, thân thiện với lứa tuổi học sinh.
- **Học sinh không cần tài khoản (No-Login Frictionless)**: Chỉ cần 4 trường thông tin cơ bản (*Họ tên, Lớp, Trường, Tỉnh/Thành phố*) là có thể lăn bánh trải nghiệm ngay lập tức.
- **Cơ chế Cấp độ Thử thách Linh hoạt**: Học sinh chủ động chọn cấp độ cho từng lượt chơi (*Cơ bản / Nâng cao / Thử thách*), không lưu cứng cấp độ vào hồ sơ cá nhân.
- **Tùy chọn 3 Phương án Trải nghiệm**:
  - 🏫 **Phương án 1 (Mặc định)**: *Thành phố giao thông 3D* — Khám phá ngã tư cổng trường học Việt Nam sinh động.
  - ⚡ **Phương án 2**: *Đấu trường thử thách* — Tích lũy năng lượng an toàn và mở khóa huy hiệu dũng sĩ.
  - 🎒 **Phương án 3**: *Hành trình đến trường* — Vượt từng cột mốc giao thông thực tế từ nhà tới lớp.

---

## 🕹️ Thế Giới 3D Isometric Học Đường

- **Engine 3D Tối ưu 60 FPS**: Tự động tính toán ma trận phối cảnh không gian 3D, hỗ trợ mượt mà trên cả máy tính và điện thoại thông minh.
- **Môi trường Giao thông Đậm chất Việt Nam**:
  - Cổng trường mái ngói đỏ, cây phượng vĩ nở hoa, vỉa hè lát đá hoa văn.
  - Đường nhựa 2 chiều với vạch tim đường nét đứt màu vàng chuẩn quy chuẩn giao thông đường bộ Việt Nam.
  - Vạch đi bộ Zebra Crosswalk và vạch dừng xe trước ngã tư.
  - Hệ thống đèn tín hiệu 3 màu (Xanh / Vàng / Đỏ) tự động chuyển chu kỳ.
  - Xe buýt trường học màu vàng cam, ô tô con và xe tải trọng lớn có vùng cảnh báo điểm mù màu đỏ rực.
- **HUD Điều khiển Game Tinh tế**: Nút xi-nhan Trái/Phải (Q/E), điều hướng lách làn (A/D), Đạp ga (W) và Phanh an toàn (Space) với hiệu ứng lún cơ học Tactile 3D.

---

## 🏗️ Kiến trúc Công nghệ

```
saferide-edu-ai/
├── app/
│   ├── page.tsx               # Màn hình chính 3D & 3 Chế độ học tập
│   ├── admin/page.tsx         # Dashboard Quản trị Nghiên cứu & Biểu đồ
│   ├── api/public/            # API không cần login (onboarding, scenarios, submit, events)
│   ├── api/admin/             # API quản trị bảo mật Google OIDC & Allowlist
│   └── globals.css            # Hệ thống màu sắc ATGT & Tactile Game Styling
├── components/
│   ├── world-3d.tsx           # 3D Isometric City Engine (60 FPS Canvas)
│   └── api.ts                 # API Client kết nối máy chủ & Google Adapter
├── game/
│   └── scenarios.ts           # Danh mục 34 Tỉnh/Thành phố & Kịch bản chuẩn hóa
├── lib/
│   ├── google/storage.ts      # Live Google Sheets & Drive Online Adapter
│   ├── rules/engine.ts        # Thuật toán chấm điểm xác định 2026.1-deterministic
│   └── gemini/engine.ts       # AI sư phạm Zero-PII bảo vệ thông tin học sinh
└── tests/
    ├── unit/domain.test.ts    # 7 Bài kiểm tra đơn vị miền nghiệp vụ
    └── integration/           # 6 Bài kiểm tra tích hợp E2E, Load & Security QA
```

---

## 📊 Đồng Bộ Dữ Liệu Google Sheets Trực Tuyến

Toàn bộ kết quả thực nghiệm được đồng bộ trực tuyến thời gian thực với **Google Sheets ID: `1cb1yNL0GlzktDg-88G-Q-POqCqPHnencAF5O-nC20J8`** qua cấu trúc 8 bảng tiếng Việt không dấu:

1. `bieu_do_thong_ke`: Bảng tổng hợp tự động đếm (`COUNTA`, `COUNTIF`) kèm **Biểu đồ Cột trực quan** phân bố học sinh theo cấp độ chơi.
2. `hoc_sinh`: Danh sách học sinh tham gia trải nghiệm thực tế.
3. `phien_choi`: Ghi nhận mã phiên và cấp độ thử thách của từng lượt.
4. `luot_xu_ly`: Quyết định xử lý tình huống, điểm số và thời gian phản ứng.
5. `su_kien_hanh_vi`: Nhật ký thao tác phanh, xi-nhan và giữ làn trong không gian 3D.
6. `nhat_ky_ai`: Phản hồi sư phạm hỗ trợ học sinh (đã ẩn danh Zero-PII).
7. `so_sanh_truoc_sau`: Đối chứng hiệu quả học tập Pre-Test → Training → Post-Test.
8. `kich_ban_goc`: Kho 160 kịch bản giao thông học đường chuẩn hóa.

---

## 🚀 Hướng Dẫn Chạy Ứng Dụng

**Hiện tại chỉ nghiệm thu local — không public cho đến khi chủ dự án chấp nhận.** Xem [báo cáo nghiệm thu local](docs/LOCAL_ACCEPTANCE.md).

```bash
npm run dev:acceptance -- --store .runtime/local-preview/logical_store.json
```

### Chạy bộ dữ liệu nghiên cứu giả lập công khai

Repository kèm snapshot tổng hợp gồm 1.017 học sinh và 3.051 lượt xử lý. Chuẩn bị
bản sao có thể ghi trong vùng runtime rồi chạy dashboard:

```powershell
npm run data:prepare
npm run dev:dataset
```

Nguồn dữ liệu và mô tả nằm tại `data/research/synthetic-study-2026/`. Toàn bộ hồ
sơ và hoạt động trong snapshot là dữ liệu giả lập, không phải bằng chứng cá nhân
hoặc trường học tham gia thực tế.

Mở `http://127.0.0.1:3001`. Chế độ này cách ly Google/Gemini, dùng kho dữ liệu local riêng và tài khoản admin synthetic `local-admin@example.test`.

### Yêu cầu môi trường
- Node.js 18+ (Đã kiểm nghiệm hoàn hảo trên Node 24.18)
- Trình duyệt Chrome / Edge / Safari / Firefox hiện đại

### Khởi động tại máy
```bash
# 1. Đi vào thư mục mã nguồn
cd saferide-edu-ai

# 2. Khởi chạy máy chủ phát triển
npm run dev

# 3. Mở trình duyệt truy cập:
# -> http://localhost:3000
```

### Chạy Bộ Kiểm Thử QA Toàn Diện
```bash
npx tsx --test tests/unit/*.test.ts tests/integration/*.test.ts
# Kiểm chứng local: 33/33 unit + integration; xem docs/LOCAL_ACCEPTANCE.md
```

### Cấu hình Đăng nhập Quản trị bằng Google
Xem hướng dẫn chi tiết tại [`docs/GOOGLE_AUTH_SETUP.md`](docs/GOOGLE_AUTH_SETUP.md):
tạo OAuth Client ID (Web application), thêm Authorized JavaScript origins,
đặt `GOOGLE_OAUTH_CLIENT_ID` và `ADMIN_SESSION_SECRET` (>= 32 ký tự) trên môi
trường triển khai.

---

## 📜 Bản Quyền & Giấy Phép
Dự án được xây dựng phục vụ **Cuộc thi Sáng kiến An toàn Giao thông Học đường 2026**.
Toàn bộ mã nguồn phát triển theo định hướng mã nguồn mở vì cộng đồng giáo dục an toàn đường bộ Việt Nam.
