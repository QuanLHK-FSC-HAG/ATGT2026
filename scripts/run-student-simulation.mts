import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, realpath, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { allocateSimulationSchools, gradeForSchool, SIMULATION_SCHOOLS, SIMULATION_SCHOOL_DISCLAIMER } from '../lib/data/simulation-schools.ts';

// HTTP-only synthetic acceptance data. Never import storage, read private names,
// execute the legacy generator, or persist cookies/registration credentials.
const BASE_URL = 'http://127.0.0.1:3001';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FAMILIES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ'];
const MIDDLES = ['Minh', 'Ngọc', 'Thảo', 'Gia', 'Khánh', 'Quốc', 'Thanh', 'Anh', 'Phương', 'Bảo', 'Tuệ', 'Hải'];
const GIVENS = ['An', 'Bình', 'Châu', 'Duy', 'Giang', 'Hà', 'Hân', 'Khang', 'Linh', 'Long', 'Minh', 'Nam', 'Nhi', 'Phúc', 'Quân', 'Trang', 'Vy', 'Yến'];
const PHASES = ['PRE', 'TRAINING', 'POST'] as const;
type Phase = typeof PHASES[number];
type Json = Record<string, unknown>;
type Scenario = { scenario_id: string; options: { id: string }[] };
type Attempt = { attempt_id: string; phase: Phase; scenario_id: string; decision: string; rule_score: number; outcome: string };
type Student = {
  ordinal: number; name: string; school: string; grade: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  participant_id?: string; study_run_id?: string; session_id?: string;
  attempts: Attempt[]; event_batches: number; events: number; ai_feedback: number;
  verified_assessments: number; error?: string;
};

