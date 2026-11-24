# Báo cáo tiến độ (Progress Report)

## Cập nhật nghiệm thu local — 18/11/2026

- Chỉ làm local; chưa được phép public/deploy/push hoặc đồng bộ Google.
- Đã thêm launcher cách ly tại `127.0.0.1:3001`, kho local riêng, chặn Google/Gemini khi nghiệm thu.
- Đã sửa consent mặc định, session giả khi API lỗi, điểm giả khi lưu thất bại và reset cookie khi đổi người chơi.
- Kiểm chứng: typecheck sạch, 33/33 unit/integration, 6/6 browser E2E desktop/mobile và build đạt.
- Phạm vi và giới hạn: [LOCAL_ACCEPTANCE.md](LOCAL_ACCEPTANCE.md). Các GATE bên dưới là ghi chép lịch sử, không phải trạng thái nghiệm thu hiện tại; không sử dụng các số test hoặc đường dẫn cũ làm bằng chứng mới.
- Còn tiếp tục hoàn thiện: telemetry thời gian thực, retry/idempotency sau mất phản hồi, khôi phục khi refresh, kiểm thử export/filter và tài liệu checklist toàn bộ. Chưa nghiệm thu production, pháp lý hoặc tải HTTP.


## GATE 0 — Environment & Access Audit
- **Status:** `PARTIAL` (Đã hoàn tất toàn bộ audit local; chờ credentials thật để kết nối Google/Vercel)
- **Đã làm:**
  - Khảo sát toàn bộ môi trường máy trạm local: Node v24.18.0, npm 11.16.0, pnpm 11.25.0, Git 2.56.0, bundled Playwright & `@oai/artifact-tool`.
  - Xác nhận công cụ Computer Use có sẵn trong inventory (chỉ sử dụng khi có sự cho phép và không thao tác vào tài khoản cá nhân trái phép).
  - Khởi tạo thư mục dự án `saferide-edu-ai/`, thư mục bàn giao `SafeRide_EDU_AI_Master_Package_2026/`, và thư mục tạm `temp/`.
  - Hoàn thiện 18 tài liệu quản trị kỹ thuật (`docs/*.md`, `README.md`, `.env.example`, `.gitignore`).
  - Lập bảng checklist tổng thể 58 hạng mục tại `docs/checklist.json` và xuất bản thành file Excel `SafeRide_EDU_AI_Master_Package_2026/SafeRide_Checklist_Tong_2026.xlsx` (15 Đã thực hiện, 8 Đang thực hiện, 35 Chưa thực hiện).
- **Đã kiểm thử:**
  - Kiểm tra phiên bản runtime qua PowerShell thực tế.
  - Kiểm tra cấu trúc `checklist.json` và workbook `SafeRide_Checklist_Tong_2026.xlsx` (0 lỗi công thức).
- **Bằng chứng:**
  - `E:\ATGT 2026\SafeRide_EDU_AI_Master_Package_2026\SafeRide_Checklist_Tong_2026.xlsx`
  - `E:\ATGT 2026\saferide-edu-ai\docs\*`
