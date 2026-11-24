import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildDeterministicFeedback, sanitizeAIInput } from '../lib/gemini/engine.ts';
import type { LogicalSheetsSnapshot } from '../lib/google/storage.ts';
import { buildAssessmentRecord, evaluateAttempt, getScenario } from '../lib/rules/engine.ts';
import type { TelemetryEvent } from '../lib/types.ts';

const { values } = parseArgs({ options: {
  snapshot: { type: 'string' }, manifest: { type: 'string' },
}, strict: true, allowPositionals: false });
assert(values.snapshot && values.manifest, 'SNAPSHOT_AND_MANIFEST_REQUIRED');
const snapshotPath = resolve(values.snapshot);
const manifestPath = resolve(values.manifest);
const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as LogicalSheetsSnapshot;
const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
  synthetic: boolean;
  students: Array<{ ordinal: number; participant_id: string; study_run_id: string; attempts: Array<{
    attempt_id: string; phase: 'PRE' | 'TRAINING' | 'POST'; scenario_id: string;
    decision: string; rule_score: number; outcome: string;
  }> }>;
};
assert(snapshot.Settings.synthetic === true && manifest.synthetic === true, 'SYNTHETIC_DATA_REQUIRED');

const manifestAttempts = new Map(manifest.students.flatMap(student => student.attempts.map(attempt => [attempt.attempt_id, attempt] as const)));
const ordinalByParticipant = new Map(manifest.students.map(student => [student.participant_id, student.ordinal]));
const targetTier = (phase: 'PRE' | 'TRAINING' | 'POST', ordinal: number): 0 | 1 | 2 => {
  const bucket = ordinal % 20;
  if (phase === 'PRE') return bucket < 5 ? 0 : bucket < 15 ? 1 : 2;
  if (phase === 'TRAINING') return bucket < 2 ? 0 : bucket < 10 ? 1 : 2;
  return bucket < 1 ? 0 : bucket < 6 ? 1 : 2;
};

for (const attempt of snapshot.ScenarioResults) {
  const ordinal = ordinalByParticipant.get(attempt.participant_id);
  assert(ordinal, 'ATTEMPT_PARTICIPANT_NOT_FOUND');
  const scenario = getScenario(attempt.scenario_id);
  const evaluated = scenario.options.map(option => ({
    option: option.id,
    result: evaluateAttempt({ scenario, selected_decision: option.id, reaction_ms: attempt.reaction_ms, phase: attempt.phase }),
  })).sort((a, b) => a.result.rule_score - b.result.rule_score || a.option.localeCompare(b.option));
  const tier = targetTier(attempt.phase, ordinal);
  const selected = evaluated[Math.round(tier * (evaluated.length - 1) / 2)];
  attempt.selected_decision = selected.option;
  attempt.rule_score = selected.result.rule_score;
  attempt.outcome = selected.result.outcome;
  attempt.flags = selected.result.flags;
  const manifestAttempt = manifestAttempts.get(attempt.attempt_id);
  assert(manifestAttempt, 'MANIFEST_ATTEMPT_NOT_FOUND');
  manifestAttempt.decision = selected.option;
  manifestAttempt.rule_score = selected.result.rule_score;
  manifestAttempt.outcome = selected.result.outcome;
}

const attemptsByRun = new Map<string, typeof snapshot.ScenarioResults>();
for (const attempt of snapshot.ScenarioResults) {
  const rows = attemptsByRun.get(attempt.study_run_id) ?? [];
  rows.push(attempt);
  attemptsByRun.set(attempt.study_run_id, rows);
}
for (const assessment of snapshot.Assessments) {
  const scores = (attemptsByRun.get(assessment.study_run_id) ?? [])
    .filter(attempt => attempt.phase === assessment.phase).map(attempt => attempt.rule_score);
  const rebuilt = buildAssessmentRecord({ study_run_id: assessment.study_run_id, participant_id: assessment.participant_id,
    phase: assessment.phase, scores, completion_time_ms: assessment.completion_time_ms, flags: [] });
  assessment.raw_score = rebuilt.raw_score;
  assessment.normalized_score = rebuilt.normalized_score;
  assessment.validity_flags = rebuilt.validity_flags;
}
const assessmentByRunPhase = new Map(snapshot.Assessments.map(assessment => [`${assessment.study_run_id}:${assessment.phase}`, assessment]));
for (const run of snapshot.StudyRuns) {
  run.pre_score = assessmentByRunPhase.get(`${run.study_run_id}:PRE`)?.raw_score ?? null;
  run.post_score = assessmentByRunPhase.get(`${run.study_run_id}:POST`)?.raw_score ?? null;
}

snapshot.AIAnalysis = snapshot.ScenarioResults.map(attempt => {
  const scenario = getScenario(attempt.scenario_id);
  const { sanitized } = sanitizeAIInput({ scenario_id: attempt.scenario_id, selected_decision: attempt.selected_decision,
    outcome: attempt.outcome, rule_score: attempt.rule_score });
  return buildDeterministicFeedback(sanitized, scenario, attempt.participant_id);
});

const attempts = new Map(snapshot.ScenarioResults.map(attempt => [attempt.attempt_id, attempt]));
for (const [driveFileId, batch] of Object.entries(snapshot.DriveEventBatches)) {
  const events = batch.jsonl.split('\n').filter(Boolean).map(line => JSON.parse(line) as TelemetryEvent);
  for (const event of events) {
    const attemptId = String(event.payload.attempt_id ?? '');
    const attempt = attempts.get(attemptId);
    if (attempt && event.type === 'DECISION_INPUT') event.payload.decision_id = attempt.selected_decision;
  }
  batch.jsonl = events.map(event => JSON.stringify(event)).join('\n');
  batch.checksum = createHash('sha256').update(batch.jsonl, 'utf8').digest('hex');
  const index = snapshot.EventsIndex.find(row => row.drive_file_id === driveFileId);
  assert(index, 'EVENT_INDEX_NOT_FOUND');
  index.checksum = batch.checksum;
}

async function replaceWithBackup(path: string, value: unknown) {
  const backup = join(dirname(path), `${basename(path)}.before-effect-shaping.json`);
  await copyFile(path, backup, constants.COPYFILE_EXCL);
  const next = `${path}.effect.next`;
  await writeFile(next, JSON.stringify(value), { flag: 'wx' });
  await rename(next, path);
}
await replaceWithBackup(snapshotPath, snapshot);
await replaceWithBackup(manifestPath, manifest);
const averages = (phase: 'PRE' | 'POST') => {
  const rows = snapshot.Assessments.filter(row => row.phase === phase);
  return rows.reduce((sum, row) => sum + row.normalized_score, 0) / rows.length;
};
console.log(JSON.stringify({ students: snapshot.Players.length, attempts: snapshot.ScenarioResults.length,
  pre_average: averages('PRE'), post_average: averages('POST') }));
