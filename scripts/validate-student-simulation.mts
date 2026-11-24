import { createHash } from 'node:crypto';
import { open, readFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildAdminReadModel } from '../lib/admin/read-model.ts';
import { buildDeterministicFeedback, sanitizeAIInput } from '../lib/gemini/engine.ts';
import { buildAssessmentRecord, evaluateAttempt, getScenario } from '../lib/rules/engine.ts';
import type { LogicalSheetsSnapshot } from '../lib/google/storage.ts';
import type { TelemetryEvent } from '../lib/types.ts';
import { FPT_HAU_GIANG_SCHOOL, SIMULATION_SCHOOLS, SIMULATION_SCHOOL_DISCLAIMER } from '../lib/data/simulation-schools.ts';

// Offline, read-only inputs. No storage adapter, provider calls, repairs or default paths.
type ManifestAttempt = { attempt_id: string; phase: string; scenario_id: string; decision: string; rule_score: number; outcome: string };
type Student = { ordinal: number; name: string; school: string; grade: string; status: string;
  participant_id: string; study_run_id: string; session_id: string; attempts: ManifestAttempt[];
  event_batches: number; events: number; ai_feedback: number; verified_assessments: number };
type Manifest = { schema_version: number; synthetic: boolean; research_evidence: boolean; status: string;
  seed: string; school_source: string; school_disclaimer: string; schools: typeof SIMULATION_SCHOOLS;
  acceptance_config_verified: boolean; requested_students: number; in_flight: unknown; failure: unknown;
  requests_started: number; requests_acknowledged: number; ended_at: string;
  counts: Record<string, number>; students: Student[] };
