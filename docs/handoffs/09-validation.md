# Safely validating synthetic student simulation runs

> Status update: 2026-11-20. Local-only validation tool for synthetic student simulation data.

## Evidence

- `npx tsc --noEmit`: zero type errors across the project.
- Validator CLI implementation: `scripts/validate-student-simulation.mts`.
- Invocation command format:
  ```bash
  node --import tsx scripts/validate-student-simulation.mts --snapshot <path-to-snapshot.json> --manifest <path-to-manifest.json> --output <path-to-report.json>
  ```

## Safe verification scope

1. Offline, read-only verification:
   - Does not import storage adapters or read/write state files.
   - Refuses non-synthetic manifest files (`synthetic: true` required).
   - Requires exclusive output creation flag (`wx`) to avoid overwriting or following links.
2. Verified invariant checks:
   - Unique student names ($\ge 1000$, Vietnamese locale normalized, no `mô phỏng` strings) and unique IDs.
   - School and class diversity.
   - Complete 3-phase runs (PRE -> TRAINING -> POST) with 2 assessment records and 3 scenario attempts.
   - Strict rule engine score and outcome equality using `evaluateAttempt`.
   - Exact parity with `buildAdminReadModel` totals.
   - SHA-256 event batch checksums, sequential sequence numbers, and orphan checks.
   - Deterministic AI records ($\ge 3000$) matching pseudo-anonymous seed expectations.

## Remaining work

- Parent agent runs `scripts/run-student-simulation.mts` against a isolated local instance to generate new synthetic test dataset.
- Parent agent invokes `scripts/validate-student-simulation.mts` against the newly produced snapshot and manifest.
