# BÁO CÁO KIỂM TRA HIỆN TRẠNG DỰ ÁN VÀ ĐỀ XUẤT NÂNG CẤP 3D
**Dự án:** SafeRide EDU AI (ATGT 2026)  
**Ngày thực hiện:** 14/11/2026  
**Chuyên gia:** Game WebGL / 3D Interaction Architect

---

## 1. TỔNG QUAN HIỆN TRẠNG HỆ THỐNG
1. **Kiến trúc & Framework:**
   - Next.js (App Router), React, TypeScript, Tailwind CSS.
   - Core API: 14 route endpoints đầy đủ (`/api/public/*` và `/api/admin/*`).
   - Kiểm thử tự động: 13/13 tests PASS tuyệt đối (`domain.test.ts`, `api-flow.test.ts`, `gate3-gate4-qa.test.ts`).
2. **Trải nghiệm Học sinh Hiện tại:**
   - 4 trường thông tin nghiên cứu No-Login: Họ tên, Lớp, Trường, Tỉnh/Thành phố.
   - Luồng FSM 3 chặng: `Trước khi học (PRE)` -> `Luyện tập (TRAINING)` -> `Sau khi học (POST)` -> `Kết quả`.
   - Giao diện gameplay hiện tại: Sử dụng Phaser 3 dạng 2D top-down canvas phẳng, hình học vẽ dạng khối tĩnh, thiếu chiều sâu không gian và camera cinematic.

---

## 2. PHÂN TÍCH RỦI RO & GIẢI PHÁP KỸ THUẬT NÂNG CẤP 3D
1. **Rủi ro môi trường Offline Sandbox:**
   - Môi trường không có kết nối internet để tải thêm gói npm mới (`three`, `@react-three/fiber`).
2. **Giải pháp kiến trúc Độc lập & Tối ưu (Zero-Dependency WebGL 3D Canvas Engine):**
   - Xây dựng một Engine 3D chuyên biệt bằng WebGL 2.0 / Canvas 3D toán học (Perspective Projection Matrix, Isometric depth-sorting, Phong directional lighting & Shadow mapping, dynamic camera orbit/pan/zoom).
   - Thiết kế thế giới 3D học đường Việt Nam đầy đủ:
     * Cổng trường học mái ngói đỏ, tường vàng, biển tên "TRƯỜNG HỌC VIỆT NAM", sân trường rợp bóng cây phượng vĩ.
     * Đường phố 2 chiều có vạch kẻ tim đường vàng, vạch đi bộ sang đường (zebra crosswalk), dải phân cách cây xanh.
     * Hệ thống cột đèn tín hiệu giao thông 3 màu (Đỏ, Vàng, Xanh) tự động đổi trạng thái.
     * Biển báo giao thông Việt Nam: Biển "Đi chậm - Khu vực trường học", biển cấm rẽ, gờ giảm tốc.
     * Phương tiện 3D: Xe đạp học sinh, xe máy điện, xe đạp điện, xe buýt trường học màu vàng cam, ô tô phụ huynh, xe tải có vùng điểm mù (blind spot indicator).
     * Nhân vật 3D: Học sinh đi học (ba lô, nón bảo hiểm), người đi bộ qua đường, chú Cảnh sát giao thông ra hiệu lệnh.
3. **Bảo tồn Tuyệt đối Nghiệp vụ Hiện hữu:**
   - Tái sử dụng 100% `createSession`, `loadScenario`, `sendEvents`, `submitAttempt` từ `components/api.ts`.
   - Giữ nguyên cấu trúc logic 160 kịch bản, chấm điểm xác định `2026.1-deterministic` và log Google Sheets.
   - 100% tiếng Việt chuẩn, hỗ trợ đầy đủ Desktop (W-A-S-D / Mũi tên / Phanh Space) và Mobile (Touch D-pad, Nút phanh to, Nút xi-nhan).

---

## 3. LỘ TRÌNH THỰC THI (6 GIAI ĐOẠN)
- **Giai đoạn 1:** Lập báo cáo kiểm tra (Tệp này: `BAO_CAO_KIEM_TRA_3D.md`).
- **Giai đoạn 2:** Dựng nguyên mẫu Không gian 3D tương tác tại `components/world-3d.tsx`.
- **Giai đoạn 3:** Xây dựng 5 màn hình tương tác 3D liền mạch (Màn hình chào, Nhập thông tin, Chọn phương tiện 3D, Bản đồ hành trình, Tình huống 3D, Kết quả).
- **Giai đoạn 4:** Tích hợp bộ điều khiển camera cinematic, chuyển cảnh mượt và gắn kết API game-loop.
- **Giai đoạn 5:** Kiểm thử trực tiếp máy tính & điện thoại, đo đạc FPS (đạt 60 FPS mượt mà).
- **Giai đoạn 6:** Nghiệm thu và xuất báo cáo bàn giao.
