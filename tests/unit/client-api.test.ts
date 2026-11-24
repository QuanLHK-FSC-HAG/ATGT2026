import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, submitAttempt, loadScenario, type SessionInfo } from '../../components/api.ts';
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