function record(value: unknown): Json {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), 'INVALID_RESPONSE_OBJECT');
  return value as Json;
}
function string(value: unknown): string {
  assert(typeof value === 'string' && value.length > 0, 'INVALID_RESPONSE_STRING');
  return value;
}
function seededRandom(seed: string): () => number {
  let state = [...seed].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
function namesWithoutReplacement(count: number, seed: string): string[] {
  const names = FAMILIES.flatMap(f => MIDDLES.flatMap(m => GIVENS.map(g => `${f} ${m} ${g}`)));
  const random = seededRandom(seed);
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  assert.equal(new Set(names).size, names.length);
  return names.slice(0, count);
}
function scenariosFrom(value: unknown): Scenario[] {
  assert(Array.isArray(value) && value.length > 0, 'NO_ELIGIBLE_SCENARIOS');
  return value.map(raw => {
    const s = record(raw);
    const id = string(s.scenario_id);
    assert(/^[A-Za-z0-9_-]{1,64}$/.test(id), 'INVALID_SCENARIO_ID');
    assert(Array.isArray(s.options) && s.options.length > 0, 'NO_SCENARIO_OPTIONS');
    return { scenario_id: id, options: s.options.map(rawOption => {
      const option = string(record(rawOption).id);
      assert(/^opt_[a-z_]{1,60}$/.test(option), 'INVALID_OPTION_ID');
      return { id: option };
    }) };
  });
}

async function main() {
  const { values } = parseArgs({ options: {
    'base-url': { type: 'string', default: BASE_URL },
    count: { type: 'string', default: '1000' },
    'name-offset': { type: 'string', default: '0' },
    seed: { type: 'string', default: 'saferide-schools-2026-v1' },
    smoke: { type: 'boolean', default: false },
    output: { type: 'string' },
    help: { type: 'boolean', default: false },
  }, strict: true, allowPositionals: false });
  if (values.help) {
    console.log('Usage: node --import tsx scripts/run-student-simulation.mts --output .runtime/NEW-RUN [--count 1000] [--seed saferide-schools-2026-v1] [--smoke]');
    console.log('Count: 1000..2808, or 1..25 only with --smoke. Output must be a new direct child of .runtime.');
    return;
  }
  assert.equal(values['base-url'], BASE_URL, 'ONLY_HTTP_127_0_0_1_PORT_3001_ALLOWED');
  assert(/^\d+$/.test(values.count), 'COUNT_MUST_BE_AN_INTEGER');
  assert(/^\d+$/.test(values['name-offset']), 'NAME_OFFSET_MUST_BE_AN_INTEGER');
  const count = Number(values.count);
  const nameOffset = Number(values['name-offset']);
  const capacity = FAMILIES.length * MIDDLES.length * GIVENS.length;
  const validCount = values.smoke ? count >= 1 && count <= SIMULATION_SCHOOLS.length : count >= 1000 && count <= capacity;
  assert(Number.isSafeInteger(count) && validCount, values.smoke ? 'SMOKE_COUNT_MUST_BE_1_TO_25' : 'COUNT_MUST_BE_1000_TO_2808');
  assert(Number.isSafeInteger(nameOffset) && nameOffset >= 0 && nameOffset + count <= capacity, 'NAME_RANGE_EXCEEDS_CAPACITY');
  assert(/^[A-Za-z0-9._-]{1,80}$/.test(values.seed), 'INVALID_SEED');
  assert(values.output, 'OUTPUT_REQUIRED');
  const output = resolve(values.output);
  const runtime = join(ROOT, '.runtime');
  assert.equal(dirname(output), runtime, 'OUTPUT_MUST_BE_A_NEW_DIRECT_CHILD_OF_PROJECT_RUNTIME');
  assert(/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(output.slice(runtime.length + 1)), 'OUTPUT_NAME_MUST_BE_A_SIMPLE_RUN_SLUG');
  // Metadata only: do not enumerate or read existing runtime data. Reject junctions.
  await mkdir(runtime, { recursive: true });
  assert(!(await lstat(runtime)).isSymbolicLink(), 'RUNTIME_SYMLINK_REFUSED');
  assert.equal(await realpath(runtime), join(await realpath(ROOT), '.runtime'), 'RUNTIME_REDIRECTION_REFUSED');
  try { await mkdir(output); } catch { throw new Error('OUTPUT_EXISTS_OR_CANNOT_BE_CREATED_NO_RESUME'); }

  const schoolAssignments = allocateSimulationSchools(count, values.seed);
  const withinSchoolCounts = new Map<string, number>();
  const students: Student[] = namesWithoutReplacement(nameOffset + count, values.seed).slice(nameOffset).map((name, i) => {
    const school = schoolAssignments[i];
    const withinSchool = withinSchoolCounts.get(school.name) ?? 0;
    withinSchoolCounts.set(school.name, withinSchool + 1);
    const grade = gradeForSchool(school, withinSchool);
    return {
      ordinal: i + 1, name, school: school.name, grade: `${grade}A${1 + withinSchool % 3}`,
      status: 'PENDING', attempts: [], event_batches: 0, events: 0, ai_feedback: 0, verified_assessments: 0,
    };
  });
  const manifest = {
    schema_version: 2, synthetic: true, research_evidence: false, smoke: values.smoke,
    name_source: 'embedded Vietnamese family/middle/given combinations sampled without replacement',
    seed: values.seed,
    school_source: 'public school websites/directories for TP Cần Thơ; names only',
    school_disclaimer: SIMULATION_SCHOOL_DISCLAIMER,
    schools: SIMULATION_SCHOOLS,
    telemetry: 'synthetic timestamps and UNKNOWN input; not human reaction measurements',
    base_url: BASE_URL, requested_students: count,
    resume_policy: 'REFUSE: no retries; an interrupted request may have committed. Provision a fresh isolated store and new output directory.',
    started_at: new Date().toISOString(), ended_at: null as string | null,
    status: 'RUNNING' as 'RUNNING' | 'COMPLETED' | 'FAILED',
    acceptance_config_verified: false,
    requests_started: 0, requests_acknowledged: 0,
    in_flight: null as { method: string; path: string; student: number | null } | null,
    failure: null as string | null,
    counts: { started_students: 0, completed_students: 0, failed_students: 0, pending_students: count,
      acknowledged_attempts: 0, acknowledged_event_batches: 0, acknowledged_events: 0,
      acknowledged_ai_feedback: 0, verified_assessments: 0 },
    students,
  };
  // Atomic checkpoints replace ONLY files created in this new, exclusively claimed run directory.
  const checkpoint = async () => {
    manifest.counts = {
      started_students: students.filter(s => s.status !== 'PENDING').length,
      completed_students: students.filter(s => s.status === 'COMPLETED').length,
      failed_students: students.filter(s => s.status === 'FAILED').length,
      pending_students: students.filter(s => s.status === 'PENDING').length,
      acknowledged_attempts: students.reduce((n, s) => n + s.attempts.length, 0),
      acknowledged_event_batches: students.reduce((n, s) => n + s.event_batches, 0),
      acknowledged_events: students.reduce((n, s) => n + s.events, 0),
      acknowledged_ai_feedback: students.reduce((n, s) => n + s.ai_feedback, 0),
      verified_assessments: students.reduce((n, s) => n + s.verified_assessments, 0),
    };
    await writeFile(join(output, 'manifest.next.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
    await rename(join(output, 'manifest.next.json'), join(output, 'manifest.json'));
  };
  let current: Student | undefined;
  let stage = 'INITIALIZE';
  let cookie = '';
  let stopped = false;
  const stop = () => { stopped = true; };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  const request = async (path: string, body?: Json, extraHeaders: Record<string, string> = {}) => {
    assert(!stopped, 'STOP_REQUESTED');
    const method = body ? 'POST' : 'GET';
    stage = `${method} ${path}`;
    manifest.requests_started++;
    manifest.in_flight = { method, path, student: current?.ordinal ?? null };
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}${path}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(120_000),
        headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...extraHeaders },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch { throw new Error('HTTP_TRANSPORT_FAILED_COMMIT_STATUS_UNKNOWN'); }
    // Never include raw response/error bodies or headers in logs or the manifest.
    assert(response.ok, `HTTP_STATUS_${response.status}`);
    let data: Json;
    try { data = record(await response.json()); } catch { throw new Error('INVALID_JSON_RESPONSE_COMMIT_STATUS_UNKNOWN'); }
    manifest.requests_acknowledged++;
    manifest.in_flight = null;
    return { data, headers: response.headers };
  };
  const verifyConfig = async () => {
    const { data } = await request('/api/auth/admin/config');
    assert(data.configured === false && data.client_id === null && data.allow_local_login === true, 'LOCAL_ACCEPTANCE_CONFIG_REQUIRED');
    manifest.acceptance_config_verified = true;
  };
  try {
    await checkpoint();
    await verifyConfig();
    for (const student of students) {
      current = student;
      cookie = '';
      student.status = 'IN_PROGRESS';
      // Repeat guard before every onboarding; parent must provision the isolated acceptance server.
      await verifyConfig();
      const { data: p } = await request('/api/public/participants', {
        full_name: student.name, class_name: student.grade, school_name: student.school,
        province_city: schoolAssignments[student.ordinal - 1].locality, privacy_notice_accepted: true,
      });
      assert.equal(p.storage_mode, 'LOCAL_DEMO_MOCK', 'LOCAL_STORAGE_REQUIRED');
      student.participant_id = string(p.participant_id);
      student.study_run_id = string(p.study_run_id);
      const { data: session, headers } = await request('/api/public/sessions', {
        participant_id: student.participant_id, study_run_id: student.study_run_id,
        device_class: ['DESKTOP', 'TABLET', 'MOBILE'][(student.ordinal - 1) % 3],
      }, { 'x-saferide-registration-intent': `participant:${student.participant_id}:${student.study_run_id}` });
      cookie = headers.getSetCookie().find(c => c.startsWith('sr_participant_session='))?.split(';')[0] ?? '';
      assert(cookie.length > 'sr_participant_session='.length, 'SESSION_COOKIE_MISSING');
      student.session_id = string(session.session_id);
      let seq = 0;
      let lastTimestamp = Date.now() - 20_000;
      const usedScenarios = new Set<string>();
      for (const [phaseIndex, phase] of PHASES.entries()) {
        const { data: catalog } = await request(`/api/public/scenarios?phase=${phase}`);
        const eligible = scenariosFrom(catalog.scenarios).filter(s => !usedScenarios.has(s.scenario_id));
        assert(eligible.length > 0, 'NEED_DISTINCT_SCENARIO_PER_PHASE');
        const scenario = eligible[(student.ordinal - 1 + phaseIndex) % eligible.length];
        usedScenarios.add(scenario.scenario_id);
        // Vary valid choices without assuming the first option is correct.
        const decision = scenario.options[(student.ordinal - 1 + phaseIndex) % scenario.options.length].id;
        const attemptId = randomUUID();
        const reaction = 500 + ((student.ordinal * 137 + phaseIndex * 311) % 2000);
        const start = Math.max(lastTimestamp + 1, Date.now() - 5000);
        const times = [start, start + 100, start + 100 + reaction, start + 101 + reaction];
        lastTimestamp = times[3];
        const events = ['SCENARIO_START', 'HAZARD_VISIBLE', 'DECISION_INPUT', 'SCENARIO_END'].map((type, index) => ({
          event_id: randomUUID(), session_id: student.session_id, seq: ++seq,
          timestamp: new Date(times[index]).toISOString(), schema_version: '1', type,
          scenario_id: scenario.scenario_id,
          payload: { attempt_id: attemptId, phase, input_type: 'UNKNOWN',
            ...(type === 'DECISION_INPUT' ? { decision_id: decision } : {}) },
        }));
        const { data: batch } = await request('/api/public/events/batch', {
          batch_id: randomUUID(), session_id: student.session_id, events,
        });
        assert(batch.event_count === events.length && batch.write_status === 'COMMITTED' && batch.duplicate === false, 'EVENT_BATCH_NOT_COMMITTED');
        student.event_batches++;
        student.events += events.length;
        const { data: submitted } = await request('/api/public/attempts/submit', {
          attempt_id: attemptId, scenario_id: scenario.scenario_id, selected_decision: decision, phase, reaction_ms: reaction,
        });
        const result = record(submitted.result);
        assert.equal(result.attempt_id, attemptId, 'ATTEMPT_ID_MISMATCH');
        assert.equal(result.reaction_ms, reaction, 'REACTION_NOT_SERVER_VERIFIED');
        assert(typeof result.rule_score === 'number' && Number.isFinite(result.rule_score), 'INVALID_SCORE');
        student.attempts.push({ attempt_id: attemptId, phase, scenario_id: scenario.scenario_id,
          decision, rule_score: result.rule_score, outcome: string(result.outcome) });
        const run = record(submitted.study_run);
        assert(phase === 'POST' ? run.state === 'COMPLETED' : run.current_phase === PHASES[phaseIndex + 1], 'PHASE_TRANSITION_FAILED');
        const { data: feedback } = await request('/api/public/ai-feedback', {
          scenario_id: scenario.scenario_id, selected_decision: decision,
          outcome: result.outcome, rule_score: result.rule_score,
        });
        assert.equal(feedback.status, 'DETERMINISTIC_FALLBACK', 'LOCAL_AI_FALLBACK_REQUIRED');
        assert(typeof feedback.safety_principle === 'string' && feedback.safety_principle.length > 0, 'FEEDBACK_MISSING');
        student.ai_feedback++;
      }
      const { data: progress } = await request('/api/public/progress');
      const run = record(progress.study_run);
      assert.equal(progress.participant_id, student.participant_id, 'PROGRESS_PARTICIPANT_MISMATCH');
      assert.equal(progress.session_id, student.session_id, 'PROGRESS_SESSION_MISMATCH');
      assert(run.state === 'COMPLETED' && run.pre_completed === true && run.post_completed === true && run.training_completed_count === 1, 'STUDY_NOT_COMPLETED');
      assert(progress.attempts_count === 3 && Array.isArray(progress.attempts) && progress.attempts.length === 3, 'EXACTLY_THREE_ATTEMPTS_REQUIRED');
      assert.deepEqual(progress.attempts.map(a => string(record(a).attempt_id)).sort(), student.attempts.map(a => a.attempt_id).sort());
      assert(Array.isArray(progress.assessments) && progress.assessments.length === 2, 'TWO_ASSESSMENTS_REQUIRED');
      assert.deepEqual(progress.assessments.map(a => record(a).phase).sort(), ['POST', 'PRE']);
      student.verified_assessments = 2;
      student.status = 'COMPLETED';
      cookie = '';
      if (student.ordinal % 25 === 0 || student.ordinal === count) {
        await checkpoint();
        console.log(`Verified ${student.ordinal}/${count} synthetic students`);
      }
    }
    manifest.status = 'COMPLETED';
  } catch (error) {
    // Assertion errors can contain actual response values: keep only static stage/code.
    const code = error instanceof Error && /^[A-Z][A-Z_0-9]+$/.test(error.message) ? error.message : 'VALIDATION_OR_IO_FAILURE';
    manifest.failure = `${stage}: ${code}`;
    manifest.status = 'FAILED';
    if (current && current.status !== 'COMPLETED') {
      current.status = 'FAILED';
      current.error = manifest.failure;
    }
    process.exitCode = 1;
  } finally {
    cookie = '';
    manifest.ended_at = new Date().toISOString();
    await checkpoint();
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
  console.log(JSON.stringify({ status: manifest.status, counts: manifest.counts, manifest: join(output, 'manifest.json') }));
}

main().catch(() => {
  // No stack traces or untrusted response bodies: startup errors must not leak credentials.
  console.error('Simulation refused or checkpoint failed. Check CLI options, new output path, and local server. Never reuse this run directory or retry against a partially populated store.');
  process.exitCode = 1;
});
