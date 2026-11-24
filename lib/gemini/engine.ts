import { externalProvidersAreDisabled } from '../runtime/local-acceptance.ts';
import { createHash, randomUUID } from 'node:crypto';
import { getScenario } from '../rules/engine.ts';
import { DomainError, noUnexpectedKeys, object } from '../validation/input.ts';
import type { AIAnalysisRecord, ScenarioDefinition } from '../types.ts';

export const PROMPT_VERSION = '2026.1-pedagogy-vi';

const FORBIDDEN_PII_KEYS = [
  'full_name',
  'name',
  'student_name',
  'school_name',
  'school',
  'class_name',
  'class',
  'province_city',
  'province',
  'email',
  'phone',
  'ip',
  'cookie',
  'token',
  'participant_id',
  'session_id',
] as const;

export interface WhitelistedAIInput {
  scenario_id: string;
  selected_decision: string;
  outcome: 'SAFE' | 'SUBOPTIMAL' | 'HAZARDOUS' | 'INVALID';
  rule_score: number;
  difficulty: 1 | 2 | 3;
  error_group: ScenarioDefinition['rubric']['error_group'];
}

export function sanitizeAIInput(raw: unknown): { sanitized: WhitelistedAIInput; scenario: ScenarioDefinition } {
  const input = object(raw);
  for (const forbidden of FORBIDDEN_PII_KEYS) {
    if (forbidden in input) {
      throw new DomainError(400, 'PII_REJECTED_BY_AI_GUARD', `PII or identifier field '${forbidden}' is strictly forbidden in AI payload`);
    }
  }
  noUnexpectedKeys(input, ['scenario_id', 'selected_decision', 'outcome', 'rule_score']);

  const scenario = getScenario(String(input.scenario_id ?? ''));
  const selected_decision = String(input.selected_decision ?? '').trim();
  if (!scenario.options.some(o => o.id === selected_decision)) {
    throw new DomainError(400, 'INVALID_DECISION_FOR_AI', 'Decision option does not belong to scenario');
  }

  const outcomeRaw = String(input.outcome ?? 'HAZARDOUS');
  const outcome = (['SAFE', 'SUBOPTIMAL', 'HAZARDOUS', 'INVALID'].includes(outcomeRaw) ? outcomeRaw : 'HAZARDOUS') as WhitelistedAIInput['outcome'];
  const rule_score = Math.max(0, Math.min(100, Number(input.rule_score) || 0));

  return {
    scenario,
    sanitized: {
      scenario_id: scenario.scenario_id,
      selected_decision,
      outcome,
      rule_score,
      difficulty: scenario.difficulty,
      error_group: scenario.rubric.error_group,
    },
  };
}

export function buildDeterministicFeedback(sanitized: WhitelistedAIInput, scenario: ScenarioDefinition, pseudonymousSeed = 'anon'): AIAnalysisRecord {
  const pseudonymous_ref = createHash('sha256').update(`${pseudonymousSeed}:${sanitized.scenario_id}:${sanitized.selected_decision}`).digest('hex').slice(0, 16);
  const isSafe = sanitized.outcome === 'SAFE';

  return {
    analysis_id: randomUUID(),
    pseudonymous_ref,
    scenario_id: sanitized.scenario_id,
    model_version: 'deterministic-rule-fallback-v1',
    prompt_version: PROMPT_VERSION,
    error_explanation: isSafe
      ? `Em đã chọn phương án xử lý an toàn. ${scenario.rubric.standard_explanation_vi}`
      : `Tình huống cần lưu ý nhóm rủi ro ${sanitized.error_group}: ${scenario.rubric.standard_explanation_vi}`,
    safety_principle: scenario.rubric.safety_principle_vi,
    suggested_practice: scenario.rubric.suggested_practice_vi,
    confidence_limitations: 'Phản hồi sư phạm xác định từ Rule Engine (không dùng điểm số AI cho kết quả chính thức; chỉ phục vụ học tập mô phỏng).',
    status: 'DETERMINISTIC_FALLBACK',
    created_at: new Date().toISOString(),
  };
}

export async function generatePedagogicalFeedback(
  rawInput: unknown,
  options?: { pseudonymousSeed?: string; fetchImpl?: typeof fetch },
): Promise<AIAnalysisRecord> {
  const { sanitized, scenario } = sanitizeAIInput(rawInput);
  const fallback = buildDeterministicFeedback(sanitized, scenario, options?.pseudonymousSeed);

  if (externalProvidersAreDisabled()) return fallback;
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
  if (!apiKey || !options?.fetchImpl && process.env.GEMINI_LIVE_ENABLED !== 'true') {
    return fallback;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const fetcher = options?.fetchImpl ?? fetch;
    const response = await fetcher(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: JSON.stringify({
                    instruction: 'Trả về JSON giải thích an toàn giao thông ngắn gọn bằng tiếng Việt cho học sinh.',
                    whitelisted_context: sanitized,
                  }),
                },
              ],
            },
          ],
        }),
      },
    );
    if (!response.ok) return fallback;
    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return fallback;
    const parsed = JSON.parse(text) as Partial<AIAnalysisRecord>;
    if (
      typeof parsed.error_explanation !== 'string' ||
      typeof parsed.safety_principle !== 'string' ||
      typeof parsed.suggested_practice !== 'string'
    ) {
      return fallback;
    }
    return {
      ...fallback,
      model_version: model,
      error_explanation: parsed.error_explanation.slice(0, 500),
      safety_principle: parsed.safety_principle.slice(0, 300),
      suggested_practice: parsed.suggested_practice.slice(0, 300),
      status: 'LIVE_GEMINI',
    };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}
