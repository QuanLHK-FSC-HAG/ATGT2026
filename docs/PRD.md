# PRD — SafeRide EDU AI

## 1. Mục tiêu
SafeRide EDU AI là webapp tiếng Việt giúp học sinh THCS/THPT học và luyện quyết định an toàn giao thông qua game top-down 2D, tình huống tương tác và đánh giá Pre-test → Training → Post-test. Sản phẩm cần tạo dữ liệu nghiên cứu có thể kiểm toán, không yêu cầu tài khoản học sinh, không biến AI thành công cụ chấm điểm pháp lý.

## 2. Người dùng và phân quyền
| Vai trò | Có thể làm | Không được làm |
|---|---|---|
| Học sinh | Nhập 4 trường, xem notice, làm bài, chơi, xem phản hồi | Google login, xem dữ liệu người khác, sửa điểm |
| Admin allowlisted | Xem dashboard, lọc/xuất dữ liệu, quản lý trạng thái nội dung | Bỏ qua xác thực server-side, chia sẻ dữ liệu công khai |
| Chuyên gia nội dung/pháp lý | Rà soát và phê duyệt nội dung | Tự gắn approved nếu chưa có hồ sơ review |

## 3. Phạm vi MVP
- Onboarding đúng 4 trường: Họ tên, Lớp, Trường, Tỉnh/Thành phố; validation và notice phiên bản hóa.
- Luồng: Giới thiệu → Onboarding → Hướng dẫn → Pre-test → 12–16 tình huống training → Post-test → kết quả/gợi ý.
- Phaser 3 responsive, phím và cảm ứng; Rule Engine server-side có version.
- Ghi participant/session/study run/result; batch event log JSONL + checksum; dashboard admin; Gemini Zero-PII/fallback.

## 4. Ngoài phạm vi MVP
- Không cam kết 150+ tình huống hoặc production trước Gate 3/5 và review nội dung.
- Không thu ngày sinh, email, điện thoại, địa chỉ, Google account của học sinh.
- Không dùng Supabase/Firebase Database; không triển khai AI chấm điểm.

## 5. User stories và tiêu chí chính
- Là học sinh, tôi bắt đầu sau khi nhập đủ 4 trường và đọc notice, không phải đăng nhập.
- Là học sinh dùng máy chung, tôi đổi người chơi mà không thấy dữ liệu phiên trước.
- Là Admin được allowlist, tôi xem dữ liệu thật/nhãn demo rõ ràng và lọc/xuất trong phạm vi quyền.
- Là nghiên cứu viên, tôi ghép Pre/Post theo `study_run_id`, không dùng họ tên làm khóa.
- Là vận hành viên, tôi truy vết batch log từ Sheets index đến Drive JSONL bằng `batch_id`/checksum.

## 6. KPI/đo lường (chỉ báo, không phải tuyên bố kết quả)
Tỷ lệ hoàn thành, tỷ lệ Pre/Post hợp lệ và ghép cặp, phân bố điểm, thời gian hoàn thành, tỷ lệ lỗi đồng bộ, số batch retries, tỷ lệ AI fallback. Chỉ kết luận hiệu quả sau thiết kế nghiên cứu và phân tích được phê duyệt.

## 7. Phụ thuộc/điểm chờ
Cần chủ dự án xác nhận loại tài khoản Google, quyền sở hữu Sheet/Drive, phương án OAuth/service account, biến môi trường thật, phê duyệt nhà trường/pháp lý và quyền GitHub/Vercel trước dữ liệu thật/deploy.
