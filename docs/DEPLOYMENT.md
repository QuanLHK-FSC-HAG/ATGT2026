# Quy trình cấu hình và triển khai

> Chưa có Vercel/GitHub CLI hay repo remote kết nối. Mọi lệnh dưới đây là quy trình kỹ thuật mục tiêu, không phải kết quả đã chạy.

## Biến môi trường
Cấu hình Vercel project settings (Preview và Production riêng biệt). Không commit `.env*` hoặc in secrets ra log:
- `NEXT_PUBLIC_APP_URL`: URL domain HTTPS chính thức.
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`: Google Cloud Console OIDC cho Admin.
- `ADMIN_ALLOWLIST`: Danh sách email Google admin ngăn cách bằng dấu phẩy.
- `ADMIN_SESSION_SECRET`, `PARTICIPANT_SESSION_SECRET`: Chuỗi ngẫu nhiên >=32 ký tự an toàn cao.
- `GOOGLE_SHEETS_ID`, `GOOGLE_DRIVE_FOLDER_ID`: ID tài nguyên thuộc quyền sở hữu Admin.
- `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` (hoặc server-side OAuth refresh token sau khi duyệt).
- `GEMINI_API_KEY`, `GEMINI_MODEL`: Key server-only và tên model được hỗ trợ.
- `LOG_BATCH_MAX_EVENTS=50`, `LOG_BATCH_MAX_BYTES=131072`.

## CI/CD mục tiêu
1. GitHub Actions chạy trên PR/push: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
2. Vercel tự động tạo Preview Deployment cho Pull Request.
3. Chạy Playwright E2E và Storage Verification trên URL Preview.
4. Production deployment yêu cầu phê duyệt thủ công của chủ dự án (Lê Hữu Kỳ Quan).
