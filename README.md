# SafeRide EDU AI — Học từ đường, an toàn đến trường

Ứng dụng học tập và đánh giá an toàn giao thông đường bộ dành cho học sinh THCS/THPT tại Việt Nam.

## Trạng thái hiện tại (trung thực theo audit)
- **GATE 0:** `PARTIAL` — đã xác minh môi trường máy trạm (Node 24.18, npm 11.16, pnpm 11.25, git 2.56, bundled Playwright, Computer Use inventory có sẵn nhưng chưa dùng đăng nhập/thao tác). Chưa xác minh loại tài khoản Google Admin, quyền sở hữu Sheets/Drive và chưa có credentials thật.
- **GATE 1:** `Đang thực hiện (local developing)` — 4 agent đang triển khai các workstream riêng; `npm install` đã khởi chạy nhưng đang chờ mạng/escalation, chưa xác nhận đã cài xong.
- **GATE 2–5:** `Chưa thực hiện` — chưa chạy kiểm thử tích hợp/E2E/load/security thật, chưa deploy GitHub/Vercel, chưa xác nhận tuân thủ pháp lý hoặc sẵn sàng production.

## Nguyên tắc bất biến
1. Học sinh **không đăng nhập** Google/email/mật khẩu/SĐT/mã định danh cá nhân.
2. Màn hình bắt đầu chỉ yêu cầu đúng **4 trường**: `full_name`, `class_name`, `school_name`, `province_city` + chấp thuận thông báo quyền riêng tư phù hợp.
3. Chỉ **Admin** dùng Google Sign-In và phải nằm trong `ADMIN_ALLOWLIST` kiểm tra ở server.
4. Stack mục tiêu: **Next.js App Router + TypeScript + Phaser 3 + Tailwind CSS**, triển khai **GitHub → Vercel**.
5. Lưu trữ mục tiêu: **Google Sheets** (9 bảng logic) + **Google Drive** (JSONL batch logs, archives, backups) thuộc quyền quản lý của Admin; **không** dùng Supabase/Firebase Database.
6. **Rule Engine** chấm điểm xác định ở server; **Gemini** chỉ chạy server-side với dữ liệu đã giảm thiểu/ẩn danh (Zero-PII) để giải thích sư phạm và có fallback cố định.

## Cấu trúc tài liệu (`docs/`)
- `PRD.md` — Yêu cầu sản phẩm, phạm vi MVP vs 150+ tình huống, luồng học sinh và Admin.
- `ARCHITECTURE.md` — Kiến trúc mục tiêu, luồng dữ liệu, giới hạn stateless/quota và quyết định kết nối Google.
- `DATABASE_SCHEMA.md` — 9 bảng Google Sheets, cấu trúc JSONL batch trên Drive, idempotency và reconciliation.
- `SCENARIO_CATALOG.md` — Khung 8 nhóm, Bloom, phương tiện, quy tắc tuổi/pháp lý và cổng kiểm duyệt 150+ tình huống.
- `SECURITY_PRIVACY.md` — Tổng quan bảo mật, phân quyền, bảo vệ dữ liệu học sinh và tham chiếu bộ tài liệu chuyên biệt.
- `PRIVACY_NOTICE.md` — Nội dung thông báo quyền riêng tư hiển thị trước khi chơi.
- `DATA_RETENTION.md` — Chính sách lưu trữ, xuất, chỉnh sửa, xóa và sao lưu dữ liệu.
- `SECURITY_THREAT_MODEL.md` — Mô hình mối đe dọa và biện pháp giảm thiểu.
- `INCIDENT_RESPONSE.md` — Quy trình ứng phó sự cố bảo mật/dữ liệu/dịch vụ.
- `RESEARCH_PROTOCOL.md` — Thiết kế Pre-test → Training → Post-test, ghép cặp và giới hạn suy diễn thống kê.
- `DECISIONS.md` — Nhật ký quyết định kiến trúc/kỹ thuật (ADR) và các điểm chờ chủ dự án xác nhận.
- `DEPLOYMENT.md` — Quy trình cấu hình biến môi trường, GitHub CI và triển khai Vercel.
- `RUNBOOK.md` — Hướng dẫn vận hành, kiểm tra sức khỏe hệ thống, sao lưu/khôi phục và đối soát log.
- `ACCEPTANCE.md` — Tiêu chí nghiệm thu bắt buộc và trạng thái bằng chứng hiện tại.
- `PROGRESS.md` — Báo cáo tiến độ theo mẫu Gate của Master Prompt.
- `checklist.json` — Dữ liệu checklist 58 hạng mục theo Gate để tổng hợp Excel.

## Thiết lập môi trường local
1. Sao chép `.env.example` thành `.env.local` và chỉ điền giá trị thật khi được chủ dự án cấp (không commit file `.env*`).
2. Khi chưa có credentials Google/Gemini, hệ thống chỉ được vận hành ở chế độ phát triển/kiểm thử cục bộ và phải gắn nhãn rõ `Dữ liệu demo / Local`.
