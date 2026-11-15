# Quyết định kỹ thuật (ADR)

| ID | Quyết định | Trạng thái | Lý do / hệ quả |
|---|---|---|---|
| ADR-001 | Học sinh không có tài khoản | Đã chốt | Giảm thu thập dữ liệu; dùng participant/session/study run UUID server-side. |
| ADR-002 | 4 trường onboarding cố định | Đã chốt | Họ tên, Lớp, Trường, Tỉnh/Thành; không email/SĐT/ngày sinh/địa chỉ. |
| ADR-003 | Rule Engine server-side là nguồn điểm | Đã chốt | Gemini chỉ giải thích; client không tự quyết điểm. |
| ADR-004 | Sheets + Drive, không Supabase/Firebase DB | Đã chốt | Sheets cho indexes/tổng hợp; Drive cho JSONL batch/archive. |
| ADR-005 | Google storage qua adapter | Đã chốt | Local/Mock chỉ dev/test, Google adapter khi quyền xác minh; UI tách nhãn dữ liệu demo/thật. |
| ADR-006 | Service Account vs OAuth refresh token | Chờ quyết định | Cần xác nhận Gmail/Workspace, quyền share/ownership, chính sách tổ chức; không lưu refresh token ở browser/repo. |
| ADR-007 | Vercel stateless + synchronous durable acknowledgement | Đã chốt | Không dựa memory/file temp/cron local; ghi batch idempotent/retry/reconcile. |
| ADR-008 | Gemini zero-PII + deterministic fallback | Đã chốt | Không gửi 4 trường/token/IP/raw logs; lỗi AI không dừng game/chấm điểm. |
| ADR-009 | Nội dung pháp lý chưa xác minh = NEEDS_LEGAL_REVIEW | Đã chốt | Không bịa điều khoản/approved; cần reviewer thật trước phát hành. |
| ADR-010 | Production release cần owner sign-off | Đã chốt | Chưa deploy/không thu dữ liệu thật khi thiếu xét duyệt quyền, pháp lý, bảo mật và test. |

## Điểm cần chủ dự án trả lời
1. Google account là Gmail cá nhân hay Workspace? Ai sở hữu Sheet/Drive và có thể cấp quyền tối thiểu?
2. Đồng ý cơ chế Service Account hay OAuth refresh token server-side sau khi xác minh khả thi?
3. Ai thuộc `ADMIN_ALLOWLIST` và ai chịu trách nhiệm review/export/delete?
4. Nhà trường/pháp chế yêu cầu consent/notice/retention nào trước pilot?
5. GitHub repository và Vercel team/project nào được phép dùng?
