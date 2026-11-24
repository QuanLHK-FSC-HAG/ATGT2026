import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminReadModel } from '../../lib/admin/read-model.ts';
import { GET } from '../../app/api/admin/library/route.ts';
import { CANONICAL_SCENARIOS } from '../../lib/rules/engine.ts';
import { LocalOnlyMockFileAdapter } from '../../lib/google/storage.ts';
import { issueAdminToken } from '../../lib/auth/session.ts';
import type { LogicalSheetsSnapshot } from '../../lib/google/storage.ts';
import type { AssessmentRecord, PlayerRecord, StudyRunRecord } from '../../lib/types.ts';

const time = '2026-11-19T00:00:00.000Z';
function empty(): LogicalSheetsSnapshot {
  return { storage_mode: 'LOCAL_DEMO_MOCK', demo_banner: null, Players: [], StudyRuns: [], Sessions: [],
    EventsIndex: [], ScenarioResults: [], Assessments: [], AIAnalysis: [], Scenarios: [], SystemLogs: [], Settings: {}, DriveEventBatches: {} };
}
function player(id: string): PlayerRecord {
  return { participant_id: id, full_name: '  Synthetic Nguyễn  An ', class_name: '10A', school_name: 'Synthetic school',
    province_city: 'Hà Nội', province_catalog_version: 'test', privacy_notice_version: 'test', created_at: time, status: 'ACTIVE' };
}
function run(id: string, participant = 'p1'): StudyRunRecord {
  return { study_run_id: id, participant_id: participant, current_phase: 'PRE', state: 'CREATED', pre_completed: false,
    post_completed: false, training_completed_count: 0, created_at: time, updated_at: time };
}
function assessment(id: string, runId: string, phase: 'PRE' | 'POST', value: number, participant = 'p1', at = time): AssessmentRecord {
  return { assessment_id: id, study_run_id: runId, participant_id: participant, phase, form_version: 'test',
    raw_score: value, normalized_score: value, completion_time_ms: 100, validity_flags: [], created_at: at };
}

