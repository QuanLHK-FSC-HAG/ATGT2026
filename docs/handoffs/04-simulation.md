# Handoff: Student Simulation Runner (Agent 04)

## Overview
Implementation of a high-fidelity, API-compliant student simulation runner that generates synthetic Vietnamese data for local acceptance testing.

## Task Status
- [x] Research API contracts and existing generator logic.
- [x] Implement synthetic name generator (1000 distinct combinations).
- [x] Implement API client for SafeRide EDU.
- [x] Implement simulation loop (Onboarding -> Sessions -> Events -> Attempts -> Feedback).
- [x] Add CLI support (`--base-url`, `--count`, `--output`).
- [x] Validate implementation with standalone TypeScript compiler.

## Implementation
- `scripts/run-student-simulation.mts` uses only loopback HTTP requests and embedded synthetic names.
- Requires a new direct child of `.runtime` via `--output`; refuses existing output directories and does not resume.
- Defaults to 1000 students, requires 1000..2808 distinct names, and refuses any base URL other than `http://127.0.0.1:3001`.
- Verifies `/api/auth/admin/config` has Google disabled and local login enabled before onboarding and before every student.
- Performs sequential onboarding, cookie session creation, scenario catalog, monotonic telemetry batches, three phase attempts, deterministic AI feedback, and progress/assessment verification.
- Checkpoint manifest contains counts, failure stage, and in-flight request state without response bodies, cookies, credentials, or PII-bearing server data.

## Verification
- `node node_modules/typescript/bin/tsc --ignoreConfig --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --skipLibCheck scripts/run-student-simulation.mts` — passed.
- Runner was not executed, per isolation requirement; parent must provision an isolated local acceptance store before running.

## Limitations / Next Step
- A transport failure after a server-side commit is intentionally reported as commit status unknown; rerun requires a fresh isolated store and new output directory.
- Synthetic telemetry and outcomes are local acceptance fixtures, not research observations.
- Recommended invocation: `node --import tsx scripts/run-student-simulation.mts --count 1000 --output .runtime/simulation-run-YYYYMMDD-HHMMSS`.
- Do not run the legacy Python generator or read `data hs.xls`.

## Handoff
The runner is ready for parent-controlled execution against an isolated local acceptance server. Shared `docs/HANDOFF.md` was intentionally not modified.
