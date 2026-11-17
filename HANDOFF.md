# Bàn giao tạm cho Claude — 2026-11-16

## Trạng thái chung
- **Không commit, không deploy.** Người dùng đang giao Claude sửa tiếp.
- HEAD hiện tại: `244f97a` (`feat(admin): load live Google Sheets data and fix space key in forms`).
- Tất cả thay đổi bên dưới đang **uncommitted** (xem `git status`).
- Local chạy **production build** (`npm start`) tại `http://127.0.0.1:3000`.
  - ⚠️ Không dùng `npm run dev` (Turbopack HMR gây reload/chớp liên tục).
  - Nếu đổi code: `npm run build` rồi restart `npm start`.

## Việc đã làm (uncommitted)

### 1. Kịch bản 160 dòng Sheet thành cảnh chơi được
- `lib/rules/engine.ts`:
  - Đọc `data/scenarios.seed.json` → 160 `SEED_PLAYABLE_SCENARIOS` (có prompt, hazard cue, 3 phương án, rubric, scene metadata).
  - `CANONICAL_SCENARIOS = [...3 legacy, ...160 seed]` để tests cũ vẫn dùng `[0]` và `getScenario('blind-spot-...')` vẫn chạy.
  - `toPublicScenarioView()` trả thêm `npc_element`, `trigger_event`, `correct_action`, `target_grade`, `skill_group`.
- `app/api/public/scenarios/route.ts`: **không cần session** (try/catch `authenticatedSession`), lọc `SCN-...`, hỗ trợ `?phase=`.
- `components/api.ts`: `loadScenario()` chọn **ngẫu nhiên** trong pool thay vì `list[0]`.

### 2. Lưu đầy đủ kịch bản xuống Google Sheet
- `lib/google/scenario-sync.ts`: ghi 160 dòng / **23 cột** vào `kich_ban_goc`, format header/filter/freeze.
- `scripts/sync-scenarios-to-sheets.mts` + `npm run sync:scenarios`.
- `app/api/admin/scenarios/sync/route.ts`: `POST` (require admin).
- Đã chạy thực tế: `SCENARIOS_SYNCED {"count":160,"columns":23,...}`.

### 3. Game 3D phong cách Minecraft + Roblox
- `components/world-3d.tsx` viết lại: voxel blocks, school sign, clouds, flowers, rider có mặt, NPC riêng theo `sceneKind`.
- Không còn HUD điều khiển (bỏ W/A/S/D, camera, phanh, xi-nhan, nút Chạy).
- 3D là **phản ứng của lựa chọn**: `selectedDecision='safe'` → phanh; `rush` → tăng tốc; `ignore` → lách/xi-nhan.
- Cảnh chỉ chuyển động khi đã chọn; khung tĩnh lúc mở trang; canvas tràn kín khung game (`flex:1`, `minHeight:420`, bo góc 0).
- Đường dễ đọc hơn: giảm góc nghiêng, vạch giữa đứt đoạn, vạch lề, vạch dừng.

### 4. Cách chơi gọn nhất
- Chọn `1 / 2 / 3` hoặc bấm nút phương án.
- `Space` = phương án an toàn, `Enter` = xác nhận.
- `app/page.tsx`: bỏ `handle3DAction`, telemetry lấy theo phương án đã chọn.
- Hướng dẫn trong màn instructions đã sửa theo cách chơi mới.

### 5. Chơi thử trước đăng nhập
- Nút **🎮 Chơi thử ngay · không cần đăng nhập** ở màn chào.
- Random 3 cảnh, có hướng dẫn 1 màn đầu, nút thoát, **không ghi dữ liệu/không tạo session**.
- `demoMode` xử lý trong `submit()`/`next()` của `app/page.tsx`.

### 6. Admin gọn hơn (đã commit ở 244f97a)
- `app/admin/page.tsx`: ẩn cột ID kỹ thuật, thêm STT, tên cột dễ đọc, thời gian ngắn, zebra rows.
- `/api/admin/sheets`: đọc 8 sheet live từ Google Sheets.

## Kiểm tra
- `npm run typecheck` ✅
- `npm test` ✅ 29/29
- `npm run build` ✅
- Google Sheet: `kich_ban_goc` = 161 dòng (160 + header), `bieu_do_thong_ke` 18 dòng.

## Lưu ý cho người sửa tiếp
- **Không commit/deploy** khi chưa có lệnh mới.
- Không tắt máy.
- `.claude/` là của Claude — đừng xóa.
- Dữ liệu test trong `hoc_sinh` và `_trang_thai` đã dọn sạch trước đó.
- Vercel (`atgt2026`) đã được sửa env `PROVINCE_CATALOG` và deploy `244f97a`; nhưng các thay đổi ở trên **chưa lên Vercel**.
