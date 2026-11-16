# Hướng dẫn cấu hình Đăng nhập Google cho Quản trị viên

Tài liệu này mô tả toàn bộ luồng xác thực `/admin` và cách khắc phục lỗi
"tài khoản Google chưa được qua auth".

## 1. Luồng xác thực hiện tại

```
Trình duyệt /admin
  → tải Google Identity Services (accounts.google.com/gsi/client)
  → người dùng chọn tài khoản Google
  → Google trả về ID Token (JWT, RS256)
  → POST /api/auth/admin/login { id_token }
  → server xác minh: chữ ký JWKS + iss + aud + exp + iat + email_verified
  → đối chiếu allowlist quản trị viên
  → phát hành cookie HttpOnly sr_admin_session (HMAC-SHA256)
  → các API /api/admin/* dùng requireAdmin() để xác minh cookie
```

Cấu hình công khai cho trình duyệt được trả về bởi `GET /api/auth/admin/config`
(chỉ gồm `configured`, `client_id`, `allow_local_login`; không có secret).

## 2. Tạo Google OAuth Client ID

1. Mở <https://console.cloud.google.com/> → chọn hoặc tạo project.
2. **APIs & Services → OAuth consent screen**:
   - User type: `External` (hoặc `Internal` nếu dùng Google Workspace).
   - Thêm scopes: `openid`, `email`, `profile`.
   - Thêm 2 email quản trị vào **Test users** nếu ứng dụng còn ở chế độ Testing.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins** thêm chính xác:
     - `http://localhost:3000`
     - `http://127.0.0.1:3000`
     - `https://<tên-miền-triển-khai>` (ví dụ `https://your-app.vercel.app`)
   - **Authorized redirect URIs**: không bắt buộc với luồng ID Token của nút Google.
4. Copy **Client ID** (dạng `xxxxxxxx.apps.googleusercontent.com`).

> Lưu ý: origin phải khớp cả scheme + host + port. Thiếu origin thì nút Google
> không render hoặc Google trả lỗi `origin_mismatch` / `invalid_client`.

## 3. Cấu hình biến môi trường

Sao chép `.env.example` thành `.env.local` khi chạy máy và điền:

```bash
GOOGLE_OAUTH_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
ADMIN_SESSION_SECRET=<chuỗi ngẫu nhiên tối thiểu 32 ký tự>
ADMIN_ALLOWLIST=quanlhk.01@gmail.com,maitronghuu@gmail.com
ALLOW_LOCAL_ADMIN_LOGIN=true   # chỉ dùng local; production đặt false
```

Tạo secret ngẫu nhiên:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Trên Vercel: **Project → Settings → Environment Variables** (Production và
Preview), thêm `GOOGLE_OAUTH_CLIENT_ID`, `ADMIN_SESSION_SECRET`,
`ADMIN_ALLOWLIST`, `ALLOW_LOCAL_ADMIN_LOGIN=false`, sau đó **Redeploy**.

- `ADMIN_SESSION_SECRET` là bắt buộc trên production/Vercel. Nếu thiếu, server
  trả `503 ADMIN_SESSION_SECRET_MISSING` thay vì phát hành cookie không thể
  xác minh giữa các instance serverless.
- Có thể dùng `NEXT_PUBLIC_GOOGLE_CLIENT_ID` thay cho `GOOGLE_OAUTH_CLIENT_ID`;
  tuy nhiên biến public chỉ được nhúng lúc build, còn biến server được đọc tại
  runtime qua `/api/auth/admin/config` nên linh hoạt hơn.
- Không đặt `GOOGLE_OAUTH_CLIENT_SECRET` trong biến `NEXT_PUBLIC_*` và không
  commit file `.env*`.

## 4. Kiểm tra sau khi cấu hình

1. `npm run dev` → mở `http://localhost:3000/admin`.
2. Nếu chưa cấu hình, màn hình hiện cảnh báo vàng thay vì nút Google bị treo.
3. Khi đã cấu hình, nút Google xuất hiện; đăng nhập bằng một trong 2 email
   trong allowlist.
4. Kiểm tra API: `GET /api/auth/admin/session` trả `authenticated: true`.
5. Chạy test: `npm test` (bao gồm kiểm thử chữ ký JWT, audience, hết hạn,
   allowlist và fail-closed secret).

## 5. Bảng lỗi thường gặp

| Mã lỗi / hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Không thấy nút Google, cảnh báo "Chưa cấu hình..." | Thiếu `GOOGLE_OAUTH_CLIENT_ID` | Thêm biến môi trường và khởi động lại / redeploy |
| Nút Google không render, lỗi `invalid_client` | Client ID sai hoặc chưa bật OAuth client | Kiểm tra lại Client ID, OAuth consent screen |
| `origin_mismatch` | Domain đang truy cập chưa nằm trong Authorized JavaScript origins | Thêm đúng scheme/host/port vào Google Console |
| `GOOGLE_TOKEN_WRONG_AUDIENCE` | ID Token được phát hành cho Client ID khác | Đảm bảo `GOOGLE_OAUTH_CLIENT_ID` trùng Client ID tạo token |
| `INVALID_GOOGLE_TOKEN` | Token sai định dạng/chữ ký, `iss` lạ, đồng hồ server lệch | Kiểm tra đồng hồ hệ thống, thử đăng nhập lại |
| `GOOGLE_TOKEN_EXPIRED` | Token quá 1 giờ hoặc phiên cũ | Đăng nhập lại |
| `GOOGLE_EMAIL_NOT_VERIFIED` | Tài khoản Google chưa xác minh email | Dùng tài khoản Google đã xác minh |
| `ADMIN_NOT_ALLOWED` | Email không nằm trong allowlist | Thêm email vào `ADMIN_ALLOWLIST` hoặc dùng đúng tài khoản |
| `ADMIN_SESSION_SECRET_MISSING` | Production thiếu secret hoặc secret < 32 ký tự | Đặt `ADMIN_SESSION_SECRET` đủ mạnh rồi redeploy |
| `/api/auth/admin/session` trả 401 dù vừa đăng nhập | Secret thay đổi giữa các instance / thiếu secret | Dùng một secret cố định trên toàn bộ môi trường |
| `LOCAL_LOGIN_DISABLED` | Gọi đăng nhập nhanh bằng email trên production | Chỉ dùng trên local hoặc đăng nhập Google |
| Không tải được `accounts.google.com/gsi/client` | Mạng, adblock, CSP | Cho phép domain Google, tắt trình chặn, thử trình duyệt khác |

## 6. Ghi chú bảo mật

- ID Token **không** được tin tưởng chỉ vì đến từ Google SDK: server luôn xác
  minh chữ ký bằng JWKS chính thức, `aud`, `iss`, `exp`, `iat`, `email_verified`.
- Allowlist được kiểm tra **hai lần**: lúc phát hành token và mỗi lần xác minh
  cookie admin, nên gỡ email khỏi `ADMIN_ALLOWLIST` sẽ vô hiệu hóa phiên cũ.
- Cookie admin là `HttpOnly`, `SameSite=Lax`, có `Secure` trên môi trường
  hosted; token ký HMAC-SHA256 và có hạn 8 giờ.
- Đăng nhập nhanh bằng email chỉ hoạt động khi **không phải** môi trường hosted
  và `ALLOW_LOCAL_ADMIN_LOGIN` khác `false`. Trên production luôn bị từ chối.
- Để tăng cường chống replay, có thể bổ sung Nonce/OIDC state ở bước tiếp theo;
  hiện tại vòng đời token ngắn và allowlist đã giới hạn rủi ro.