const phases = ['PRE', 'TRAINING', 'POST'] as const;
const errors: Record<string, number> = {};
const counts: Record<string, number> = {};
const check = (ok: unknown, code: string) => { if (!ok) errors[code] = (errors[code] ?? 0) + 1; };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
function index<T>(rows: T[], key: (row: T) => string, code: string): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) { const id = key(row); check(text(id) && !result.has(id), code); result.set(id, row); }
  return result;
}
function group<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const row of rows) { const id = key(row); const list = result.get(id) ?? []; list.push(row); result.set(id, list); }
  return result;
}
function validate(s: LogicalSheetsSnapshot, m: Manifest) {
  const n = m.requested_students;
  check(Number.isSafeInteger(n) && n >= 1000 && m.students.length === n, 'manifest_student_count');
  check(m.schema_version === 2 && m.status === 'COMPLETED' && m.research_evidence === false
    && m.acceptance_config_verified === true && m.in_flight === null && m.failure === null
    && m.requests_started === m.requests_acknowledged && Number.isFinite(Date.parse(m.ended_at)), 'manifest_not_completed');
  check(s.storage_mode === 'LOCAL_DEMO_MOCK', 'nonlocal_snapshot');
  check(s.Settings.synthetic === true && s.Settings.research_evidence === false
    && text(s.Settings.simulation_run_id) && text(s.Settings.school_source)
    && text(s.Settings.school_disclaimer), 'synthetic_provenance');
  check(text(m.seed) && text(m.school_source) && m.school_disclaimer === SIMULATION_SCHOOL_DISCLAIMER
    && equal(m.schools, SIMULATION_SCHOOLS), 'manifest_school_provenance');
  const players = index(s.Players, p => p.participant_id, 'player_id');
  const runs = index(s.StudyRuns, r => r.study_run_id, 'run_id');
  const sessions = index(s.Sessions, r => r.session_id, 'session_id');
  const attempts = index(s.ScenarioResults, r => r.attempt_id, 'attempt_id');
  index(s.Assessments, r => r.assessment_id, 'assessment_id');
  index(s.AIAnalysis, r => r.analysis_id, 'ai_id');
  index(s.EventsIndex, r => r.batch_id, 'batch_id');
  index(s.EventsIndex, r => r.drive_file_id, 'batch_file_id');
  index(s.SystemLogs, r => r.log_id, 'system_log_id');
  index(m.students, r => r.participant_id, 'manifest_player_id');
  index(m.students, r => r.study_run_id, 'manifest_run_id');
  index(m.students, r => r.session_id, 'manifest_session_id');
  index(m.students, r => String(r.ordinal), 'manifest_ordinal');
  const names = s.Players.map(p => p.full_name.normalize('NFC').trim().toLocaleLowerCase('vi'));
  check(names.every(name => name && !/mô\s*phỏng|mo\s*phong/i.test(name)), 'student_names');
  const schoolCatalog = new Map(SIMULATION_SCHOOLS.map(school => [school.name, school]));
  const schoolCounts = new Map<string, number>();
  for (const player of s.Players) {
    const school = schoolCatalog.get(player.school_name);
    schoolCounts.set(player.school_name, (schoolCounts.get(player.school_name) ?? 0) + 1);
    const grade = Number.parseInt(player.class_name, 10);
    check(Boolean(school) && Number.isInteger(grade) && school!.allowedGrades.includes(grade), 'school_grade');
    check(Boolean(school) && player.province_city === school!.locality, 'school_province');
    check(!/giả\s*lập|gia\s*lap|mô\s*phỏng|mo\s*phong/i.test(player.school_name), 'fictional_school_name');
  }
  const fptPlayers = s.Players.filter(player => player.school_name === FPT_HAU_GIANG_SCHOOL);
  const fptByClass = group(fptPlayers, player => player.class_name);
  check(fptPlayers.length === 103
    && fptByClass.get('6A')?.length === 18 && fptByClass.get('7A')?.length === 20
    && fptByClass.get('8A')?.length === 18 && fptByClass.get('10A')?.length === 25
    && fptByClass.get('11A')?.length === 22, 'fpt_roster_sample');
  const priorityHighSchools = new Set([
    'Trường THPT Vị Thanh', 'Trường THCS và THPT Chiêm Thành Tấn', 'Trường THPT Long Mỹ',
    'Trường THPT Vị Thủy',
  ]);
  const prioritySizes = [...schoolCounts.entries()].filter(([name]) => priorityHighSchools.has(name)).map(([, value]) => value);
  const localSizes = [...schoolCounts.entries()]
    .filter(([name]) => name !== FPT_HAU_GIANG_SCHOOL && !priorityHighSchools.has(name)).map(([, value]) => value);
  check(schoolCounts.size === SIMULATION_SCHOOLS.length
    && prioritySizes.length === 4 && prioritySizes.every(value => value >= 120 && value <= 180)
    && localSizes.every(value => value >= 10 && value <= 30)
    && new Set([...prioritySizes, ...localSizes]).size >= 10, 'school_distribution');
  check(new Set(s.Players.map(p => p.class_name)).size > 1, 'class_diversity');
  const runAttempts = group(s.ScenarioResults, a => a.study_run_id);
  const runAssessments = group(s.Assessments, a => a.study_run_id);
  for (const run of s.StudyRuns) {
    check(players.has(run.participant_id), 'orphan_run');
    check(run.state === 'COMPLETED' && run.current_phase === 'POST' && run.pre_completed === true
      && run.post_completed === true && run.training_completed_count === 1, 'incomplete_run');
    const rows = runAttempts.get(run.study_run_id) ?? [];
    const assessments = runAssessments.get(run.study_run_id) ?? [];
    check(rows.length === 3 && phases.every(p => rows.filter(a => a.phase === p).length === 1), 'run_phase_results');
    check(new Set(rows.map(a => a.scenario_id)).size === 3, 'run_distinct_scenarios');
    check(assessments.length === 2 && ['PRE', 'POST'].every(p => assessments.filter(a => a.phase === p).length === 1), 'run_assessments');
    for (const assessment of assessments) {
      const rowsInPhase = rows.filter(a => a.phase === assessment.phase);
      const expected = buildAssessmentRecord({ study_run_id: run.study_run_id, participant_id: run.participant_id,
        phase: assessment.phase, scores: rowsInPhase.map(a => a.rule_score), completion_time_ms: 0,
        flags: rowsInPhase.flatMap(a => a.flags) });
      check(assessment.participant_id === run.participant_id && assessment.raw_score === expected.raw_score
        && assessment.normalized_score === expected.normalized_score && assessment.form_version === expected.form_version
        && assessment.completion_time_ms === 0 && equal(assessment.validity_flags, expected.validity_flags), 'assessment_values');
      check((assessment.phase === 'PRE' ? run.pre_score : run.post_score) === expected.raw_score, 'run_score');
    }
  }
  for (const session of s.Sessions) check(players.has(session.participant_id)
    && runs.get(session.study_run_id)?.participant_id === session.participant_id, 'orphan_session');
  for (const assessment of s.Assessments) check(runs.get(assessment.study_run_id)?.participant_id === assessment.participant_id
    && players.has(assessment.participant_id) && ['PRE', 'POST'].includes(assessment.phase), 'orphan_assessment');

  const allEvents: TelemetryEvent[] = [];
  const usedFiles = new Set<string>();
  for (const entry of s.EventsIndex) {
    usedFiles.add(entry.drive_file_id);
    check(sessions.has(entry.session_id), 'orphan_event_index');
    check(entry.write_status === 'COMMITTED' && entry.storage_mode === 'LOCAL_DEMO_MOCK', 'event_index_status');
    const batch = s.DriveEventBatches[entry.drive_file_id];
    if (!batch) { check(false, 'missing_event_file'); continue; }
    const digest = createHash('sha256').update(batch.jsonl, 'utf8').digest('hex');
    check(digest === batch.checksum && digest === entry.checksum, 'event_checksum');
    let events: TelemetryEvent[];
    try { events = batch.jsonl.split('\n').filter(Boolean).map(line => JSON.parse(line) as TelemetryEvent); }
    catch { check(false, 'invalid_event_jsonl'); continue; }
    check(events.length === 4 && events.length === entry.event_count && events[0]?.seq === entry.first_seq
      && events.at(-1)?.seq === entry.last_seq, 'event_index_range');
    for (const event of events) {
      check(event.session_id === entry.session_id && event.schema_version === '1'
        && Number.isFinite(Date.parse(event.timestamp)), 'event_metadata');
      const attempt = attempts.get(String(event.payload.attempt_id));
      check(attempt && attempt.session_id === event.session_id && attempt.scenario_id === event.scenario_id
        && attempt.phase === event.payload.phase && event.payload.input_type === 'UNKNOWN', 'orphan_event_attempt');
    }
    allEvents.push(...events);
  }
  check(Object.keys(s.DriveEventBatches).length === usedFiles.size
    && Object.keys(s.DriveEventBatches).every(id => usedFiles.has(id)), 'orphan_event_file');
  index(allEvents, e => e.event_id, 'event_id');
  const sessionEvents = group(allEvents, e => e.session_id);
  const attemptEvents = group(allEvents, e => String(e.payload.attempt_id));
  for (const session of s.Sessions) {
    const events = (sessionEvents.get(session.session_id) ?? []).sort((a, b) => a.seq - b.seq);
    check(events.length === 12 && events.every((e, i) => e.seq === i + 1 && (i === 0
      || Date.parse(e.timestamp) > Date.parse(events[i - 1].timestamp))), 'event_sequence');
    check(events.every((e, i) => e.payload.phase === phases[Math.floor(i / 4)]), 'event_phase_order');
  }
  const expectedAI = new Map<string, ReturnType<typeof buildDeterministicFeedback>>();
  for (const attempt of s.ScenarioResults) {
    const session = sessions.get(attempt.session_id);
    check(players.has(attempt.participant_id) && runs.get(attempt.study_run_id)?.participant_id === attempt.participant_id
      && session?.participant_id === attempt.participant_id && session?.study_run_id === attempt.study_run_id, 'orphan_attempt');
    check(Number.isFinite(Date.parse(attempt.created_at)) && session && Date.parse(attempt.created_at) >= Date.parse(session.started_at)
      && (!session.ended_at || Date.parse(attempt.created_at) <= Date.parse(session.ended_at)), 'attempt_session_time');
    const events = (attemptEvents.get(attempt.attempt_id) ?? []).sort((a, b) => a.seq - b.seq);
    check(equal(events.map(e => e.type), ['SCENARIO_START', 'HAZARD_VISIBLE', 'DECISION_INPUT', 'SCENARIO_END']), 'attempt_event_types');
    const reaction = events.length === 4 ? Date.parse(events[2].timestamp) - Date.parse(events[1].timestamp) : NaN;
    check(Number.isFinite(reaction) && reaction >= 0 && reaction === attempt.reaction_ms
      && events[2]?.payload.decision_id === attempt.selected_decision, 'attempt_reaction');
    try {
      const scenario = getScenario(attempt.scenario_id);
      check(scenario.approved && scenario.phase_eligibility.includes(attempt.phase)
        && scenario.version === attempt.scenario_version && attempt.rule_engine_version === '2026.1-deterministic', 'attempt_scenario');
      const score = evaluateAttempt({ scenario, selected_decision: attempt.selected_decision, reaction_ms: reaction, phase: attempt.phase });
      check(score.rule_score === attempt.rule_score && score.outcome === attempt.outcome && equal(score.flags, attempt.flags), 'rule_engine_mismatch');
      const { sanitized } = sanitizeAIInput({ scenario_id: attempt.scenario_id, selected_decision: attempt.selected_decision,
        outcome: attempt.outcome, rule_score: attempt.rule_score });
      // Forward verification of known synthetic IDs only; never recover names from a hash.
      const feedback = buildDeterministicFeedback(sanitized, scenario, attempt.participant_id);
      check(!expectedAI.has(feedback.pseudonymous_ref), 'expected_ai_collision');
      expectedAI.set(feedback.pseudonymous_ref, feedback);
    } catch { check(false, 'invalid_scenario_or_decision'); }
  }
  const seenAI = new Set<string>();
  for (const ai of s.AIAnalysis) {
    const expected = expectedAI.get(ai.pseudonymous_ref);
    check(expected && !seenAI.has(ai.pseudonymous_ref), 'orphan_or_duplicate_ai');
    seenAI.add(ai.pseudonymous_ref);
    check(ai.status === 'DETERMINISTIC_FALLBACK', 'nondeterministic_ai');
    if (expected) for (const field of ['scenario_id', 'model_version', 'prompt_version', 'error_explanation',
      'safety_principle', 'suggested_practice', 'confidence_limitations'] as const) check(ai[field] === expected[field], 'ai_content');
  }
  check(s.AIAnalysis.length >= 3000 && expectedAI.size === seenAI.size
    && [...expectedAI.keys()].every(key => seenAI.has(key)), 'ai_coverage');
  for (const student of m.students) {
    const p = players.get(student.participant_id);
    const session = sessions.get(student.session_id);
    check(Number.isInteger(student.ordinal) && student.ordinal >= 1 && student.ordinal <= n && student.status === 'COMPLETED'
      && p?.full_name === student.name && p?.school_name === student.school && p?.class_name === student.grade
      && session?.study_run_id === student.study_run_id && session?.participant_id === student.participant_id, 'manifest_student');
    check(student.attempts.length === 3 && new Set(student.attempts.map(a => a.attempt_id)).size === 3
      && phases.every(p => student.attempts.filter(a => a.phase === p).length === 1), 'manifest_attempt_count');
    for (const a of student.attempts) {
      const stored = attempts.get(a.attempt_id);
      check(stored && stored.study_run_id === student.study_run_id && stored.session_id === student.session_id
        && stored.participant_id === student.participant_id && stored.phase === a.phase && stored.scenario_id === a.scenario_id
        && stored.selected_decision === a.decision && stored.rule_score === a.rule_score && stored.outcome === a.outcome, 'manifest_attempt');
    }
    check(student.events === 12 && student.event_batches === 3 && student.ai_feedback === 3
      && student.verified_assessments === 2, 'manifest_student_counters');
  }
  const expectedCounts = { started_students: n, completed_students: n, failed_students: 0, pending_students: 0,
    acknowledged_attempts: n * 3, acknowledged_event_batches: n * 3, acknowledged_events: n * 12,
    acknowledged_ai_feedback: n * 3, verified_assessments: n * 2 };
  for (const [key, value] of Object.entries(expectedCounts)) check(m.counts[key] === value, 'manifest_totals');
  Object.assign(counts, { students: s.Players.length, runs: s.StudyRuns.length, sessions: s.Sessions.length,
    attempts: s.ScenarioResults.length, assessments: s.Assessments.length, event_batches: s.EventsIndex.length,
    events: allEvents.length, ai_records: s.AIAnalysis.length });
  const expectedRows = { students: n, runs: n, sessions: n, attempts: n * 3, assessments: n * 2,
    event_batches: n * 3, events: n * 12, ai_records: n * 3 };
  for (const [key, value] of Object.entries(expectedRows)) check(counts[key] === value, 'snapshot_totals');
  const model = buildAdminReadModel(s);
  check(equal(model.totals, { students: m.counts.completed_students, sessions: n,
    attempts: m.counts.acknowledged_attempts, paired_runs: n, ai_logs: m.counts.acknowledged_ai_feedback }), 'admin_totals');
  check(model.students.every(p => p.session_count === 1 && p.completed_runs === 1 && p.attempt_count === 3), 'admin_student_totals');
  check(model.research.every(r => r.pre_score !== null && r.post_score !== null && r.delta === r.post_score - r.pre_score), 'admin_pairs');
}

