# Agent 05 — Admin library contract

## Delivered

- Added the pure `buildAdminReadModel(snapshot)` projection in `lib/admin/read-model.ts`.
- Added authenticated `GET /api/admin/library`; it invokes `getAdminStorage(req)` and reads exactly one snapshot, including when `?source=simulation` is selected.
- Exported the UI contract: `StudentCard`, `ResearchCard`, `AICard`, and `AdminReadModel`.
- Research assessment pairing is scoped to both `study_run_id` and `participant_id`; duplicate PRE/POST records use latest `created_at`, with deterministic ID/score tie breaks. Missing or invalid scores remain `null`; `StudyRunRecord` score fields are not used as a fallback.
- AI records remain free of participant identity joins/decoding. `scenario_title` is resolved only from `CANONICAL_SCENARIOS`, not the snapshot scenario list.

## Verification

- `npm run typecheck -- --incremental false` passed.
- `npm test` passed: 39 tests, 0 failures.
- New unit coverage validates empty data, joins/filter-ready fields, counts, canonical AI titles, no identity decoding, deterministic pair selection, incomplete scores, one snapshot route read, and unauthenticated current/simulation denial.

## Limitations / next safe step

- This is an API contract only; no existing admin page or route was changed. UI consumers can use the exported types and endpoint after a separate UI task.
- Skill percentage is the attempt-weighted mean deterministic rule score, bounded to 0–100, grouped by canonical `skill_group` (or rubric error group when absent).
