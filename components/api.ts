import type { ParticipantInput } from '@/lib/types';
import { FALLBACK } from '@/game/scenarios';
import type { AttemptResult, GameAction, Phase, Scenario } from '@/game/types';

export type SessionInfo = {
  participantId: string;
  studyRunId: string;
  sessionId: string;
  mode: 'server' | 'local-demo';
};

const id = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export async function createSession(input: ParticipantInput): Promise<SessionInfo> {
  try {
    const payload = {
      full_name: input.full_name.trim(),
      class_name: input.class_name.trim(),
      school_name: input.school_name.trim(),
      province_city: input.province_city.trim(),
      privacy_notice_accepted: true,
      privacy_notice_version: '2026-01',
    };
    const regRes = await fetch('/api/public/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });
    if (regRes.ok) {
      const regData = (await regRes.json()) as { participant_id?: string; study_run_id?: string };
      const participantId = regData.participant_id || id();
      const studyRunId = regData.study_run_id || id();
      const sessRes = await fetch('/api/public/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-saferide-registration-intent': `participant:${participantId}:${studyRunId}`,
        },
        body: JSON.stringify({
          participant_id: participantId,
          study_run_id: studyRunId,
          device_class: 'DESKTOP',
        }),
        credentials: 'include',
      });
      if (sessRes.ok) {
        const sessData = (await sessRes.json()) as { session_id?: string };
        return {
          participantId,
          studyRunId,
          sessionId: sessData.session_id || id(),
          mode: 'server',
        };
      }
      return { participantId, studyRunId, sessionId: id(), mode: 'server' };
    }
  } catch {
    // Offline local fallback if network or endpoint not reachable
  }
  return { participantId: id(), studyRunId: id(), sessionId: id(), mode: 'local-demo' };
}

export async function loadScenario(phase: Phase): Promise<Scenario> {
  try {
    const res = await fetch(`/api/public/scenarios?phase=${phase}`, {
      cache: 'no-store',
      credentials: 'include',
    });
    if (res.ok) {
      const data = (await res.json()) as { scenarios?: Scenario[]; items?: Scenario[] };
      const list = data.scenarios || data.items || [];
      if (list[0]?.options?.length) {
        return list[0];
      }
    }
  } catch {
    // Fallback to local scenarios
  }
  return FALLBACK[phase][0];
}

export async function sendEvents(
  session: SessionInfo,
  scenarioId: string,
  actions: GameAction[],
  selectedDecision?: string
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
      timestamp: new Date(now - 1200).toISOString(),
      schema_version: '1.0',
      type: 'HAZARD_VISIBLE',
      scenario_id: scenarioId,
      payload: { cue: 'pedestrian_crosswalk' },
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
        schema_version: '1.0',
        type: eventType,
        scenario_id: scenarioId,
        payload: { action: act },
      });
    }

    if (selectedDecision) {
      events.push({
        event_id: id(),
        session_id: session.sessionId,
        seq: seq++,
        timestamp: new Date(now).toISOString(),
        schema_version: '1.0',
        type: 'DECISION_INPUT',
        scenario_id: scenarioId,
        payload: { decision_id: selectedDecision },
      });
    }

    await fetch('/api/public/events/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        batch_id: id(),
        session_id: session.sessionId,
        events,
      }),
    });
  } catch {
    // Non-blocking telemetry
  }
}

export async function submitAttempt(
  session: SessionInfo,
  phase: Phase,
  scenario: Scenario,
  decision: string,
  reactionMs: number
): Promise<AttemptResult> {
  const isSafe = decision === scenario.options[0]?.id;

  if (session.mode === 'server') {
    try {
      const res = await fetch('/api/public/attempts/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          attempt_id: id(),
          scenario_id: scenario.scenario_id,
          selected_decision: decision,
          phase,
          reaction_ms: reactionMs,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          result?: { rule_score?: number; outcome?: string };
          rule_score?: number;
          outcome?: string;
        };
        const rule_score = data.result?.rule_score ?? data.rule_score ?? (isSafe ? 100 : 40);
        const outcome = data.result?.outcome ?? data.outcome ?? (isSafe ? 'SAFE' : 'HAZARDOUS');

        // Optional AI pedagogical explanation query
        let feedback: string | undefined;
        try {
          const aiRes = await fetch('/api/public/ai-feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              scenario_id: scenario.scenario_id,
              selected_decision: decision,
              outcome,
              rule_score,
            }),
          });
          if (aiRes.ok) {
            const aiData = (await aiRes.json()) as { error_explanation?: string; safety_principle?: string; suggested_practice?: string };
            feedback = aiData.safety_principle || aiData.error_explanation || aiData.suggested_practice;
          }
        } catch {
          // Fallback feedback
        }

        return {
          rule_score,
          outcome,
          feedback:
            feedback ||
            (isSafe
              ? 'Em đã xử lý an toàn: giảm tốc độ, nhường đường và giữ khoảng cách.'
              : 'Em cần quan sát kỹ hơn người đi bộ và điểm mù của xe lớn.'),
        };
      }
    } catch {
      // Fallback below
    }
  }

  return {
    rule_score: isSafe ? 100 : 40,
    outcome: isSafe ? 'SAFE' : 'NEEDS_PRACTICE',
    feedback: isSafe
      ? 'Em đã ưu tiên giảm tốc, giữ khoảng cách và nhường đường đúng lúc.'
      : 'Cần giảm tốc sớm hơn và quan sát kỹ người đi bộ cùng điểm mù phương tiện.',
  };
}