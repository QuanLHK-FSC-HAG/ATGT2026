import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { LogicalSheetsSnapshot } from '../lib/google/storage.ts';
import type { TelemetryEvent } from '../lib/types.ts';
import { buildDeterministicFeedback, sanitizeAIInput } from '../lib/gemini/engine.ts';
import { getScenario } from '../lib/rules/engine.ts';

const { values } = parseArgs({ options: {
  snapshot: { type: 'string' }, manifest: { type: 'string' }, backup: { type: 'boolean', default: false },
}, strict: true, allowPositionals: false });
assert(values.snapshot && values.manifest, 'SNAPSHOT_AND_MANIFEST_REQUIRED');
const snapshotPath = resolve(values.snapshot);
const manifestPath = resolve(values.manifest);
const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as LogicalSheetsSnapshot;
const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
  synthetic: boolean; started_at: string; ended_at: string; students: Array<{ ordinal: number; participant_id: string }>;
};
assert(snapshot.Settings.synthetic === true && manifest.synthetic === true, 'SYNTHETIC_DATA_REQUIRED');

const iso = (milliseconds: number) => new Date(milliseconds).toISOString();
const localSlot = (ordinal: number): number => {
  const day = 14 + ((ordinal * 7 + Math.floor(ordinal / 15)) % 15);
  const hours = ordinal % 5 < 2 ? 11 + (ordinal % 2) : 17 + (ordinal % 4);
  // Leave enough room for the complete 29-minute learning session inside the selected window.
  const minute = (ordinal * 17 + Math.floor(ordinal / 7)) % 19;
  const second = (ordinal * 13) % 60;
  // Requested windows use Asia/Saigon (UTC+7); Date.UTC stores the corresponding instant.
  return Date.UTC(2026, 10, day, hours - 7, minute, second, (ordinal * 37) % 1000);
};

const playerById = new Map(snapshot.Players.map(player => [player.participant_id, player]));
const runByParticipant = new Map(snapshot.StudyRuns.map(run => [run.participant_id, run]));
const sessionByParticipant = new Map(snapshot.Sessions.map(session => [session.participant_id, session]));
const attemptsByParticipant = new Map<string, typeof snapshot.ScenarioResults>();
for (const attempt of snapshot.ScenarioResults) {
  const rows = attemptsByParticipant.get(attempt.participant_id) ?? [];
  rows.push(attempt);
  attemptsByParticipant.set(attempt.participant_id, rows);
}
const assessmentByRunPhase = new Map(snapshot.Assessments.map(row => [`${row.study_run_id}:${row.phase}`, row]));
const aiByRef = new Map(snapshot.AIAnalysis.map(row => [row.pseudonymous_ref, row]));
const phaseOrder = new Map([['PRE', 0], ['TRAINING', 1], ['POST', 2]]);
let earliest = Number.POSITIVE_INFINITY;
let latest = 0;

// Scenario text can evolve independently; keep the AI log aligned while preserving record identity and timing.
for (const attempt of snapshot.ScenarioResults) {
  const scenario = getScenario(attempt.scenario_id);
  const { sanitized } = sanitizeAIInput({ scenario_id: attempt.scenario_id, selected_decision: attempt.selected_decision,
    outcome: attempt.outcome, rule_score: attempt.rule_score });
  const refreshed = buildDeterministicFeedback(sanitized, scenario, attempt.participant_id);
  const current = aiByRef.get(refreshed.pseudonymous_ref);
  assert(current, 'AI_ANALYSIS_NOT_FOUND');
  const { analysis_id, created_at } = current;
  Object.assign(current, refreshed, { analysis_id, created_at });
}

for (const student of manifest.students) {
  const base = localSlot(student.ordinal);
  const player = playerById.get(student.participant_id);
  const run = runByParticipant.get(student.participant_id);
  const session = sessionByParticipant.get(student.participant_id);
  assert(player && run && session, 'PARTICIPANT_RELATION_MISSING');
  player.created_at = iso(base - 90_000);
  run.created_at = iso(base - 60_000);
  session.started_at = iso(base);
  const attempts = (attemptsByParticipant.get(student.participant_id) ?? [])
    .sort((a, b) => (phaseOrder.get(a.phase) ?? 9) - (phaseOrder.get(b.phase) ?? 9));
  assert(attempts.length === 3, 'EXACTLY_THREE_ATTEMPTS_REQUIRED');

  for (const [phaseIndex, attempt] of attempts.entries()) {
    const start = base + 90_000 + phaseIndex * 9 * 60_000;
    const index = snapshot.EventsIndex.find(row => row.session_id === session.session_id
      && snapshot.DriveEventBatches[row.drive_file_id]?.jsonl.includes(attempt.attempt_id));
    assert(index, 'EVENT_INDEX_NOT_FOUND');
    const batch = snapshot.DriveEventBatches[index.drive_file_id];
    const events = batch.jsonl.split('\n').filter(Boolean).map(line => JSON.parse(line) as TelemetryEvent)
      .sort((a, b) => a.seq - b.seq);
    assert(events.length === 4, 'EVENT_COUNT_INVALID');
    const eventTimes = [start, start + 1_000, start + 1_000 + (attempt.reaction_ms ?? 0), start + 1_001 + (attempt.reaction_ms ?? 0)];
    events.forEach((event, eventIndex) => { event.timestamp = iso(eventTimes[eventIndex]); });
    batch.jsonl = events.map(event => JSON.stringify(event)).join('\n');
    batch.checksum = createHash('sha256').update(batch.jsonl, 'utf8').digest('hex');
    batch.created_at = iso(eventTimes[3] + 100);
    index.checksum = batch.checksum;
    index.created_at = batch.created_at;
    attempt.created_at = iso(eventTimes[3] + 200);
    const assessment = assessmentByRunPhase.get(`${run.study_run_id}:${attempt.phase}`);
    if (assessment) assessment.created_at = iso(eventTimes[3] + 300);
    const ref = createHash('sha256').update(`${attempt.participant_id}:${attempt.scenario_id}:${attempt.selected_decision}`).digest('hex').slice(0, 16);
    const ai = aiByRef.get(ref);
    if (ai) ai.created_at = iso(eventTimes[3] + 400);
  }
  const end = base + 29 * 60_000;
  session.ended_at = iso(end);
  session.expires_at = iso(base + 6 * 60 * 60_000);
  session.state = 'COMPLETED';
  run.updated_at = iso(end);
  earliest = Math.min(earliest, base - 90_000);
  latest = Math.max(latest, end);
}

manifest.started_at = iso(earliest);
manifest.ended_at = iso(latest + 60_000);
snapshot.Settings.activity_window = '2026-11-14..2026-11-28; 11:00-12:59 and 17:00-20:59 Asia/Saigon';

async function replace(path: string, value: unknown) {
  if (values.backup) await copyFile(path, join(dirname(path), `${basename(path)}.before-time-redistribution.json`));
  const next = `${path}.time.next`;
  await writeFile(next, JSON.stringify(value), { flag: 'wx' });
  await rename(next, path);
}
await replace(snapshotPath, snapshot);
await replace(manifestPath, manifest);
console.log(JSON.stringify({ students: manifest.students.length, started_at: manifest.started_at, ended_at: manifest.ended_at,
  activity_window: snapshot.Settings.activity_window }));
