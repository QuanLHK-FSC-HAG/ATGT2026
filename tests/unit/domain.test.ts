import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { participantInput, eventBatch, DomainError } from '../../lib/validation/input.ts';
import { issueParticipantToken, verifyParticipantToken, requireAdmin } from '../../lib/auth/session.ts';
import { CANONICAL_SCENARIOS, evaluateAttempt, transitionStudyRun, toPublicScenarioView } from '../../lib/rules/engine.ts';
import { sanitizeAIInput, generatePedagogicalFeedback } from '../../lib/gemini/engine.ts';
import { assertProductionStorageReady } from '../../lib/google/storage.ts';
import type { StudyRunRecord } from '../../lib/types.ts';

describe('SafeRide Domain Unit Tests', () => {
  it('validates student 4-field input and rejects HTML/script injection or missing privacy notice', () => {
    const valid = participantInput({
      full_name: '  Nguyễn   Văn  An ',
      class_name: '10A1',
      school_name: 'THPT Chu Văn An',
      province_city: 'Hà Nội',
      privacy_notice_accepted: true,
    });
    assert.equal(valid.full_name, 'Nguyễn Văn An');
    assert.equal(valid.class_name, '10A1');
    assert.equal(valid.school_name, 'THPT Chu Văn An');

    assert.throws(
      () =>
        participantInput({
          full_name: '<script>alert(1)</script>',
          class_name: '10A1',
          school_name: 'THPT A',
          province_city: 'Hà Nội',
          privacy_notice_accepted: true,
        }),
      (err: unknown) => err instanceof DomainError && err.code === 'INVALID_FIELD',
    );

    assert.throws(
      () =>
        participantInput({
          full_name: 'Trần Thị Bình',
          class_name: '9B',
          school_name: 'THCS B',
          province_city: 'Đà Nẵng',
          privacy_notice_accepted: false,
        }),
      (err: unknown) => err instanceof DomainError && err.code === 'PRIVACY_NOTICE_REQUIRED',
    );
  });

  it('signs and verifies HttpOnly participant session tokens and rejects tampering', () => {
    const ids = {
      session_id: randomUUID(),
      participant_id: randomUUID(),
      study_run_id: randomUUID(),
    };
    const issued = issueParticipantToken(ids, 3600);
    assert.match(issued.cookie, /HttpOnly/);
    assert.match(issued.cookie, /SameSite=Lax/);
    const verified = verifyParticipantToken(issued.token);
    assert.equal(verified.sid, ids.session_id);
    assert.equal(verified.pid, ids.participant_id);
    assert.equal(verified.srid, ids.study_run_id);

    assert.throws(
      () => verifyParticipantToken(`${issued.token}tampered`),
      (err: unknown) => err instanceof DomainError && err.code === 'UNAUTHORIZED',
    );
  });

  it('computes deterministic scoring and never leaks rubric in public scenario view', () => {
    const scenario = CANONICAL_SCENARIOS[0];
    const publicView = toPublicScenarioView(scenario);
    assert.equal('rubric' in publicView, false);

    const safeEval = evaluateAttempt({
      scenario,
      selected_decision: 'opt_brake_wait',
      reaction_ms: 850,
      phase: 'PRE',
    });
    assert.equal(safeEval.outcome, 'SAFE');
    assert.equal(safeEval.rule_score, 100);

    const hazardEval = evaluateAttempt({
      scenario,
      selected_decision: 'opt_speed_pass',
      reaction_ms: 850,
      phase: 'PRE',
    });
    assert.equal(hazardEval.outcome, 'HAZARDOUS');
    assert.ok(hazardEval.rule_score <= 15);
    assert.ok(hazardEval.flags.includes('CRITICAL_HAZARD_SELECTED'));
  });

  it('enforces PRE -> TRAINING -> POST study state machine transitions', () => {
    const initial: StudyRunRecord = {
      study_run_id: randomUUID(),
      participant_id: randomUUID(),
      current_phase: 'PRE',
      state: 'PRE_IN_PROGRESS',
      pre_completed: false,
      training_completed_count: 0,
      post_completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    assert.throws(
      () => transitionStudyRun(initial, { type: 'COMPLETE_POST', score: 90 }),
      (err: unknown) => err instanceof DomainError && err.code === 'PRE_NOT_COMPLETED',
    );

    const afterPre = transitionStudyRun(initial, { type: 'COMPLETE_PRE', score: 65 });
    assert.equal(afterPre.current_phase, 'TRAINING');
    assert.equal(afterPre.pre_completed, true);

    const afterTraining = transitionStudyRun(afterPre, { type: 'RECORD_TRAINING' });
    assert.equal(afterTraining.current_phase, 'POST');

    const afterPost = transitionStudyRun(afterTraining, { type: 'COMPLETE_POST', score: 95 });
    assert.equal(afterPost.state, 'COMPLETED');
    assert.equal(afterPost.post_completed, true);
    assert.equal(afterPost.pre_score, 65);
    assert.equal(afterPost.post_score, 95);
  });

  it('rejects PII in Gemini input and provides deterministic fallback when Gemini is unavailable', async () => {
    assert.throws(
      () =>
        sanitizeAIInput({
          scenario_id: 'blind-spot-truck-right-turn',
          selected_decision: 'opt_speed_pass',
          outcome: 'HAZARDOUS',
          rule_score: 10,
          full_name: 'Nguyễn Văn An',
        }),
      (err: unknown) => err instanceof DomainError && err.code === 'PII_REJECTED_BY_AI_GUARD',
    );

    const feedback = await generatePedagogicalFeedback({
      scenario_id: 'blind-spot-truck-right-turn',
      selected_decision: 'opt_speed_pass',
      outcome: 'HAZARDOUS',
      rule_score: 10,
    });
    assert.equal(feedback.status, 'DETERMINISTIC_FALLBACK');
    assert.ok(feedback.safety_principle.length > 10);
  });

  it('fails closed in production when Google storage credentials are missing', () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevSheets = process.env.GOOGLE_SHEETS_ID;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      delete process.env.GOOGLE_SHEETS_ID;
      assert.throws(
        () => assertProductionStorageReady(),
        (err: unknown) => err instanceof DomainError && err.code === 'GOOGLE_STORAGE_CREDENTIALS_MISSING',
      );
    } finally {
      const env = process.env as Record<string, string | undefined>;
      if (prevNodeEnv === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = prevNodeEnv;
      if (prevSheets !== undefined) process.env.GOOGLE_SHEETS_ID = prevSheets;
    }
  });

  it('validates event batches and keeps admin APIs securely denied', () => {
    const sessionId = randomUUID();
    const batch = eventBatch(
      {
        batch_id: randomUUID(),
        session_id: sessionId,
        events: [
          {
            event_id: randomUUID(),
            session_id: sessionId,
            seq: 1,
            timestamp: new Date().toISOString(),
            schema_version: '1',
            type: 'HAZARD_VISIBLE',
            scenario_id: 'SCN-101A',
            payload: {},
          },
        ],
      },
      sessionId,
    );
    assert.equal(batch.events.length, 1);

    const req = new Request('http://localhost/api/admin/overview', {
      headers: { authorization: 'Bearer fake-admin-token' },
    });
    assert.throws(
      () => requireAdmin(req),
      (err: unknown) => err instanceof DomainError && err.status === 401 && err.code === 'ADMIN_OIDC_NOT_CONFIGURED',
    );
  });
});
