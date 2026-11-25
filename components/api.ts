import type { ParticipantInput } from '@/lib/types';
import { FALLBACK } from '@/game/scenarios';
import type { AttemptResult, GameAction, Phase, Scenario } from '@/game/types';

export type SessionInfo = {
  participantId: string;
  studyRunId: string;
  sessionId: string;
  mode: 'server' | 'local-demo';
  storageMode: 'GOOGLE' | 'LOCAL_DEMO_MOCK' | 'BROWSER_FALLBACK';
};

const id = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export async function createSession(input: ParticipantInput): Promise<SessionInfo> {
  const payload = {
    full_name: input.full_name.trim(),
    class_name: input.class_name.trim(),
    school_name: input.school_name.trim(),
    province_city: input.province_city.trim(),
    privacy_notice_accepted: input.privacy_notice_accepted,
    privacy_notice_version: input.privacy_notice_version || '2026-01',
  };
  const regRes = await fetch('/api/public/participants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  if (!regRes.ok) throw new Error(`Participant registration rejected with HTTP ${regRes.status}`);

  const regData = (await regRes.json()) as {
    participant_id?: string;
    study_run_id?: string;
    storage_mode?: 'GOOGLE' | 'LOCAL_DEMO_MOCK';
  };
  if (!regData.participant_id || !regData.study_run_id) {
    throw new Error('Participant registration did not return required identifiers');
  }

  const sessRes = await fetch('/api/public/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-saferide-registration-intent': `participant:${regData.participant_id}:${regData.study_run_id}`,
    },
    body: JSON.stringify({
      participant_id: regData.participant_id,
      study_run_id: regData.study_run_id,
      device_class: 'DESKTOP',
    }),
    credentials: 'include',
  });
  if (!sessRes.ok) throw new Error(`Session creation rejected with HTTP ${sessRes.status}`);

  const sessData = (await sessRes.json()) as { session_id?: string };
  if (!sessData.session_id) throw new Error('Session creation did not return a session identifier');
  return {
    participantId: regData.participant_id,
    studyRunId: regData.study_run_id,
    sessionId: sessData.session_id,
    mode: 'server',
    storageMode: regData.storage_mode || 'LOCAL_DEMO_MOCK',
  };
}

