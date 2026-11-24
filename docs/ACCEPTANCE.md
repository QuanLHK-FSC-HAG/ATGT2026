# Tiêu chí nghiệm thu và Trạng thái kiểm chứng

> **Trạng thái local 18/11/2026:** typecheck, 33/33 unit/integration, 6/6 E2E Chromium desktop/mobile và build đạt trên máy local. Bảng bên dưới là checklist lịch sử chưa được kiểm chứng đồng bộ từng dòng; không dùng trạng thái “Đang thực hiện” bên dưới để suy ra phần nào đã sẵn sàng public. Xem [LOCAL_ACCEPTANCE.md](LOCAL_ACCEPTANCE.md) để biết bằng chứng mới nhất và giới hạn chưa kiểm chứng. Chưa có chấp thuận public/thu dữ liệu thật.


| Tiêu chí bắt buộc | Trạng thái kỹ thuật | Bằng chứng thực tế |
|---|---|---|
| Học sinh nhập đúng 4 trường và bắt đầu chơi, không Google login | Đang thực hiện | Form 4 trường và token phiên đang được hoàn thiện |
| Mọi phiên có participant/session/study_run riêng biệt, không gộp trùng tên | Đang thực hiện | Thiết kế UUID server-side; chờ unit test |
| Nút đổi người chơi hoạt động an toàn trên máy dùng chung | Đang thực hiện | Thiết kế recovery handle; chờ E2E test |
| Pre-test -> Training -> Post-test lưu kết quả và ghép cặp đúng | Đang thực hiện | Luồng nghiên cứu đang được cài đặt |
| Game chạy responsive trên desktop và mobile với điều khiển tương tác | Đang thực hiện | Phaser scene và layout responsive đang dựng |
| Server tính điểm bằng Rule Engine; client không thể gửi điểm giả | Đang thực hiện | Rule Engine độc lập; chờ test chống gian lận |
| Log theo lô có idempotency, SHA-256 checksum và truy vết Drive | Đang thực hiện | Event batching schema đã định nghĩa; chờ test |
| Google Sheets và Drive không bị public | Chưa thực hiện | Chưa có tài nguyên Google thật từ chủ dự án |
| Admin Google Sign-In + server-side allowlist kiểm soát /admin | Đang thực hiện | Khung OIDC/allowlist đang dựng; chưa test OAuth thật |
| Dashboard hiển thị số liệu thật, bộ lọc, phân trang, xuất CSV/JSONL | Đang thực hiện | Khung giao diện đang dựng; chưa có dữ liệu thật |
| Gemini key không lọt ra client; AI không nhận PII học sinh | Đang thực hiện | Adapter Zero-PII đã thiết kế; chờ secret scanning |
| Gemini gặp lỗi hoặc timeout thì game và chấm điểm vẫn hoạt động bình thường | Đang thực hiện | Cơ chế fallback deterministic đã thiết kế |
| Có >=150 tình huống hợp lệ, phân biệt rõ bản nháp và bản duyệt | Đang thực hiện | Schema và kịch bản mở rộng đang được lập trình |
| Unit test, E2E test, load test 100 concurrent có kết quả thực tế | Chưa thực hiện | Chưa chạy test suite trên môi trường triển khai |
| Có URL Vercel hoạt động và đầy đủ tài liệu vận hành | Chưa thực hiện | Chưa triển khai Vercel; tài liệu đang hoàn tất |
