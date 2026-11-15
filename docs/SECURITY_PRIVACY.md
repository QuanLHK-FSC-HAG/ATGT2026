# Sécurité et quyền riêng tư

> Đặc tả kiểm soát cần triển khai/kiểm chứng, không phải chứng nhận tuân thủ. Chưa có Google OAuth/Sheets/Drive/Gemini thật hoặc production deployment được test. Không thu dữ liệu học sinh thật khi cổng phê duyệt còn mở.

## Dữ liệu và quyền
Players chứa PII; UUID liên kết hành vi vẫn là dữ liệu có thể liên kết, không coi là ẩn danh hoàn toàn. Học sinh chỉ xem phiên của mình; Admin phải qua Google OIDC + allowlist server-side, không lấy email từ body/request làm bằng chứng quyền. Chuyên gia nội dung không tự động có quyền xem PII; chưa có vai trò tách biệt thì không cấp tài khoản production cho họ.

## Kiểm soát bắt buộc
- Kiểm tra chữ ký, iss/aud/exp, nonce/state, email_verified theo luồng OIDC; chống session fixation và CSRF. Allowlist kiểm tra mọi admin API, không chỉ page.
- Cookie phiên HttpOnly, Secure khi HTTPS, SameSite=Lax; TTL ngắn, kiểm tra hết hạn/server-side binding participant → study_run → session. Đổi người chơi vô hiệu hóa phiên cũ.
- Public API validate strict schema, độ dài/bytes/event count, sequence hợp lệ; không tin score/client timestamp; hạn mức token/session và coarse IP có xét NAT trường học.
- CORS chỉ origin cần thiết; Origin/CSRF kiểm tra thao tác thay đổi; render text an toàn, không nội suy HTML nội dung người dùng/AI. Dữ liệu ghi Sheets dùng RAW hoặc escape thích hợp, xuất CSV neutralize formula injection riêng, không coi RAW tự bảo vệ CSV.
- Secrets chỉ server; .env.example để trống; không log header/token/key/PII. Audit actor pseudonymous, operation, resource ref, outcome, timestamp; export có audit, kiểm soát quyền và thời hạn link.
- AI dùng projection allowlist gồm scenario id, quyết định hữu hạn, score, difficulty; không gửi free text, full_name/class/school/province, IP, cookie/token hoặc ID liên kết toàn cục. Structured output được validate và hiển thị như text; AI không sửa điểm.

## Cổng dữ liệu thật
Chủ dự án/nhà trường/pháp chế xác nhận cơ sở xử lý, quy trình thông báo/đồng ý phù hợp đối tượng trẻ em, đơn vị chịu trách nhiệm, quyền truy cập, nhà cung cấp/luồng dữ liệu và retention cụ thể. Chưa xác nhận thì chỉ dữ liệu tổng hợp/giả lập; checkbox học sinh không chứng minh phụ huynh đồng ý.

## Hạn chế cần công khai
Không chứng minh được danh tính hoặc tính trung thực tuyệt đối của học sinh không tài khoản. Client event có thể bị giả lập; Rule Engine chỉ kiểm tra tính nhất quán, không là chống gian lận tuyệt đối. Sheets thiếu transaction/unique constraint; shared lock và rate-limit bền vững chưa được xác minh. Xem threat model và Gate 4 trước mọi pilot thật.

## Tài liệu liên quan
PRIVACY_NOTICE.md, DATA_RETENTION.md, SECURITY_THREAT_MODEL.md, INCIDENT_RESPONSE.md. Đối chiếu thực thi bằng ACCEPTANCE.md, không đánh dấu đạt chỉ vì đã có tài liệu.