export async function clearLocalParticipantSession(): Promise<void> {
  const response = await fetch('/api/public/sessions', {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Session reset rejected with HTTP ${response.status}`);
}

export async function loadScenario(phase: Phase, allowDemoFallback = false): Promise<Scenario> {
  try {
    const res = await fetch(`/api/public/scenarios?phase=${phase}`, {
      cache: 'no-store',
      credentials: 'include',
    });
    if (res.ok) {
      const data = (await res.json()) as { scenarios?: Scenario[]; items?: Scenario[] };
      const list = data.scenarios || data.items || [];
      if (list.length) {
        const pool = list.filter(item => item?.options?.length);
        if (pool.length) {
          // Mỗi lượt chơi dùng một cảnh kịch bản khác nhau từ kho 160 tình huống.
          return pool[Math.floor(Math.random() * pool.length)];
        }
      }
    }
  } catch {
    // Fallback to local scenarios
  }
  if (!allowDemoFallback) throw new Error('Scenario service unavailable');
  const local = FALLBACK[phase];
  return local[Math.floor(Math.random() * local.length)];
}

export async function sendEvents(
  session: SessionInfo,
  scenarioId: string,
  actions: GameAction[],
  selectedDecision?: string,
  observedReactionMs?: number
) {
  if (session.mode !== 'server') return;
  try {
    const events: Array<{
      event_id: string;
      session_id: string;
      seq: number;
      timestamp: string;
      schema_version: string;
      type: 'HAZARD_VISIBLE' | 'DECISION_INPUT' | 'BRAKE' | 'SIGNAL' | 'PAUSE' | 'RESUME';
      scenario_id: string;
      payload: Record<string, string | number | boolean | null>;
    }> = [];

    const now = Date.now();
    let seq = 1;

    events.push({
      event_id: id(),
      session_id: session.sessionId,
      seq: seq++,
      timestamp: new Date(now - Math.max(0, Math.min(300000, observedReactionMs ?? 0))).toISOString(),
      schema_version: '1',
      type: 'HAZARD_VISIBLE',
      scenario_id: scenarioId,
      payload: {},
    });

    for (const act of actions) {
      if (act === 'HAZARD_VISIBLE') continue;
      const eventType =
        act === 'BRAKE' ? 'BRAKE' : act === 'SIGNAL' ? 'SIGNAL' : act === 'PAUSE' ? 'PAUSE' : act === 'RESUME' ? 'RESUME' : 'BRAKE';
      events.push({
        event_id: id(),
        session_id: session.sessionId,
        seq: seq++,
        timestamp: new Date(now - 600).toISOString(),
        schema_version: '1',
        type: eventType,
        scenario_id: scenarioId,
        payload: {},
      });
    }

    if (selectedDecision) {
      events.push({
        event_id: id(),
        session_id: session.sessionId,
        seq: seq++,
        timestamp: new Date(now).toISOString(),
        schema_version: '1',
        type: 'DECISION_INPUT',
        scenario_id: scenarioId,
        payload: { decision_id: selectedDecision },
      });
    }

    const response = await fetch('/api/public/events/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        batch_id: id(),
        session_id: session.sessionId,
        events,
      }),
    });
    if (!response.ok) {
      throw new Error(`Telemetry batch rejected with HTTP ${response.status}`);
    }
  } catch {
    // Non-blocking telemetry
  }
}

const pendingAttemptIds = new Map<string, string>();

export async function submitAttempt(
  session: SessionInfo,
  phase: Phase,
  scenario: Scenario,
  decision: string,
  reactionMs: number
): Promise<AttemptResult> {
  if (session.mode !== 'server') {
    throw new Error('A saved assessment requires a server session');
  }

  const attemptKey = `${session.sessionId}:${phase}:${scenario.scenario_id}`;
  const attemptId = pendingAttemptIds.get(attemptKey) ?? id();
  pendingAttemptIds.set(attemptKey, attemptId);
  const res = await fetch('/api/public/attempts/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      attempt_id: attemptId,
      scenario_id: scenario.scenario_id,
      selected_decision: decision,
      phase,
      reaction_ms: reactionMs,
    }),
  });
  if (!res.ok) throw new Error(`Attempt rejected with HTTP ${res.status}`);

  const data = (await res.json()) as {
    result?: { rule_score?: number; outcome?: string };
    rule_score?: number;
    outcome?: string;
  };
  if (typeof (data.result?.rule_score ?? data.rule_score) !== 'number' || typeof (data.result?.outcome ?? data.outcome) !== 'string') {
    throw new Error('Attempt response did not contain a verified result');
  }
  pendingAttemptIds.delete(attemptKey);
  const rule_score = data.result?.rule_score ?? data.rule_score as number;
  const outcome = data.result?.outcome ?? data.outcome as string;

  // Điểm Rule Engine hiện ngay; phản hồi AI (Gemini) lấy riêng ở nền, không chặn.
  return { rule_score, outcome, feedback: 'Kết quả được chấm bởi Rule Engine trên máy chủ. Hãy đọc kỹ nguyên tắc an toàn trước chặng tiếp theo.' };
}

export async function fetchAiFeedback(
  scenario: Scenario,
  decision: string,
  outcome: string,
  rule_score: number
): Promise<string | null> {
  try {
    const aiRes = await fetch('/api/public/ai-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ scenario_id: scenario.scenario_id, selected_decision: decision, outcome, rule_score }),
    });
    if (!aiRes.ok) return null;
    const aiData = (await aiRes.json()) as { error_explanation?: string; safety_principle?: string; suggested_practice?: string };
    return aiData.safety_principle || aiData.error_explanation || aiData.suggested_practice || null;
  } catch {
    // The saved Rule Engine result remains valid when feedback is unavailable.
    return null;
  }
}