async function main() {
  const { values } = parseArgs({ options: { snapshot: { type: 'string' }, manifest: { type: 'string' },
    output: { type: 'string' }, help: { type: 'boolean' } }, strict: true, allowPositionals: false });
  if (values.help) {
    console.log('Usage: node --import tsx scripts/validate-student-simulation.mts --snapshot <NEW synthetic snapshot.json> --manifest <NEW run manifest.json> --output <new report.json>');
    return;
  }
  if (!values.snapshot || !values.manifest || !values.output) throw new Error('OPTIONS_REQUIRED');
  const snapshotPath = await realpath(resolve(values.snapshot));
  const manifestPath = await realpath(resolve(values.manifest));
  const outputPath = resolve(values.output);
  if (snapshotPath === manifestPath || [snapshotPath, manifestPath].some(p => p.toLowerCase() === outputPath.toLowerCase())) throw new Error('DISTINCT_PATHS_REQUIRED');
  // Require explicit synthetic provenance BEFORE opening the snapshot. Never scan directories.
  const manifest: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!object(manifest) || manifest.synthetic !== true) throw new Error('SYNTHETIC_MANIFEST_REQUIRED');
  // Exclusive create: do not overwrite a previous report, dataset, or symlink target.
  const output = await open(outputPath, 'wx');
  try {
    try {
      const snapshot: unknown = JSON.parse(await readFile(snapshotPath, 'utf8'));
      if (!object(snapshot) || !['Players', 'StudyRuns', 'Sessions', 'ScenarioResults', 'Assessments', 'AIAnalysis', 'EventsIndex', 'SystemLogs']
        .every(key => Array.isArray(snapshot[key]) && snapshot[key].every(object)) || !object(snapshot.DriveEventBatches)
        || !Array.isArray(manifest.students) || !manifest.students.every(object) || !object(manifest.counts)) {
        check(false, 'invalid_input_shape');
      } else validate(snapshot as unknown as LogicalSheetsSnapshot, manifest as unknown as Manifest);
    } catch { check(false, 'invalid_input_or_validation_failure'); }
    const report = { schema_version: 1, synthetic: true, valid: Object.keys(errors).length === 0, counts, errors };
    await output.writeFile(JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify(report));
    if (!report.valid) process.exitCode = 1;
  } finally { await output.close(); }
}
main().catch(() => {
  // Neither untrusted input values nor filesystem paths/names appear in failures.
  console.error(JSON.stringify({ valid: false, errors: { validator_refused_or_io_failed: 1 } }));
  process.exitCode = 1;
});
