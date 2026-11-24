# Bộ dữ liệu giả lập nghiên cứu 2026

Bộ dữ liệu này phục vụ tái lập dashboard và đánh giá luồng mô phỏng an toàn giao thông.
Toàn bộ hồ sơ học sinh, kết quả, thời gian và lượt xử lý là dữ liệu tổng hợp; không xác
nhận cá nhân hoặc trường học tham gia thực tế.

## Quy mô

- 1.017 hồ sơ học sinh giả lập
- 1.017 phiên nghiên cứu và 1.017 phiên đăng nhập
- 3.051 lượt xử lý tình huống
- 2.034 bản ghi đánh giá trước/sau
- 3.051 phản hồi phân tích
- 163 tình huống

## Chạy local

```powershell
npm run data:prepare
npm run dev:dataset
```

Dashboard quản trị mở tại `http://127.0.0.1:3001/admin`.

Tệp `SHA256SUMS` dùng để kiểm tra tính toàn vẹn của snapshot.
