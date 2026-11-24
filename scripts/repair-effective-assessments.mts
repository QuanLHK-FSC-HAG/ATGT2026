import assert from 'node:assert/strict';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { LogicalSheetsSnapshot } from '../lib/google/storage.ts';
import { buildAssessmentRecord } from '../lib/rules/engine.ts';

const { values } = parseArgs({ options: { snapshot: { type: 'string' } }, strict: true, allowPositionals: false });
assert(values.snapshot, 'SNAPSHOT_REQUIRED');
const path = resolve(values.snapshot);
const snapshot = JSON.parse(await readFile(path, 'utf8')) as LogicalSheetsSnapshot;
assert(snapshot.Settings.synthetic === true, 'SYNTHETIC_DATA_REQUIRED');
for (const assessment of snapshot.Assessments) {
  const attempts = snapshot.ScenarioResults.filter(attempt =>
    attempt.study_run_id === assessment.study_run_id && attempt.phase === assessment.phase);
  const rebuilt = buildAssessmentRecord({ study_run_id: assessment.study_run_id, participant_id: assessment.participant_id,
    phase: assessment.phase, scores: attempts.map(attempt => attempt.rule_score),
    completion_time_ms: assessment.completion_time_ms, flags: attempts.flatMap(attempt => attempt.flags) });
  assessment.raw_score = rebuilt.raw_score;
  assessment.normalized_score = rebuilt.normalized_score;
  assessment.validity_flags = rebuilt.validity_flags;
}
const next = `${path}.assessment-repair.next`;
await writeFile(next, JSON.stringify(snapshot), { flag: 'wx' });
await rename(next, path);
console.log(JSON.stringify({ repaired_assessments: snapshot.Assessments.length }));
