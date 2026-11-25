import type { GameplayAction, ParticipantInput } from '@/lib/types';
import { FALLBACK } from '@/game/scenarios';
import type { AttemptResult, Phase, Scenario } from '@/game/types';

export type SessionInfo = {
  participantId: string;
  studyRunId: string;
  sessionId: string;
  mode: 'server' | 'local-demo';
  storageMode: 'GOOGLE' | 'LOCAL_DEMO_MOCK' | 'BROWSER_FALLBACK';
};

export type ClientGameplayEvent = {
  type: 'ACTION' | 'HAZARD_VISIBLE' | 'TERMINAL';
  at_ms: number;
  action?: GameplayAction;
  speed_kmh: number;
  distance_to_hazard_m: number;
  archetype: string;
  outcome?: 'SAFE_STOP' | 'SAFE_YIELD' | 'CONFLICT' | 'BLIND_ZONE_ENTRY';
};

const id = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const pendingAttemptIds = new Map<string, string>();

function attemptKey(session: SessionInfo, phase: Phase, scenarioId: string) {
  return `${session.sessionId}:${phase}:${scenarioId}`;
}

export function reserveAttemptId(session: SessionInfo, phase: Phase, scenarioId: string): string {
  const key = attemptKey(session, phase, scenarioId);
  const attemptId = pendingAttemptIds.get(key) ?? id();
  pendingAttemptIds.set(key, attemptId);
  return attemptId;
}

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
  phase: Phase,
  scenarioId: string,
  trace: ClientGameplayEvent[],
  selectedDecision?: string,
  attemptStartedAtMs = Date.now(),
  legacyReactionMs = 0,
) {
  if (session.mode !== 'server') return;
  try {
    const events: Array<{
      event_id: string;
      session_id: string;
      seq: number;
      timestamp: string;
      schema_version: '1' | '2';
      type: 'SCENARIO_START' | 'HAZARD_VISIBLE' | 'DECISION_INPUT' | 'BRAKE' | 'STOP' | 'SIGNAL' | 'YIELD' | 'MOVEMENT' | 'TERMINAL' | 'SCENARIO_END';
      scenario_id: string;
      payload: Record<string, string | number | boolean | null>;
    }> = [];

    let seq = 1;
    const attemptId = reserveAttemptId(session, phase, scenarioId);
    const v2Payload = (extra: Record<string, string | number | boolean | null> = {}) => ({ attempt_id: attemptId, phase, ...extra });
    if (!trace.length) {
      const now = Date.now();
      events.push({ event_id: id(), session_id: session.sessionId, seq: seq++, timestamp: new Date(now - Math.max(0, Math.min(300000, legacyReactionMs))).toISOString(), schema_version: '1', type: 'HAZARD_VISIBLE', scenario_id: scenarioId, payload: {} });
      if (selectedDecision) events.push({ event_id: id(), session_id: session.sessionId, seq: seq++, timestamp: new Date(now).toISOString(), schema_version: '1', type: 'DECISION_INPUT', scenario_id: scenarioId, payload: { decision_id: selectedDecision } });
    } else events.push({
      event_id: id(),
      session_id: session.sessionId,
      seq: seq++,
      timestamp: new Date(attemptStartedAtMs).toISOString(),
      schema_version: '2',
      type: 'SCENARIO_START',
      scenario_id: scenarioId,
      payload: v2Payload({ at_ms: 0 }),
    });
    for (const item of trace.slice().sort((a, b) => a.at_ms - b.at_ms)) {
      const eventType = item.type === 'HAZARD_VISIBLE' ? 'HAZARD_VISIBLE'
        : item.type === 'TERMINAL' ? 'TERMINAL'
          : item.action === 'BRAKE' ? 'BRAKE'
            : item.action === 'STOP' ? 'STOP'
              : item.action === 'YIELD' ? 'YIELD'
                : item.action === 'SIGNAL_LEFT' || item.action === 'SIGNAL_RIGHT' ? 'SIGNAL'
                  : 'MOVEMENT';
      events.push({
        event_id: id(),
        session_id: session.sessionId,
        seq: seq++,
        timestamp: new Date(attemptStartedAtMs + Math.max(0, item.at_ms)).toISOString(),
        schema_version: '2',
        type: eventType,
        scenario_id: scenarioId,
        payload: v2Payload({
          speed_kmh: item.speed_kmh,
          distance_to_hazard_m: item.distance_to_hazard_m,
          at_ms: item.at_ms,
          archetype: item.archetype,
          ...(item.action ? { action: item.action } : {}),
          ...(item.action === 'SIGNAL_LEFT' ? { signal_direction: 'LEFT' } : item.action === 'SIGNAL_RIGHT' ? { signal_direction: 'RIGHT' } : {}),
          ...(item.outcome ? { terminal_outcome: item.outcome } : {}),
        }),
      });
    }

    const terminalAtMs = trace
      .filter(item => item.type === 'TERMINAL')
      .reduce<number | null>((latest, item) => latest === null ? item.at_ms : Math.max(latest, item.at_ms), null);
    if (trace.length && selectedDecision) {
      events.push({
        event_id: id(),
        session_id: session.sessionId,
        seq: seq++,
        timestamp: new Date(attemptStartedAtMs + Math.max(0, terminalAtMs ?? 0)).toISOString(),
        schema_version: '2',
        type: 'DECISION_INPUT',
        scenario_id: scenarioId,
        payload: v2Payload({ decision_id: selectedDecision, at_ms: terminalAtMs ?? 0 }),
      });
    }
    if (trace.length) events.push({ event_id: id(), session_id: session.sessionId, seq: seq++, timestamp: new Date(attemptStartedAtMs + Math.max(0, terminalAtMs ?? 0)).toISOString(), schema_version: '2', type: 'SCENARIO_END', scenario_id: scenarioId, payload: v2Payload({ at_ms: terminalAtMs ?? 0 }) });

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
  } catch (error) {
    // Interactive attempts must never be scored without their exact trace.
    if (trace.length) throw error;
    // Legacy telemetry remains non-blocking for compatibility.
  }
}

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

  const key = attemptKey(session, phase, scenario.scenario_id);
  const attemptId = reserveAttemptId(session, phase, scenario.scenario_id);
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
  pendingAttemptIds.delete(key);
  const rule_score = data.result?.rule_score ?? data.rule_score as number;
  const outcome = data.result?.outcome ?? data.outcome as string;

  let feedback: string | undefined;
  try {
    const aiRes = await fetch('/api/public/ai-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ scenario_id: scenario.scenario_id, selected_decision: decision, outcome, rule_score }),
    });
    if (aiRes.ok) {
      const aiData = (await aiRes.json()) as { error_explanation?: string; safety_principle?: string; suggested_practice?: string };
      feedback = aiData.safety_principle || aiData.error_explanation || aiData.suggested_practice;
    }
  } catch {
    // The saved Rule Engine result remains valid when feedback is unavailable.
  }
  return { rule_score, outcome, feedback: feedback || 'Kết quả được chấm bởi Rule Engine trên máy chủ. Hãy đọc kỹ nguyên tắc an toàn trước chặng tiếp theo.' };
}
