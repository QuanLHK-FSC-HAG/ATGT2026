import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { POST as createParticipant } from '../../app/api/public/participants/route.ts';
import { POST as createSession } from '../../app/api/public/sessions/route.ts';
import { GET as getScenarios } from '../../app/api/public/scenarios/route.ts';
import { POST as postEventBatch } from '../../app/api/public/events/batch/route.ts';
import { POST as submitAttempt } from '../../app/api/public/attempts/submit/route.ts';
import { GET as getProgress } from '../../app/api/public/progress/route.ts';
import { POST as postAIFeedback } from '../../app/api/public/ai-feedback/route.ts';
import { GET as getAdminOverview } from '../../app/api/admin/overview/route.ts';
import { GET as getAdminExports } from '../../app/api/admin/exports/route.ts';
import { getStorageAdapter } from '../../lib/google/storage.ts';

const testMockFile = resolve(process.cwd(), '.local-mock-data', `integration-test-${Date.now()}.json`);

describe('SafeRide End-to-End API Integration Flow (Pre -> Training -> Post + Admin Denial Guard)', () => {
  before(() => {
    process.env.SAFERIDE_LOCAL_MOCK_FILE = testMockFile;
  });

  after(() => {
    rmSync(testMockFile, { force: true });
  });

  it('completes student no-login onboarding, pre-test, training, post-test, AI feedback, and denies admin API without Google OIDC', async () => {
    // 1. Create participant (no Google login, 4 fields + privacy notice)
    const pRes = await createParticipant(
      new Request('http://localhost/api/public/participants', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          full_name: 'Lê Hoàng Nam',
          class_name: '8A2',
          school_name: 'THCS Nguyễn Du',
          province_city: 'TP. Hồ Chí Minh',
          privacy_notice_accepted: true,
        }),
      }),
    );
    assert.equal(pRes.status, 201);
    const pData = (await pRes.json()) as {
      participant_id: string;
      study_run_id: string;
      phase: string;
      storage_mode: string;
    };
    assert.equal(pData.storage_mode, 'LOCAL_DEMO_MOCK');
    assert.equal(pData.phase, 'PRE');

    // 2. Create session with registration intent header & capture signed HttpOnly cookie
    const sRes = await createSession(
      new Request('http://localhost/api/public/sessions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-saferide-registration-intent': `participant:${pData.participant_id}:${pData.study_run_id}`,
        },
        body: JSON.stringify({
          participant_id: pData.participant_id,
          study_run_id: pData.study_run_id,
          device_class: 'DESKTOP',
        }),
      }),
    );
    assert.equal(sRes.status, 201);
    const setCookie = sRes.headers.get('set-cookie');
    assert.ok(setCookie && setCookie.includes('sr_participant_session='));
    const cookieHeader = setCookie.split(';')[0];
    const sData = (await sRes.json()) as { session_id: string };

    // 3. Fetch public scenarios (ensure no rubric leaked)
    const scRes = await getScenarios(
      new Request('http://localhost/api/public/scenarios', {
        headers: { cookie: cookieHeader },
      }),
    );
    assert.equal(scRes.status, 200);
    const scData = (await scRes.json()) as { scenarios: Array<Record<string, unknown>> };
    assert.ok(scData.scenarios.length >= 3);
    assert.equal('rubric' in scData.scenarios[0], false);

    // 4. Send telemetry batch & verify idempotency
    const batchId = randomUUID();
    const telemetryNow = Date.now();
    const t0 = new Date(telemetryNow - 2000).toISOString();
    const t1 = new Date(telemetryNow - 1100).toISOString();
    const batchPayload = {
      batch_id: batchId,
      session_id: sData.session_id,
      events: [
        {
          event_id: randomUUID(),
          session_id: sData.session_id,
          seq: 1,
          timestamp: t0,
          schema_version: '1',
          type: 'HAZARD_VISIBLE',
          scenario_id: 'blind-spot-truck-right-turn',
          payload: { phase: 'PRE' },
        },
        {
          event_id: randomUUID(),
          session_id: sData.session_id,
          seq: 2,
          timestamp: t1,
          schema_version: '1',
          type: 'DECISION_INPUT',
          scenario_id: 'blind-spot-truck-right-turn',
          payload: { decision_id: 'opt_brake_wait' },
        },
      ],
    };

    const ebRes1 = await postEventBatch(
      new Request('http://localhost/api/public/events/batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify(batchPayload),
      }),
    );
    assert.equal(ebRes1.status, 202);

    const ebResDup = await postEventBatch(
      new Request('http://localhost/api/public/events/batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify(batchPayload),
      }),
    );
    assert.equal(ebResDup.status, 200);
    const ebDupData = (await ebResDup.json()) as { duplicate: boolean };
    assert.equal(ebDupData.duplicate, true);

    const storedEvents = await getStorageAdapter().getSessionEvents(sData.session_id);
    assert.equal(storedEvents.length, 2);
    assert.equal(storedEvents[0].scenario_id, 'blind-spot-truck-right-turn');
    assert.equal(storedEvents[1].payload.decision_id, 'opt_brake_wait');

    // 5. Submit PRE attempt (client sends fake score=0, server must compute real deterministic score=100)
    const preAttemptId = randomUUID();
    const preAttemptRes = await submitAttempt(
      new Request('http://localhost/api/public/attempts/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          attempt_id: preAttemptId,
          scenario_id: 'blind-spot-truck-right-turn',
          selected_decision: 'opt_brake_wait',
          phase: 'PRE',
          reaction_ms: 900,
          score: 0,
        }),
      }),
    );
    assert.equal(preAttemptRes.status, 201);
    const preAttemptData = (await preAttemptRes.json()) as {
      result: { rule_score: number; outcome: string; reaction_ms: number };
      study_run: { current_phase: string; pre_completed: boolean };
    };
    assert.equal(preAttemptData.result.rule_score, 100);
    assert.equal(preAttemptData.result.outcome, 'SAFE');
    assert.equal(preAttemptData.result.reaction_ms, 900);
    assert.equal(preAttemptData.study_run.current_phase, 'TRAINING');

    const retry = await submitAttempt(new Request('http://localhost/api/public/attempts/submit', {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: cookieHeader },
      body: JSON.stringify({ attempt_id: preAttemptId, scenario_id: 'blind-spot-truck-right-turn', selected_decision: 'opt_brake_wait', phase: 'PRE', reaction_ms: 900 }),
    }));
    assert.ok(retry.ok);
    assert.equal((await retry.json()).duplicate, true);
    assert.equal((await getStorageAdapter().getStudyRunAttempts(pData.study_run_id)).filter(a => a.phase === 'PRE').length, 1);

    // 6. Submit TRAINING attempt -> transitions to POST
    const trainAttemptRes = await submitAttempt(
      new Request('http://localhost/api/public/attempts/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          attempt_id: randomUUID(),
          scenario_id: 'school-gate-sudden-door',
          selected_decision: 'opt_keep_distance',
          phase: 'TRAINING',
          reaction_ms: 800,
        }),
      }),
    );
    assert.equal(trainAttemptRes.status, 201);
    const trainData = (await trainAttemptRes.json()) as { study_run: { current_phase: string } };
    assert.equal(trainData.study_run.current_phase, 'POST');

    // 7. Submit POST attempt -> completes paired study run
    const postAttemptRes = await submitAttempt(
      new Request('http://localhost/api/public/attempts/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          attempt_id: randomUUID(),
          scenario_id: 'intersection-uncontrolled-yield',
          selected_decision: 'opt_slow_yield_right',
          phase: 'POST',
          reaction_ms: 750,
        }),
      }),
    );
    assert.equal(postAttemptRes.status, 201);
    const postData = (await postAttemptRes.json()) as {
      study_run: { state: string; pre_completed: boolean; post_completed: boolean };
    };
    assert.equal(postData.study_run.state, 'COMPLETED');
    assert.equal(postData.study_run.pre_completed, true);
    assert.equal(postData.study_run.post_completed, true);

    // 8. Check progress endpoint returns current participant's paired study run
    const progRes = await getProgress(
      new Request('http://localhost/api/public/progress', {
        headers: { cookie: cookieHeader },
      }),
    );
    assert.equal(progRes.status, 200);
    const progData = (await progRes.json()) as { attempts_count: number; assessments: unknown[] };
    assert.equal(progData.attempts_count, 3);
    assert.equal(progData.assessments.length, 2);

    // 9. Request AI pedagogical feedback (whitelisted payload -> deterministic fallback)
    const aiRes = await postAIFeedback(
      new Request('http://localhost/api/public/ai-feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          scenario_id: 'blind-spot-truck-right-turn',
          selected_decision: 'opt_brake_wait',
          outcome: 'SAFE',
          rule_score: 100,
        }),
      }),
    );
    assert.equal(aiRes.status, 200);
    const aiData = (await aiRes.json()) as { status: string; safety_principle: string };
    assert.equal(aiData.status, 'DETERMINISTIC_FALLBACK');
    assert.ok(aiData.safety_principle.includes('điểm mù'));

    // 10. Verify Admin API denies unauthenticated requests
    const deniedNoToken = await getAdminOverview(new Request('http://localhost/api/admin/overview'));
    assert.equal(deniedNoToken.status, 401);

    // 11. Verify Admin API denies student cookies
    const deniedStudentToken = await getAdminOverview(
      new Request('http://localhost/api/admin/overview', {
        headers: { cookie: cookieHeader },
      }),
    );
    assert.equal(deniedStudentToken.status, 401);

    // 12. Verify Admin exports API is similarly protected
    const deniedExports = await getAdminExports(new Request('http://localhost/api/admin/exports'));
    assert.equal(deniedExports.status, 401);
  });
});
