# Nghiệm thu local SafeRide EDU AI

## Phạm vi
Tài liệu này chỉ ghi nhận kiểm chứng trên máy local, không phải nghiệm thu public/production. Trong đợt này không deploy, push, tunnel, đồng bộ Google Sheets/Drive hoặc gọi Gemini thật.

## Khởi chạy an toàn

```bash
npm run dev:acceptance -- --store .runtime/local-preview/logical_store.json
```

Mở `http://127.0.0.1:3001`. Script khởi chạy sẽ:

- buộc `SAFERIDE_LOCAL_ACCEPTANCE=true` và `SAFERIDE_FORCE_LOCAL_MOCK=true`;
- ghi vào `.runtime/local-acceptance/logical_store.json`, tách khỏi kho local khác;
- xóa cấu hình Google/Gemini khỏi process của server;
- tắt Gemini live và chỉ dùng phản hồi deterministic;
- bật đăng nhập admin local cho tài khoản synthetic `local-admin@example.test`;
- từ chối local acceptance nếu phát hiện môi trường hosted/serverless.

Không đặt secret thật vào tài liệu hoặc commit `.env*`. Không chạy script có cờ `--apply` trong đợt nghiệm thu local.

## Kiểm thử đã chạy

| Kiểm thử | Kết quả |
|---|---:|
| TypeScript không dùng incremental cache | Đạt |
| Unit + integration | 33/33 đạt |
| Playwright Chromium desktop | 3/3 đạt |
| Playwright Chromium mobile emulation | 3/3 đạt |
| Next production build | Đạt sau đợt sửa local |

E2E local bao phủ:

- consent mặc định chưa chọn và bốn trường onboarding;
- luồng PRE → TRAINING → POST → kết quả;
- đổi người chơi và xóa cookie phiên dùng chung;
- lỗi đăng ký không biến thành session giả;
- admin bị từ chối khi chưa đăng nhập;
- local admin allowlist và không tải Google Identity Services;
- desktop/mobile viewport.

## Phần local còn tiếp tục hoàn thiện

- Khôi phục giao diện/tiến độ sau refresh (API tiến độ có sẵn, UI chưa tích hợp).
- E2E mất phản hồi và retry; backend đã có regression cho retry sau chuyển chặng, client giữ attempt ID trong bộ nhớ nhưng chưa giữ qua reload.
- Kiểm thử sâu filter/phân trang, export CSV/JSONL, logout, accessibility và ẩn tab.
- Đồng bộ từng dòng checklist lịch sử và bằng chứng; chưa tự đánh dấu các mục đó hoàn tất.
- Telemetry hiện đo khoảng từ mở câu hỏi tới submit, không phải thời gian phản xạ lái xe được xác thực độc lập.

Bản này là mốc kiểm chứng local đầu tiên, chưa phải hoàn thành toàn bộ kế hoạch local.

## Giới hạn chưa nghiệm thu

- Chưa kiểm chứng OAuth Google thật, Google Sheets/Drive quota/quyền chia sẻ, Gemini thật hoặc Vercel.
- Bài benchmark 100 phiên hiện là benchmark hàm trong process, không phải HTTP load test tới server/Google.
- 160 kịch bản vẫn cần chuyên gia nội dung và pháp lý duyệt; vẫn giữ nhãn `NEEDS_CONTENT_REVIEW` và `NEEDS_LEGAL_REVIEW`.
- Chưa tuyên bố tuân thủ pháp lý, phù hợp thu thập dữ liệu học sinh thật, hay sẵn sàng production.
- E2E hiện chạy Chromium qua kênh Edge nếu có; Firefox/WebKit chưa được chạy.

## Điều kiện chấp nhận local

Người dùng có thể tạo kho local mới bằng `npm run dev:acceptance -- --store .runtime/local-preview/logical_store.json`. Để xem lại một snapshot synthetic đã kiểm định, thêm `--existing`. Mở localhost, thử onboarding/chơi thử/admin local và đối chiếu báo cáo. Chỉ sau khi người dùng chấp nhận bản local và cấp yêu cầu riêng mới được lập kế hoạch public; không tự động triển khai từ tài liệu này.
