import type {
  GameplayAction,
  GameplayTraceEvent,
  ScenarioDefinition,
  ScenarioInteractionDecisionRule,
  ScenarioInteractionSpec,
  ScenarioVisualDecisionEffect,
  ScenarioVisualSpec,
} from '../types.ts';

export type InteractionResolution =
  | { status: 'RESOLVED'; option_id: string; matched_rule: number }
  | { status: 'INCOMPLETE'; reason: 'EMPTY_TRACE' | 'NO_MATCHING_RULE' };

function validateTrace(trace: GameplayTraceEvent[]): GameplayTraceEvent[] {
  return trace
    .filter(event => Number.isFinite(event.at_ms) && event.at_ms >= 0)
    .slice()
    .sort((left, right) => left.at_ms - right.at_ms);
}

function matches(rule: ScenarioInteractionDecisionRule, actions: Set<GameplayAction>): boolean {
  if (!rule.all_of.every(action => actions.has(action))) return false;
  if (rule.any_of?.length && !rule.any_of.some(action => actions.has(action))) return false;
  if (rule.none_of?.some(action => actions.has(action))) return false;
  return true;
}

const EFFECT_ACTIONS: Record<ScenarioVisualDecisionEffect['action'], GameplayAction[]> = {
  STOP: ['BRAKE', 'STOP'],
  BRAKE: ['BRAKE'],
  YIELD: ['YIELD'],
  SIGNAL: ['SIGNAL_LEFT', 'SIGNAL_RIGHT'],
  PROCEED: ['PROCEED'],
  ACCELERATE: ['ACCELERATE', 'PROCEED'],
  SWERVE: ['STEER_LEFT', 'STEER_RIGHT', 'LANE_CHANGE_LEFT', 'LANE_CHANGE_RIGHT'],
};

function ruleForEffect(optionId: string, effect: ScenarioVisualDecisionEffect): ScenarioInteractionDecisionRule {
  const actions = EFFECT_ACTIONS[effect.action];
  const isAlternativeAction = effect.action === 'SIGNAL' || effect.action === 'SWERVE';
  return {
    option_id: optionId,
    all_of: isAlternativeAction ? [] : actions,
    ...(isAlternativeAction ? { any_of: actions } : {}),
    priority: actions.length + (effect.outcome === 'CONFLICT' || effect.outcome === 'NEAR_MISS' ? 20 : 10),
  };
}

/** Build a deterministic interaction contract from semantic effects, never option position. */
export function deriveInteractionSpec(
  scenario: Pick<ScenarioDefinition, 'options' | 'visual_spec'>,
): ScenarioInteractionSpec {
  const optionIds = new Set(scenario.options.map(option => option.id));
  const effects = Object.entries(scenario.visual_spec.decision_effects)
    .filter(([optionId]) => optionIds.has(optionId));
  const decisionRules = effects.map(([optionId, effect]) => ruleForEffect(optionId, effect));
  const allowedActions = [...new Set(decisionRules.flatMap(rule => [
    ...rule.all_of,
    ...(rule.any_of ?? []),
  ]))];

  return {
    version: '1',
    allowed_actions: allowedActions,
    hazard_trigger: { distance_m: 18, visible_for_ms: 250 },
    completion: { max_duration_ms: 30_000, stop_speed_kmh: 1 },
    decision_rules: decisionRules,
  };
}

/** Resolve the observed interaction trace to a real scenario option id. */
export function resolveInteractionDecision(
  scenario: Pick<ScenarioDefinition, 'options' | 'interaction_spec'>,
  trace: GameplayTraceEvent[],
): InteractionResolution {
  const orderedTrace = validateTrace(trace);
  if (!orderedTrace.length) return { status: 'INCOMPLETE', reason: 'EMPTY_TRACE' };
  const spec = scenario.interaction_spec;
  if (!spec) return { status: 'INCOMPLETE', reason: 'NO_MATCHING_RULE' };

  const optionIds = new Set(scenario.options.map(option => option.id));
  const allowed = new Set(spec.allowed_actions);
  const actions = new Set(orderedTrace.filter(event => allowed.has(event.action)).map(event => event.action));
  const candidates = spec.decision_rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => optionIds.has(rule.option_id) && matches(rule, actions))
    .sort((left, right) =>
      (right.rule.priority ?? 0) - (left.rule.priority ?? 0)
      || right.rule.all_of.length - left.rule.all_of.length
      || left.index - right.index,
    );

  const winner = candidates[0];
  return winner
    ? { status: 'RESOLVED', option_id: winner.rule.option_id, matched_rule: winner.index }
    : { status: 'INCOMPLETE', reason: 'NO_MATCHING_RULE' };
}

export type PilotTerminalOutcome = 'SAFE_STOP' | 'SAFE_YIELD' | 'CONFLICT' | 'BLIND_ZONE_ENTRY';

/** Map a pilot runtime outcome to the scenario's real option id without using option order. */
export function resolvePilotOutcomeOption(
  options: Array<{ id: string }>,
  visualSpec: ScenarioVisualSpec | undefined,
  outcome: PilotTerminalOutcome,
): string | null {
  if (!visualSpec) return null;
  const optionIds = new Set(options.map(option => option.id));
  const effects = Object.entries(visualSpec.decision_effects).filter(([id]) => optionIds.has(id));
  let matches = effects.filter(([, effect]) => {
    if (outcome === 'SAFE_STOP') return ['STOP', 'BRAKE'].includes(effect.action) && ['SAFE_CLEARANCE', 'CONTROLLED_STOP'].includes(effect.outcome);
    if (outcome === 'SAFE_YIELD') return effect.action === 'YIELD' && ['SAFE_CLEARANCE', 'CONTROLLED_STOP'].includes(effect.outcome);
    if (outcome === 'CONFLICT') return effect.outcome === 'CONFLICT';
    return effect.outcome === 'NEAR_MISS';
  });
  if (!matches.length && outcome === 'BLIND_ZONE_ENTRY') {
    matches = effects.filter(([, effect]) => effect.outcome === 'CONFLICT');
  }
  if (!matches.length && (outcome === 'SAFE_STOP' || outcome === 'SAFE_YIELD')) {
    matches = effects.filter(([, effect]) => ['SAFE_CLEARANCE', 'CONTROLLED_STOP'].includes(effect.outcome));
  }
  return matches.length === 1 ? matches[0][0] : null;
}
