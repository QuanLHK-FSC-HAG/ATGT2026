# Kiến trúc

## Mục tiêu và nguyên tắc
Next.js App Router + TypeScript + Tailwind CSS phục vụ UI/API; Phaser 3 chỉ khởi tạo client-side bằng dynamic import. Vercel chạy ứng dụng stateless. Google Sheets lưu chỉ mục/cấu trúc/tổng hợp; Google Drive lưu JSONL bất biến theo lô và backup. Gemini chỉ qua server adapter với dữ liệu tối thiểu/ẩn danh. Rule Engine là nguồn điểm duy nhất.

## Luồng chính
`Student Browser` → `/api/public/*` (validation, cookie phiên, rate limit, Rule Engine) → `Storage Adapter` → Sheets/Drive. `Admin Browser` → Google OIDC → server verify `iss/aud/exp/signature/state/nonce` + `ADMIN_ALLOWLIST` → `/admin` và `/api/admin/*`.

## Bounded write và nhất quán
- Event được gom tối đa `LOG_BATCH_MAX_EVENTS`/`LOG_BATCH_MAX_BYTES`; server xác nhận thành công chỉ sau ghi bền vững.
- JSONL batch có `batch_id`, event `seq`, SHA-256 checksum; index `EventsIndex` tham chiếu `drive_file_id`.
- Retry exponential backoff + jitter, budget/circuit breaker; idempotency theo `batch_id`/`event_id`/`attempt_id`.
- Nếu Drive ghi thành công nhưng Sheets lỗi, batch là `INDEX_PENDING`; job reconcile kiểm tra checksum và upsert index. Không dùng check-then-write làm khóa duy nhất.

## Storage adapter
Interface ứng dụng tách `GoogleStorageAdapter` và `Local/MockAdapter`. Local chỉ phục vụ phát triển/test, dashboard bắt buộc hiện nhãn `Dữ liệu demo / Local`. Không coi mock là bằng chứng Google thật.

## Lựa chọn auth Google (đang chờ Gate 0)
- **Ưu tiên Service Account** chỉ khi Sheet/Drive do Admin chia sẻ rõ ràng với service account, quyền tối thiểu và chính sách Workspace/Gmail cho phép.
- **Fallback OAuth server-side refresh token** chỉ khi chủ dự án phê duyệt; token mã hóa chỉ ở secret store/server, không trong browser/repo/log.
- Quyết định chưa khóa: loại tài khoản và quyền sở hữu Google **chưa xác minh**; không có credential để test API/OAuth/Gemini.

## Giới hạn đã biết
Sheets/Drive quota và Vercel functions chưa được đo. Không dùng memory process, file tạm hay cron local như hàng đợi bền vững. Mục tiêu 100 concurrent sessions phải qua Gate 4 load test; không tuyên bố sức tải trước khi có số liệu.

## Ranh giới AI
Input chỉ gồm scenario id/group, quyết định đã pseudonymize, difficulty, Rule Engine score và ngữ cảnh sư phạm. Cấm gửi họ tên, lớp, trường, tỉnh/thành, email, IP, token, cookie hoặc raw event logs. AI lỗi/timeout trả fallback xác định; không sửa điểm/quy tắc/xuất bản content.
