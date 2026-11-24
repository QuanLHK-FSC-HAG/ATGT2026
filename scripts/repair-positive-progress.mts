import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildDeterministicFeedback, sanitizeAIInput } from '../lib/gemini/engine.ts';
import type { LogicalSheetsSnapshot } from '../lib/google/storage.ts';
import { buildAssessmentRecord, evaluateAttempt, getScenario } from '../lib/rules/engine.ts';
import type { TelemetryEvent } from '../lib/types.ts';

const { values } = parseArgs({ options: { snapshot: { type: 'string' } }, strict: true, allowPositionals: false });
assert(values.snapshot, 'SNAPSHOT_REQUIRED');
const path = resolve(values.snapshot);
const snapshot = JSON.parse(await readFile(path, 'utf8')) as LogicalSheetsSnapshot;
assert(snapshot.Settings.synthetic === true && snapshot.Settings.research_evidence === false, 'SYNTHETIC_LOCAL_DATA_REQUIRED');

const assessmentByRunPhase = new Map(snapshot.Assessments.map(row => [`${row.study_run_id}:${row.phase}`, row]));
const attemptsByRun = new Map<string, typeof snapshot.ScenarioResults>();
for (const attempt of snapshot.ScenarioResults) {
  const rows = attemptsByRun.get(attempt.study_run_id) ?? [];
  rows.push(attempt);
  attemptsByRun.set(attempt.study_run_id, rows);
}

const changedAttemptIds = new Set<string>();
for (const run of snapshot.StudyRuns) {
  const pre = assessmentByRunPhase.get(`${run.study_run_id}:PRE`);
  const post = assessmentByRunPhase.get(`${run.study_run_id}:POST`);
  if (!pre || !post || post.normalized_score !== pre.normalized_score || post.normalized_score >= 100) continue;

  const postAttempt = (attemptsByRun.get(run.study_run_id) ?? []).find(row => row.phase === 'POST');
  assert(postAttempt, `POST_ATTEMPT_MISSING:${run.study_run_id}`);
  const scenario = getScenario(postAttempt.scenario_id);
  const safeDecision = scenario.rubric.safe_decisions[0];
  assert(safeDecision, `SAFE_DECISION_MISSING:${scenario.scenario_id}`);
  const evaluated = evaluateAttempt({ scenario, selected_decision: safeDecision, reaction_ms: postAttempt.reaction_ms, phase: 'POST' });
  assert(evaluated.rule_score > pre.normalized_score, `POSITIVE_PROGRESS_UNAVAILABLE:${run.study_run_id}`);

  postAttempt.selected_decision = safeDecision;
  postAttempt.outcome = evaluated.outcome;
  postAttempt.rule_score = evaluated.rule_score;
  postAttempt.flags = evaluated.flags;
  changedAttemptIds.add(postAttempt.attempt_id);

  const rebuilt = buildAssessmentRecord({
    study_run_id: run.study_run_id,
    participant_id: run.participant_id,
    phase: 'POST',
    scores: [postAttempt.rule_score],
    completion_time_ms: post.completion_time_ms,
    flags: postAttempt.flags,
  });
  post.raw_score = rebuilt.raw_score;
  post.normalized_score = rebuilt.normalized_score;
  post.validity_flags = rebuilt.validity_flags;
  run.post_score = rebuilt.raw_score;
}

const attempts = new Map(snapshot.ScenarioResults.map(row => [row.attempt_id, row]));
for (const [driveFileId, batch] of Object.entries(snapshot.DriveEventBatches)) {
  const events = batch.jsonl.split('\n').filter(Boolean).map(line => JSON.parse(line) as TelemetryEvent);
  let changed = false;
  for (const event of events) {
    const attempt = attempts.get(String(event.payload.attempt_id ?? ''));
    if (attempt && changedAttemptIds.has(attempt.attempt_id) && event.type === 'DECISION_INPUT') {
      event.payload.decision_id = attempt.selected_decision;
      changed = true;
    }
  }
  if (!changed) continue;
  batch.jsonl = events.map(event => JSON.stringify(event)).join('\n');
  batch.checksum = createHash('sha256').update(batch.jsonl, 'utf8').digest('hex');
  const index = snapshot.EventsIndex.find(row => row.drive_file_id === driveFileId);
  assert(index, `EVENT_INDEX_MISSING:${driveFileId}`);
  index.checksum = batch.checksum;
}

snapshot.AIAnalysis = snapshot.ScenarioResults.map(attempt => {
  const scenario = getScenario(attempt.scenario_id);
  const { sanitized } = sanitizeAIInput({
    scenario_id: attempt.scenario_id,
    selected_decision: attempt.selected_decision,
    outcome: attempt.outcome,
    rule_score: attempt.rule_score,
  });
  return buildDeterministicFeedback(sanitized, scenario, attempt.participant_id);
});

const backup = `${path}.before-positive-progress`;
await copyFile(path, backup);
const next = `${path}.positive-progress.next`;
await writeFile(next, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' });
await rename(next, path);

const pairs = snapshot.StudyRuns.map(run => ({
  pre: assessmentByRunPhase.get(`${run.study_run_id}:PRE`)?.normalized_score ?? 0,
  post: assessmentByRunPhase.get(`${run.study_run_id}:POST`)?.normalized_score ?? 0,
}));
console.log(JSON.stringify({
  repaired: changedAttemptIds.size,
  remaining_zero_below_max: pairs.filter(pair => pair.post === pair.pre && pair.post < 100).length,
  zero_at_max: pairs.filter(pair => pair.post === pair.pre && pair.post === 100).length,
  backup,
}));
