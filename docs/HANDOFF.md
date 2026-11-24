# SafeRide EDU AI — Bàn giao liên tác nhân

> Cập nhật lần cuối: 2026-11-23. Đây là trạng thái làm việc hiện tại; đọc file này trước khi sửa code.

## Nguyên tắc bắt buộc

- Chỉ hoàn thiện và nghiệm thu **local** cho đến khi chủ dự án chấp nhận bằng văn bản rõ ràng.
- **Không `git push`, không deploy, không tunnel, không public URL, không đồng bộ Google Sheets/Drive, không gọi Gemini thật** trong giai đoạn này.
- Không reset, checkout, clean hoặc ghi đè các thay đổi hiện hữu. Có 28 file modified và 16 file untracked; phải review diff trước mọi chỉnh sửa.
- Không mở/giải nén hai file ZIP hồ sơ untracked nếu không có yêu cầu riêng.
- Mọi dữ liệu nghiệm thu dùng synthetic/local; không đưa PII học sinh thật vào test hoặc báo cáo.
- Trước khi viết code liên quan Next.js, đọc hướng dẫn trong `node_modules/next/dist/docs/` theo `AGENTS.md`.

## Cách chạy local an toàn

```bash
npm run dev:acceptance -- --store .runtime/NEW-RUN/logical_store.json
```

Mở `http://127.0.0.1:3001`. Launcher `scripts/start-local-acceptance.mjs` đặt:

- `SAFERIDE_LOCAL_ACCEPTANCE=true`
- `SAFERIDE_FORCE_LOCAL_MOCK=true`
- `SAFERIDE_LOCAL_MOCK_FILE=.runtime/local-acceptance/logical_store.json`
- Google/Gemini credentials rỗng trong process
- `GEMINI_LIVE_ENABLED=false`
- admin local synthetic: `local-admin@example.test`

Chế độ local bị từ chối nếu phát hiện hosted/serverless. Bản hướng dẫn và giới hạn đầy đủ ở `docs/LOCAL_ACCEPTANCE.md`.

## Bằng chứng đã đạt

- `npm run typecheck -- --incremental false`: đạt.
- `npm test`: **33/33** unit/integration đạt.
- `npx playwright test`: **6/6** đạt — 3 desktop, 3 mobile emulation.
- `npm run build`: đạt.
- E2E đã bao phủ consent/4 trường, PRE → TRAINING → POST → kết quả, đổi người chơi/xóa cookie, lỗi đăng ký không tạo session giả, admin denial/local login và không tải Google script.
- Ngày 2026-11-19: chạy lại typecheck và 33/33 unit/integration đạt; lượt E2E đầu thất bại 6/6 vì không có server (`ECONNREFUSED 127.0.0.1:3001`), sau khi `preview_start` khởi động `saferide-acceptance`, chạy lại E2E đạt 6/6. Không thay đổi tính năng trong lượt bàn giao này.
- Backend có regression retry sau mất response/chuyển phase; client giữ attempt ID trong memory trong cùng lượt.

## Đã thay đổi quan trọng

- Sửa test timestamp flaky bằng một mốc `telemetryNow`.
- Consent onboarding mặc định `false`, payload giữ đúng giá trị người dùng chọn.
- Client không tạo session giả khi registration/session API lỗi.
- Client không hiển thị kết quả thành công giả khi attempt API lỗi hoặc response thiếu result.
- Chế độ demo không ghi kết quả nghiên cứu và không giả định option đầu tiên là đáp án đúng.
- `DELETE /api/public/sessions` xóa cookie khi đổi người chơi.
- Local acceptance chặn Google auth/config, Sheets sync và Gemini live; production fail-closed vẫn giữ nguyên.
- Client không suy ra BRAKE/SIGNAL chỉ từ vị trí đáp án; telemetry dùng observed duration truyền vào.

## Đợt ba thư viện Admin và 1.000 học sinh — 2026-11-19

- Yêu cầu mới: giữ bố cục Tổng quan; Học sinh/Nghiên cứu/Nhật ký AI theo mẫu Kịch bản. Người dùng đã chọn toàn bộ tên tổng hợp, không đọc `data hs.xls` hoặc kho cũ có tên riêng.
- Agent 1–3: khảo sát và thiết kế đã trả kết quả. Phát hiện filter chưa áp dụng, nghiên cứu chưa ghép cặp, AI cũ trống. Không coi seed snapshot là 1.000 lượt chơi.
- Agent 4: đã viết `scripts/run-student-simulation.mts`; runner HTTP loopback tuần tự, >=1.000 tên tổng hợp duy nhất, manifest. **Chưa thực thi**. Bàn giao: [04-simulation.md](handoffs/04-simulation.md).
- Agent 5: đã viết `lib/admin/read-model.ts`, `/api/admin/library`, tests. Main đã đọc projection: ghép run/participant, null khi thiếu điểm, không suy ngược AI hash. Agent báo typecheck và 39/39 test đạt; main chưa chạy lại toàn bộ. [05-contract.md](handoffs/05-contract.md).
- Agent 6–8: workflow gặp lỗi quota 429; **không agent nào trả kết quả hoàn thành**. Có bản nháp `components/admin/student-library.tsx` và `research-library.tsx`; chưa có ai-log library; chưa tích hợp. Đang khôi phục từ bản nháp, không ghi đè hoặc tuyên bố xong.
- Agent 9–10: chờ validator và browser E2E sau tích hợp. Main độc quyền sửa `app/admin/page.tsx`, launcher và HANDOFF chung.
- Bước tiếp: tạo kho mới tách biệt, chạy runner, kiểm định toàn bộ, nối API/library vào ba tab; giữ local-only. Không dùng số test cũ để tuyên bố thay đổi mới đã đạt.