describe('Admin library projection', () => {
  it('returns empty cards, zero totals and null paired averages', () => {
    assert.deepEqual(buildAdminReadModel(empty()), {
      students: [], research: [], ai: [], totals: { students: 0, sessions: 0, attempts: 0, paired_runs: 0, ai_logs: 0 },
      metrics: { paired_pre_average: null, paired_post_average: null, skills: [] },
    });
  });

  it('joins filter-ready fields, preserves names, counts records, and uses canonical titles/skills without identity decoding', () => {
    const snapshot = empty();
    const scenario = CANONICAL_SCENARIOS[0];
    snapshot.Players = [player('p1'), player('p2')];
    snapshot.StudyRuns = [{ ...run('r1'), state: 'COMPLETED' }, run('r2')];
    snapshot.Assessments = [assessment('a', 'r1', 'PRE', 40), assessment('b', 'r1', 'POST', 80), assessment('c', 'r2', 'PRE', 100)];
    snapshot.Sessions = ['s1', 's2'].map(session_id => ({ session_id, participant_id: 'p1', study_run_id: 'r1', device_class: 'DESKTOP',
      started_at: time, ended_at: null, expires_at: time, state: 'ACTIVE' }));
    snapshot.ScenarioResults = [40, 80].map((rule_score, i) => ({ attempt_id: `a${i}`, participant_id: 'p1', study_run_id: 'r1',
      session_id: 's1', phase: i === 0 ? 'PRE' as const : 'POST' as const, scenario_id: scenario.scenario_id, scenario_version: scenario.version, selected_decision: 'test',
      outcome: 'SAFE', rule_score, rule_engine_version: 'test', reaction_ms: null, flags: [], created_at: time }));
    snapshot.AIAnalysis = [{ analysis_id: 'ai1', pseudonymous_ref: 'opaque:not-a-participant-id', scenario_id: scenario.scenario_id,
      model_version: 'test', prompt_version: 'test', error_explanation: 'test', safety_principle: 'test', suggested_practice: 'test',
      confidence_limitations: 'test', status: 'DETERMINISTIC_FALLBACK', created_at: time }];
    snapshot.Scenarios = [{ ...scenario, title_vi: 'Do not trust snapshot title' }];
    const before = structuredClone(snapshot);
    const result = buildAdminReadModel(snapshot);
    assert.deepEqual(snapshot, before);
    assert.deepEqual(result.students[0], { participant_id: 'p1', full_name: player('p1').full_name, class_name: '10A',
      school_name: 'Synthetic school', province_city: 'Hà Nội', session_count: 2, completed_runs: 1, attempt_count: 2 });
    assert.equal(result.students[1].session_count, 0);
    assert.equal(result.students[1].completed_runs, 0);
    assert.equal(result.students[1].attempt_count, 0);
    assert.deepEqual(result.research[0], { study_run_id: 'r1', participant_id: 'p1', full_name: player('p1').full_name,
      class_name: '10A', school_name: 'Synthetic school', pre_score: 40, post_score: 80, delta: 40, state: 'COMPLETED', created_at: time });
    assert.equal(result.research[1].post_score, null);
    assert.equal(result.research[1].delta, null);
    assert.deepEqual(result.totals, { students: 2, sessions: 2, attempts: 2, paired_runs: 1, ai_logs: 1 });
    assert.deepEqual(result.metrics, { paired_pre_average: 40, paired_post_average: 80,
      skills: [{ label: scenario.skill_group || scenario.rubric.error_group, pre_percent: 40, post_percent: 80, improvement: 40 }] });
    assert.deepEqual(result.ai[0], { ...snapshot.AIAnalysis[0], scenario_title: scenario.title_vi });
    assert.equal('full_name' in result.ai[0], false);
  });

  it('pairs by run AND participant, selects latest assessments deterministically, and never substitutes run scores', () => {
    const snapshot = empty();
    snapshot.Players = [player('p1')];
    snapshot.StudyRuns = [run('r1'), { ...run('r2'), pre_score: 99, post_score: 100 }, run('orphan', 'missing')];
    snapshot.Assessments = [assessment('old', 'r1', 'PRE', 5, 'p1', '2026-11-18T00:00:00Z'),
      assessment('z', 'r1', 'PRE', 60), assessment('a', 'r1', 'PRE', 20), assessment('post', 'r1', 'POST', 90),
      assessment('foreign', 'r1', 'POST', 1, 'p2', '2026-11-20T00:00:00Z'), assessment('separate', 'r2', 'POST', 50)];
    const result = buildAdminReadModel(snapshot);
    assert.equal(result.research[0].pre_score, 60);
    assert.equal(result.research[0].post_score, 90);
    assert.equal(result.research[0].delta, 30);
    assert.equal(result.research[1].pre_score, null);
    assert.equal(result.research[1].delta, null);
    assert.equal(result.research[2].full_name, '');
    assert.equal(result.totals.paired_runs, 1);
    snapshot.Assessments.reverse();
    assert.deepEqual(buildAdminReadModel(snapshot), result);
  });

  it('does not turn non-finite scores into paired data', () => {
    const snapshot = empty();
    snapshot.StudyRuns = [run('r1')];
    snapshot.Assessments = [assessment('a', 'r1', 'PRE', NaN), assessment('b', 'r1', 'POST', 90)];
    const result = buildAdminReadModel(snapshot);
    assert.equal(result.research[0].pre_score, null);
    assert.equal(result.totals.paired_runs, 0);
  });

  it('serves an authenticated projection from exactly one mocked snapshot read', async (t) => {
    const previous = process.env.SAFERIDE_FORCE_LOCAL_MOCK;
    process.env.SAFERIDE_FORCE_LOCAL_MOCK = 'true';
    const snapshot = empty();
    snapshot.Players = [player('p1')];
    const read = t.mock.method(LocalOnlyMockFileAdapter.prototype, 'getSnapshot', async () => snapshot);
    try {
      const issued = issueAdminToken({ email: 'quanlhk.01@gmail.com' });
      const response = await GET(new Request('http://localhost/api/admin/library', {
        headers: { cookie: issued.cookie.split(';')[0] },
      }));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await response.json(), buildAdminReadModel(snapshot));
      assert.equal(read.mock.callCount(), 1);
    } finally {
      if (previous === undefined) delete process.env.SAFERIDE_FORCE_LOCAL_MOCK;
      else process.env.SAFERIDE_FORCE_LOCAL_MOCK = previous;
    }
  });

  it('rejects unauthenticated current/simulation requests before reading storage', async () => {
    for (const query of ['', '?source=simulation']) {
      const response = await GET(new Request(`http://localhost/api/admin/library${query}`));
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const body = await response.json();
      assert.ok(body.error);
      assert.equal('students' in body, false);
    }
  });
});
