import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, submitAttempt, loadScenario, sendEvents, type SessionInfo } from '../../components/api.ts';
import type { ParticipantInput } from '../../lib/types.ts';
import type { Scenario } from '../../game/types.ts';

const input: ParticipantInput = { full_name: 'Học sinh mô phỏng', class_name: '10A1', school_name: 'Trường kiểm thử', province_city: 'TP Cần Thơ', privacy_notice_accepted: false };
const session: SessionInfo = { participantId: 'participant', studyRunId: 'study', sessionId: 'session', mode: 'server', storageMode: 'LOCAL_DEMO_MOCK' };
const scenario: Scenario = { scenario_id: 'example', version: '1', title_vi: '', prompt_vi: '', hazard_cue_vi: '', options: [{ id: 'first', label_vi: '' }] };

test('client preserves consent and refuses failed registrations or sessions', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, init) => {
      assert.equal(JSON.parse(String(init?.body)).privacy_notice_accepted, false);
      return new Response('{}', { status: 400 });
    };
    await assert.rejects(createSession(input), /registration rejected/);
    let calls = 0;
    globalThis.fetch = async () => ++calls === 1
      ? Response.json({ participant_id: 'p', study_run_id: 's' })
      : new Response('{}', { status: 503 });
    await assert.rejects(createSession({ ...input, privacy_notice_accepted: true }), /Session creation rejected/);
  } finally { globalThis.fetch = original; }
});

test('client never fabricates a successful result or hides missing scenarios', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('{}', { status: 503 });
    await assert.rejects(submitAttempt(session, 'PRE', scenario, 'first', 900), /Attempt rejected/);
    await assert.rejects(loadScenario('PRE'), /Scenario service unavailable/);
    assert.ok((await loadScenario('PRE', true)).scenario_id);
    globalThis.fetch = async () => Response.json({});
    await assert.rejects(submitAttempt(session, 'PRE', scenario, 'first', 900), /verified result/);
  } finally { globalThis.fetch = original; }
});

test('client preserves real v2 gameplay timestamps and YIELD semantics', async () => {
  const original = globalThis.fetch;
  try {
    let payload: any;
    globalThis.fetch = async (_url, init) => {
      payload = JSON.parse(String(init?.body));
      return Response.json({}, { status: 202 });
    };
    const startedAt = Date.parse('2026-11-25T00:00:00.000Z');
    await sendEvents(session, 'PRE', 'SCN-101A', [
      { type: 'HAZARD_VISIBLE', at_ms: 900, speed_kmh: 12, distance_to_hazard_m: 8, archetype: 'PEDESTRIAN_CROSSING' },
      { type: 'ACTION', action: 'YIELD', at_ms: 1350, speed_kmh: 5, distance_to_hazard_m: 4, archetype: 'PEDESTRIAN_CROSSING' },
      { type: 'TERMINAL', action: 'YIELD', outcome: 'SAFE_YIELD', at_ms: 1500, speed_kmh: 0, distance_to_hazard_m: 3, archetype: 'PEDESTRIAN_CROSSING' },
    ], 'opt_safe', startedAt);
    assert.deepEqual(payload.events.map((event: any) => event.type), ['SCENARIO_START', 'HAZARD_VISIBLE', 'YIELD', 'TERMINAL', 'DECISION_INPUT', 'SCENARIO_END']);
    assert.equal(payload.events[2].timestamp, '2026-11-25T00:00:01.350Z');
    assert.equal(payload.events[2].payload.action, 'YIELD');
    assert.equal(payload.events[3].payload.terminal_outcome, 'SAFE_YIELD');
    assert.ok(payload.events.every((event: any) => event.schema_version === '2'));
    assert.ok(payload.events.every((event: any) => event.payload.phase === 'PRE'));
    assert.equal(new Set(payload.events.map((event: any) => event.payload.attempt_id)).size, 1);
  } finally { globalThis.fetch = original; }
});

test('client keeps the legacy v1 telemetry path compatible', async () => {
  const original = globalThis.fetch;
  try {
    let payload: any;
    globalThis.fetch = async (_url, init) => {
      payload = JSON.parse(String(init?.body));
      return Response.json({}, { status: 202 });
    };
    await sendEvents(session, 'PRE', 'SCN-101A', [], 'opt_safe', Date.now(), 750);
    assert.deepEqual(payload.events.map((event: any) => event.type), ['HAZARD_VISIBLE', 'DECISION_INPUT']);
    assert.ok(payload.events.every((event: any) => event.schema_version === '1'));
    assert.equal(Date.parse(payload.events[1].timestamp) - Date.parse(payload.events[0].timestamp), 750);
  } finally { globalThis.fetch = original; }
});

test('client fails closed when an interactive v2 trace cannot be uploaded', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('{}', { status: 503 });
    await assert.rejects(
      sendEvents(session, 'PRE', 'SCN-101A', [
        { type: 'TERMINAL', action: 'STOP', outcome: 'SAFE_STOP', at_ms: 500, speed_kmh: 0, distance_to_hazard_m: 3, archetype: 'PEDESTRIAN_CROSSING' },
      ], 'opt_safe', Date.now()),
      /Telemetry batch rejected/,
    );
  } finally { globalThis.fetch = original; }
});
