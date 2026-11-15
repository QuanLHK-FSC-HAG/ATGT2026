# Ứng phó sự cố

## Vai trò và ngưỡng kích hoạt
Chủ dự án là đầu mối tạm thời; cần chỉ định người trực vận hành, người quản trị Google/Vercel, đầu mối nhà trường/pháp chế và kênh liên hệ trước pilot. Kích hoạt khi nghi lộ dữ liệu/token, public sharing, Admin bypass, sai điểm hàng loạt, log mất/hỏng hoặc quota outage kéo dài.

## Quy trình
1. **Nhận diện:** ghi incident ID, thời điểm UTC, triệu chứng, phiên bản deploy/ảnh hưởng; không sao chép token/PII vào chat hoặc log công khai.
2. **Khoanh vùng:** tạm dừng ghi/thu dữ liệu thật hoặc route bị ảnh hưởng; thu hồi public link, tắt export/AI nếu nghi rò rỉ; giữ trang thông báo bảo trì không chứa PII.
3. **Bảo toàn chứng cứ:** snapshot log redacted, audit/perms/deploy metadata, hash của artifact; quyền riêng tư, không tải toàn bộ PII không cần thiết.
4. **Loại bỏ:** rotate secret bị ảnh hưởng, revoke OAuth token/session, giảm quyền/cập nhật allowlist; tìm root cause và bản vá/test hồi quy. Không chỉ rollback rồi bỏ qua lộ key.
5. **Khôi phục:** preview build sạch, smoke/auth/storage checks, restore/reconcile có tombstone xóa; chủ dự án phê duyệt mở lại. Không ghi đè backup gốc.
6. **Thông tin:** pháp chế/nhà trường đánh giá đối tượng/phạm vi và nghĩa vụ thông báo theo hoàn cảnh/quy định áp dụng; không tự đặt thời hạn pháp lý hoặc tuyên bố không cần báo.
7. **Hậu kiểm:** timeline, nguyên nhân, dữ liệu ảnh hưởng, hành động còn thiếu, owner/deadline và bằng chứng đã khắc phục.

## Sự cố vận hành không có bằng chứng lộ dữ liệu
429/5xx: backpressure, bounded retry có jitter, giảm batch frequency, circuit breaker và thông báo chưa lưu; không báo thành công giả. Gemini lỗi: fallback deterministic, điểm vẫn từ Rule Engine. Checksum mismatch: cách ly batch, giữ nguyên bản, không sửa log để khớp chỉ mục.

Chưa diễn tập incident/restore; cần ghi drill evidence trước nghiệm thu.