- **Quyền/secret còn thiếu (chỉ nêu tên biến):**
  - `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `ADMIN_ALLOWLIST`, `ADMIN_SESSION_SECRET`
  - `GOOGLE_SHEETS_ID`, `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`
  - `GEMINI_API_KEY`, `GEMINI_MODEL`, `PARTICIPANT_SESSION_SECRET`

## GATE 1 — Proof of Concept End-to-End (Local Architecture & Tests)
- **Status:** `PARTIAL` (Hoàn tất 100% mã nguồn core, API, UI, Phaser scene và pass 8/8 Unit + Integration Tests trên ESM; chờ Google Sheets/Drive thực tế)
- **Đã làm:**
  - Xây dựng luồng Học sinh không cần đăng nhập (`lib/validation/input.ts`, `lib/auth/session.ts`, `app/page.tsx`) chỉ gồm 4 trường (`Họ tên`, `Lớp`, `Trường`, `Tỉnh/Thành phố` nhãn `UNVERIFIED`) + checkbox Privacy Notice + nút đổi người chơi cho máy tính phòng tin học dùng chung.
  - Xây dựng Rule Engine xác định (`lib/rules/engine.ts`) phiên bản `2026.1-deterministic`, tính điểm độc lập, ẩn rubric/đáp án khỏi public API, và kiểm soát máy trạng thái `PRE -> TRAINING -> POST`.
  - Xây dựng Gemini Pedagogical Engine (`lib/gemini/engine.ts`) có màng lọc chặn PII học sinh và chế độ fallback sư phạm xác định khi chưa cấu hình `GEMINI_API_KEY`.
  - Xây dựng Google Storage Adapter (`lib/google/storage.ts`) hỗ trợ 9 bảng dữ liệu nghiên cứu, cơ chế fail-closed trên môi trường production khi thiếu biến môi trường Google, và local mock có cảnh báo rõ ràng.
  - Xây dựng 14 API routes (`app/api/**`) bảo vệ các endpoint `/api/admin/*` ở chế độ fail-closed (401/403 khi chưa xác thực Google OIDC).
  - Xây dựng Phaser 3 Game Client (`components/game-client.tsx`) vẽ bằng hình học (procedural canvas), hỗ trợ bàn phím + điều khiển cảm ứng + tự động tạm dừng khi mất tiêu điểm.
- **Đã kiểm thử:**
  - Chạy `node --test tests/unit/*.test.ts tests/integration/*.test.ts`: **8/8 tests PASS** (0 fail).
- **Bằng chứng:**
  - `tests/unit/domain.test.ts` (7/7 pass)
  - `tests/integration/api-flow.test.ts` (1/1 pass)

## GATE 2 & GATE 3 — Kho Nội Dung 160 Tình Huống ATGT Đa Dạng (150+ Cases)
- **Status:** `PARTIAL` (Hoàn tất tạo mới, kiểm duyệt tự động 160 tình huống đa dạng không trùng lặp trong Excel & JSONL; chờ hội đồng nhà trường/pháp lý duyệt nhãn `NEEDS_LEGAL_REVIEW` và `NEEDS_CONTENT_REVIEW`)
- **Đã làm:**
  - Nhân bản và đa dạng hóa **160 tình huống** (`SCN-101A` đến `SCN-820A`), chia đều 8 nhóm kỹ năng × 20 tình huống (80 THCS + 80 THPT).
  - Xuất bản vào workbook chuẩn: `E:\ATGT 2026\SafeRide_EDU_AI_Master_Package_2026\SafeRide_EDU_AI_Master_Package_2026.xlsx` (đầy đủ 6 sheet: `Huong_Dan`, `Sheet_Can_Dien`, `Loc_Du_Lieu`, `Ma_Chuan`, `Prompt_AI_150_Cases`, `Scenario_QA`).
  - Xuất bản file đồng bộ cho hệ thống: `E:\ATGT 2026\SafeRide_EDU_AI_Master_Package_2026\scenarios.jsonl` và nạp vào `saferide-edu-ai/data/scenarios.seed.json`.
  - Gắn nhãn trung thực `NEEDS_LEGAL_REVIEW` và `NEEDS_CONTENT_REVIEW` cho toàn bộ 160 kịch bản.
- **Đã kiểm thử:**
  - Kiểm tra tự động 160 dòng: 160 ID duy nhất, 160 tiêu đề duy nhất, 0 cặp trùng lặp gần (Jaccard >= 0.72 là 0), 100% `trigger_condition` parse JSON hợp lệ, 0 lỗi công thức Excel.
- **Bằng chứng:**
  - `E:\ATGT 2026\SafeRide_EDU_AI_Master_Package_2026\SafeRide_EDU_AI_Master_Package_2026.xlsx`
  - `E:\ATGT 2026\SafeRide_EDU_AI_Master_Package_2026\scenarios.jsonl`
  - Ảnh chụp kiểm tra trực quan lưu tại `E:\ATGT 2026\temp\scenarios_preview.png` và `E:\ATGT 2026\temp\qa_preview.png`.

## GATE 4 — Performance, Security & Research QA
- **Status:** `Đang thực hiện`
- **Đã làm:**
  - Hoàn thành kiểm thử bảo mật cấp hàm/API (chống HTML/script injection, chặn PII sang Gemini, ký HMAC participant session, khóa fail-closed Admin API).
- **Bước tiếp theo:**
  - Chạy kiểm thử tải và xuất báo cáo nghiên cứu thực nghiệm từ Google Sheets sau khi kết nối tài khoản Google thật.

## GATE 5 — GitHub, Vercel & Bàn Giao
- **Status:** `Chưa thực hiện (Chờ phê duyệt và cấp quyền từ người dùng)`
- **Bước tiếp theo:**
  - Khi người dùng cung cấp thông tin xác thực Google Cloud / Sheets / Drive, `GEMINI_API_KEY` và phê duyệt đẩy code lên GitHub / triển khai Vercel, tiến hành kết nối thực tế và nghiệm thu Gate 4 - Gate 5.
