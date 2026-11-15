# Sổ tay vận hành (Runbook)

## Kiểm tra sức khỏe hệ thống (System Health)
1. Truy cập `/admin` bằng tài khoản thuộc `ADMIN_ALLOWLIST`.
2. Kiểm tra tab **System Health**:
   - Trạng thái kết nối Google Sheets (latency, quota còn lại).
   - Trạng thái kết nối Google Drive (quyền ghi thư mục log).
   - Trạng thái kết nối Gemini API (tỷ lệ fallback trong 1 giờ qua).
   - Tồn đọng lô sự kiện chưa đồng bộ (`EventsIndex` có `INDEX_PENDING`).

## Quy trình đối soát và xử lý lệch dữ liệu (Reconciliation)
Khi Google Drive ghi thành công file JSONL nhưng cập nhật Google Sheets thất bại:
1. Chạy script đối soát: `pnpm tsx scripts/reconcile-logs.ts --dry-run`.
2. Script quét các file trong thư mục Drive partition ngày hiện tại.
3. Tính toán SHA-256 của từng file và đối chiếu với `EventsIndex`.
4. Điền bổ sung các chỉ mục còn thiếu với cờ `RECONCILED_AT`.
5. Chạy không có cờ `--dry-run` để cập nhật bảng tính sau khi xác nhận.

## Quy trình Sao lưu và Khôi phục (Backup & Restore)
- **Sao lưu:**
  - Định kỳ xuất toàn bộ 9 bảng Google Sheets thành file JSONL có gắn nhãn thời gian UTC.
  - Tải manifest các batch Drive và lưu vào kho lưu trữ lạnh (Cold Storage) có mã hóa.
- **Khôi phục:**
  - Không ghi đè trực tiếp lên bảng tính đang hoạt động.
  - Tạo spreadsheet mới, import dữ liệu từ bản sao lưu gần nhất.
  - Cập nhật biến môi trường `GOOGLE_SHEETS_ID` và khởi động lại dịch vụ.
  - Kiểm tra tính nhất quán giữa `EventsIndex` mới và thư mục Drive.