## Việc cần tiếp tục

1. **Refresh resilience:** tích hợp `GET /api/public/progress` vào `app/page.tsx` để khôi phục session/phase/attempts sau F5 hoặc ẩn tab; không lưu PII vào localStorage. Cần thiết kế cookie/session bootstrap an toàn và E2E refresh.
2. **Admin deep dive:** kiểm tra filter trường học, phân trang, logout, source `simulation`, export CSV/JSONL với kho local; bổ sung E2E không gọi Google.
3. **Telemetry:** tách rõ thời gian UI quan sát với reaction time được engine xác thực; không tuyên bố đo phản xạ thật nếu chỉ đo `performance.now()`.
4. **Tài liệu:** sau mỗi thay đổi chạy lại các lệnh kiểm chứng, cập nhật `docs/LOCAL_ACCEPTANCE.md`, `docs/PROGRESS.md`, README nếu số liệu thay đổi; cập nhật mục “Cập nhật lần cuối” và phần bằng chứng trong file này.
5. **Cuối mỗi phiên:** ghi rõ files changed, test commands/results, blockers và next step vào `docs/HANDOFF.md`; cập nhật memory project nếu trạng thái dài hạn thay đổi.

## Bộ dữ liệu 1.017 học sinh synthetic đã kiểm định — 2026-11-23

- Không commit, không deploy, không gọi Google/Gemini thật. Ba nhánh audit độc lập đã rà catalog trường, runner/storage và admin UI/API.
- Catalog gồm 25 trường có thật từ website chính thức `cantho.edu.vn`; tên học sinh vẫn hoàn toàn tổng hợp. Phân bố không đồng đều trên các trường hiện có, tổng 1.017 học sinh, lớp bị ràng buộc theo cấp THCS/THPT/liên cấp. Tên trường chỉ là tham chiếu công khai, không chứng minh trường tham gia hoặc cung cấp dữ liệu.
- Snapshot đạt: `.runtime/schools-1000-final-20261123/logical_store.json`; manifest: `.runtime/schools-manifest-1000-final-20261123/manifest.json`; báo cáo: `.runtime/schools-validation-1000-final-20261123.json`.
- Dữ liệu hiệu quả học tập synthetic được tái tạo bằng Rule Engine: PRE trung bình 32,39; POST 73,01; 8 nhóm kỹ năng nằm khoảng 47,6–56,7 điểm, không đồng loạt 100%. Đây chỉ là mô phỏng hiệu quả sử dụng, không phải bằng chứng nghiên cứu thực tế.
- Validator offline cuối đạt `valid: true`, `errors: {}` tại `.runtime/schools-validation-1017-effective-fixed-20261123.json`, với 1.017 học sinh/runs/sessions, 3.051 attempts, 2.034 assessments, 3.051 event batches, 12.204 events và 3.051 AI records. Backup trước các lần biến đổi được giữ cạnh snapshot/manifest.
- Đã sửa launcher bắt buộc store mới, hỗ trợ `--existing` chỉ cho snapshot synthetic; snapshot ghi atomic, cache trong process và chỉ kiểm event trùng trong đúng session. Run dở cũ được giữ nguyên để audit, không tái sử dụng.
- Đã sửa admin: luôn hiện cảnh báo synthetic theo dữ liệu, biểu đồ dùng cặp PRE/POST và 8 nhóm canonical, export GET CSV/JSONL đúng nguồn, tải file thật, cùng lỗi phân trang/filter nhỏ.
- Kiểm chứng: `npm run typecheck -- --incremental false` đạt; `npm test` đạt 39/39; `npx playwright test` đạt 6/6 desktop/mobile; `npm run build` đạt (còn warning Turbopack về dynamic local path trong `lib/google/admin-storage.ts`).
- Preview snapshot đã kiểm định: `npm run dev:acceptance -- --store .runtime/schools-1000-final-20261123/logical_store.json --existing`, mở `http://127.0.0.1:3001`.

## Tệp/thành phần chính

- UI học sinh: `app/page.tsx`, `components/api.ts`, `components/world-3d.tsx`
- API/session: `app/api/public/*`, `lib/api/services.ts`, `lib/auth/session.ts`
- Local isolation: `lib/runtime/local-acceptance.ts`, `lib/google/storage.ts`, `lib/google/admin-storage.ts`, `scripts/start-local-acceptance.mjs`
- Admin: `app/admin/page.tsx`, `app/api/admin/*`
- E2E: `playwright.config.ts`, `tests/e2e/local-acceptance.spec.ts`
- Regression tests: `tests/unit/client-api.test.ts`, `tests/unit/local-acceptance.test.ts`, `tests/integration/api-flow.test.ts`
- Báo cáo: `docs/LOCAL_ACCEPTANCE.md`, `docs/PROGRESS.md`, `docs/ACCEPTANCE.md`

## Quy tắc cập nhật sau khi hoàn thành phần việc

1. Không ghi “hoàn tất” nếu chưa có lệnh kiểm chứng hoặc bằng chứng browser tương ứng.
2. Cập nhật số test thực tế, không dùng số cũ trong README/checklist.
3. Ghi cả phần chưa kiểm chứng và giới hạn; không biến mock/simulation thành bằng chứng Google/Vercel production.
4. Chỉ khi chủ dự án yêu cầu public ở một lượt riêng mới lập kế hoạch triển khai; file này không cấp quyền public.
