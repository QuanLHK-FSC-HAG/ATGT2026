# Threat model — bản thiết kế cần kiểm chứng

## Tài sản và trust boundaries
Tài sản: PII Players; cookie/secret; điểm/rubric; event batches/checksum; Google/Gemini credentials; exports/backups. Ranh giới: browser không tin cậy → Next API; public → admin; Next server → Google/Gemini; GitHub/CI → Vercel. Tác nhân: học sinh/khách spam, browser bị chiếm, người dùng Google không allowlist, người có link export, tài khoản Admin/chuỗi cung ứng bị chiếm.

| Rủi ro | Kiểm soát thiết kế | Ca kiểm thử bắt buộc | Rủi ro còn lại |
|---|---|---|---|
| IDOR / truy cập chéo | Server derive IDs từ cookie; binding từng resource | Thay session/participant/batch IDs → 403/404 | Không có định danh ngoài đời |
| Admin bypass/token giả | OIDC verify + allowlist mọi API; fail closed | Sai iss/aud/signature/exp/email_verified, email body giả, ngoài allowlist | Google/Admin compromise |
| CSRF/session fixation | state/nonce, Origin/CSRF, rotate session, TTL, cookies | Cross-origin write, replay callback, cookie cũ sau đổi người | Thiết bị phòng máy bị chiếm |
| XSS/prompt injection | Validate input/output, text rendering, CSP, bounded AI projection | HTML/script, free text giả chỉ thị AI | Nội dung AI sai; luôn có limitations |
| Sheets/CSV injection | RAW cho ghi; escape xuất CSV riêng | =,+,-,@, tab/CR trước formula | Người mở file bỏ cảnh báo |
| Giả điểm/replay/event gian lận | Rule Engine server, phiên bản, seq, idempotency | score giả, repeat attempt/batch, impossible timings | Event client vẫn giả lập được |
| Race/mất batch | Durable ACK, immutable Drive, manifest/index, reconciliation | Hai request cùng id, timeout sau Drive write, crash trước index | Sheets không unique/transaction; chưa giải quyết atomic lock đa instance |
| DoS/quota/NAT | Bytes/count cap, token budget, coarse IP, backpressure | Nhiều người cùng IP, oversized/429/retry storm | Distributed rate limit chưa được chứng minh |
| Rò rỉ PII/secret | Server-only env, redact logs, private files, least privilege | Quét repo/bundle/log, chụp AI payload fixture không PII | Admin trực tiếp tải file được |
| Chuỗi cung ứng | Lockfile/CI audit, least CI permissions, reviewed deploy | Scan dependency, secret và workflow permissions | Toolchain compromise |
| Restore hồi sinh dữ liệu đã xóa | Tombstone + kiểm tra restore | Xóa rồi restore snapshot cũ → dữ liệu vẫn bị loại | Backup cũ ngoài kiểm soát |

## Rủi ro chặn phát hành
1. Cần kiểm chứng cơ chế dedup/atomic claim đa instance thực tế. AppProperty/file-name query hay Sheets check-then-append không bảo đảm duy nhất tuyệt đối; phát hiện duplicate không phải ngăn race. Nếu chưa có primitive phù hợp được duyệt, giới hạn pilot có giám sát hoặc dừng ghi thật; không tự chuyển database.
2. Giới hạn quota, concurrency, rate limit chia sẻ giữa Vercel instances chưa đo. Không xem Map trong memory là bảo vệ production.
3. Chưa có cấu hình Google thật, owner/perms, consent/retention, security/load test hoặc phê duyệt production.

## Quy tắc kết luận
Mỗi kiểm soát phải có test artifact/command/exit code hoặc kiểm tra quyền thật; tài liệu này không phải báo cáo pentest. Mọi ca bảng trên hiện chưa có bằng chứng chạy trong workstream tài liệu.
