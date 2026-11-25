import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { POST as createParticipant } from '../../app/api/public/participants/route.ts';
import { POST as createSession } from '../../app/api/public/sessions/route.ts';
import { POST as postEventBatch } from '../../app/api/public/events/batch/route.ts';
import { POST as submitAttempt } from '../../app/api/public/attempts/submit/route.ts';

const testMockFile = resolve(process.cwd(), '.local-mock-data', `interaction-mismatch-${Date.now()}.json`);

describe('interactive 2.5D attempt verification', () => {
  before(() => {
    process.env.SAFERIDE_LOCAL_MOCK_FILE = testMockFile;
  });

  after(() => {
    rmSync(testMockFile, { force: true });
  });

  it('rejects a selected option that contradicts the terminal gameplay outcome', async () => {
    const participantResponse = await createParticipant(new Request('http://localhost/api/public/participants', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        full_name: 'HS1',
        class_name: '8A1',
        school_name: 'THCS & THPT A',
        province_city: 'TP Cần Thơ',
        privacy_notice_accepted: true,
      }),
    }));
    assert.equal(participantResponse.status, 201);
    const participant = await participantResponse.json() as { participant_id: string; study_run_id: string };

    const sessionResponse = await createSession(new Request('http://localhost/api/public/sessions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-saferide-registration-intent': `participant:${participant.participant_id}:${participant.study_run_id}`,
      },
      body: JSON.stringify({
        participant_id: participant.participant_id,
        study_run_id: participant.study_run_id,
        device_class: 'DESKTOP',
      }),
    }));
    assert.equal(sessionResponse.status, 201);
    const cookie = sessionResponse.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);
    const session = await sessionResponse.json() as { session_id: string };

    const startedAt = Date.now() - 1500;
    const scenarioId = 'blind-spot-truck-right-turn';
    const attemptId = randomUUID();
    const events = [
      { type: 'SCENARIO_START', at: 0, payload: {} },
      { type: 'HAZARD_VISIBLE', at: 300, payload: {} },
      { type: 'TERMINAL', at: 1200, payload: { terminal_outcome: 'BLIND_ZONE_ENTRY', action: 'PROCEED' } },
      { type: 'DECISION_INPUT', at: 1300, payload: { decision_id: 'opt_brake_wait' } },
      { type: 'SCENARIO_END', at: 1400, payload: {} },
    ];
    const telemetryResponse = await postEventBatch(new Request('http://localhost/api/public/events/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        batch_id: randomUUID(),
        session_id: session.session_id,
        events: events.map((event, index) => ({
          event_id: randomUUID(),
          session_id: session.session_id,
          seq: index + 1,
          timestamp: new Date(startedAt + event.at).toISOString(),
          schema_version: '2',
          type: event.type,
          scenario_id: scenarioId,
          payload: { attempt_id: attemptId, phase: 'PRE', at_ms: event.at, ...event.payload },
        })),
      }),
    }));
    assert.equal(telemetryResponse.status, 202);

    const attemptResponse = await submitAttempt(new Request('http://localhost/api/public/attempts/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        attempt_id: attemptId,
        scenario_id: scenarioId,
        selected_decision: 'opt_brake_wait',
        phase: 'PRE',
        reaction_ms: 1000,
      }),
    }));
    assert.equal(attemptResponse.status, 409);
    const error = await attemptResponse.json() as { error: { code: string } };
    assert.equal(error.error.code, 'INTERACTION_DECISION_MISMATCH');

    const unrelatedAttemptResponse = await submitAttempt(new Request('http://localhost/api/public/attempts/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        attempt_id: randomUUID(),
        scenario_id: scenarioId,
        selected_decision: 'opt_brake_wait',
        phase: 'PRE',
        reaction_ms: 1000,
      }),
    }));
    assert.equal(unrelatedAttemptResponse.status, 409);
    assert.equal((await unrelatedAttemptResponse.json() as { error: { code: string } }).error.code, 'INTERACTION_TRACE_INCOMPLETE');

    const partialAttemptId = randomUUID();
    const foreignAttemptId = randomUUID();
    const partialEvents = [
      { type: 'SCENARIO_START', at: 0, attempt_id: partialAttemptId, payload: {} },
      { type: 'HAZARD_VISIBLE', at: 200, attempt_id: partialAttemptId, payload: {} },
      { type: 'TERMINAL', at: 800, attempt_id: partialAttemptId, payload: { terminal_outcome: 'SAFE_STOP', action: 'STOP' } },
      { type: 'SCENARIO_END', at: 900, attempt_id: foreignAttemptId, payload: {} },
    ];
    const partialTelemetryResponse = await postEventBatch(new Request('http://localhost/api/public/events/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        batch_id: randomUUID(),
        session_id: session.session_id,
        events: partialEvents.map((event, index) => ({
          event_id: randomUUID(),
          session_id: session.session_id,
          seq: index + 1,
          timestamp: new Date(Date.now() - 1000 + event.at).toISOString(),
          schema_version: '2',
          type: event.type,
          scenario_id: scenarioId,
          payload: { attempt_id: event.attempt_id, phase: 'PRE', at_ms: event.at, ...event.payload },
        })),
      }),
    }));
    assert.equal(partialTelemetryResponse.status, 202);

    const partialAttemptResponse = await submitAttempt(new Request('http://localhost/api/public/attempts/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ attempt_id: partialAttemptId, scenario_id: scenarioId, selected_decision: 'opt_brake_wait', phase: 'PRE', reaction_ms: 600 }),
    }));
    assert.equal(partialAttemptResponse.status, 409);
    assert.equal((await partialAttemptResponse.json() as { error: { code: string } }).error.code, 'INTERACTION_TRACE_INCOMPLETE');
  });
});
