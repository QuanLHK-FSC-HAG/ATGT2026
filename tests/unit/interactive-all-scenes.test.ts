import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deriveInteractionSpec, resolveInteractionDecision } from '../../lib/gameplay/interaction.ts';
import { CANONICAL_SCENARIOS, toPublicScenarioView } from '../../lib/rules/engine.ts';
import type { GameplayAction, ScenarioVisualDecisionEffect } from '../../lib/types.ts';

const publicScenarios = CANONICAL_SCENARIOS.filter(scenario =>
  scenario.scenario_id.startsWith('SCN-') && scenario.approved,
);

const SAFE_OUTCOMES = new Set(['SAFE_CLEARANCE', 'CONTROLLED_STOP']);
const UNSAFE_OUTCOMES = new Set(['CONFLICT', 'NEAR_MISS']);

function traceFor(effect: ScenarioVisualDecisionEffect) {
  const actions: Record<ScenarioVisualDecisionEffect['action'], GameplayAction[]> = {
    STOP: ['BRAKE', 'STOP'],
    BRAKE: ['BRAKE'],
    YIELD: ['YIELD'],
    SIGNAL: ['SIGNAL_LEFT'],
    PROCEED: ['PROCEED'],
    ACCELERATE: ['ACCELERATE', 'PROCEED'],
    SWERVE: ['STEER_LEFT'],
  };
  return actions[effect.action].map((action, index) => ({ action, at_ms: index * 100 + 1 }));
}

describe('full public interaction coverage', () => {
  it('publishes all 160 scenarios across all 14 populated scene groups', () => {
    assert.equal(publicScenarios.length, 160);
    assert.equal(new Set(publicScenarios.map(scenario => scenario.visual_spec.scene_type)).size, 14);
    assert.ok(publicScenarios.every(scenario => toPublicScenarioView(scenario).interaction_spec));
  });

  it('provides at least one safe and one unsafe semantic path for every scenario', () => {
    for (const scenario of publicScenarios) {
      const effects = Object.values(scenario.visual_spec.decision_effects);
      assert.ok(effects.some(effect => SAFE_OUTCOMES.has(effect.outcome)), `${scenario.scenario_id}: safe path`);
      assert.ok(effects.some(effect => UNSAFE_OUTCOMES.has(effect.outcome)), `${scenario.scenario_id}: unsafe path`);
    }
  });

  it('resolves every visual effect to its actual option id independent of option order', () => {
    for (const scenario of publicScenarios) {
      const shuffled = { ...scenario, options: [...scenario.options].reverse() };
      shuffled.interaction_spec = deriveInteractionSpec(shuffled);
      for (const option of shuffled.options) {
        const effect = shuffled.visual_spec.decision_effects[option.id];
        const resolved = resolveInteractionDecision(shuffled, traceFor(effect));
        assert.equal(resolved.status, 'RESOLVED', `${scenario.scenario_id}:${option.id}`);
        if (resolved.status === 'RESOLVED') {
          assert.equal(resolved.option_id, option.id, `${scenario.scenario_id}:${option.id}`);
        }
      }
    }
  });
});
