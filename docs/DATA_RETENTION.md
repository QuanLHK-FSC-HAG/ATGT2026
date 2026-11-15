# Lưu giữ, xuất, sửa và xóa dữ liệu

## Trạng thái chính sách
Dự thảo; chưa có thời hạn đã phê duyệt. **Mặc định chưa cho phép thu dữ liệu học sinh thật.** Không coi các mốc vận hành dưới đây là yêu cầu pháp luật hoặc cấu hình đã được cài đặt. Chủ dự án/nhà trường phải xác nhận thời hạn, căn cứ xử lý, người chịu trách nhiệm và đầu mối quyền dữ liệu.

| Nhóm | Mục đích | Retention cần phê duyệt | Chủ thể tiếp cận |
|---|---|---|---|
| Players / 4 trường | Tổ chức lớp và hỗ trợ yêu cầu dữ liệu | Mốc kết thúc đợt nghiên cứu + thời hạn được duyệt | Admin phụ trách |
| Sessions/results/assessments | Ghép cặp và phân tích | Thời hạn protocol; đánh giá khả năng liên kết lại | Admin/nghiên cứu được phép |
| Drive event batches / indexes | Kiểm toán kết quả, đối soát | Ưu tiên ngắn hơn dữ liệu tổng hợp; chưa chốt | Admin vận hành |
| AI summaries | Giải thích học tập | Theo phiên/đợt được duyệt; không PII đầu vào | Admin phụ trách |
| Audit/operations | An toàn và xử lý lỗi | Theo nhu cầu bảo mật được duyệt; không secret | Vận hành được phép |
| Exports/backups | Bàn giao/khôi phục | TTL, vòng xoay và nơi lưu được phê duyệt | Admin có quyền xuất/restore |

## Yêu cầu hợp lệ
1. Tiếp nhận riêng tư, không yêu cầu học sinh nhập thêm giấy tờ vào ứng dụng. Người phụ trách phối hợp nhà trường kiểm tra quyền người yêu cầu; tên/lớp không đủ xác minh.
2. Lập ticket mã ngẫu nhiên, phạm vi và người xử lý; không đưa PII vào log hệ thống.
3. Xem/xuất dữ liệu qua kênh bảo mật; xuất tối thiểu, chống CSV formula injection, không dùng link công khai.
4. Chỉnh sửa PII ở Players; giữ audit metadata của thay đổi, không sửa raw score tùy ý. Mọi tính lại kết quả có rule version và lý do.
5. Xóa theo participant/study_run: quét Players, Sessions, ScenarioResults, Assessments, indexes, AIAnalysis, Drive batches, exports, cache. Nếu batch nhiều người, tạo bản đã loại dữ liệu và xóa/thu hồi bản cũ, cập nhật checksum/index.
6. Lưu tombstone tối thiểu không chứa PII để tránh hồi sinh dữ liệu khi restore. Áp dụng xóa với backup theo lịch đã duyệt, hạn chế phục hồi bản cũ; xác minh sau restore và ghi kết quả ticket.

## Backup và kiểm tra
Backup private có manifest/version/checksum, tách quyền và không commit repo. Không tuyên bố đã khử định danh chỉ vì xóa Players: trường/lớp, hành vi hiếm và ID vẫn có thể liên kết. Chỉ giữ tổng hợp sau đánh giá rủi ro tái nhận diện và ngưỡng nhóm nhỏ được duyệt. Chưa có backup/restore hoặc deletion drill thực tế; xem RUNBOOK.md.
