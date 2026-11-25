import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveInteractionDecision, resolvePilotOutcomeOption } from '../../lib/gameplay/interaction.ts';
import type { GameplayTraceEvent, ScenarioInteractionSpec, ScenarioVisualSpec } from '../../lib/types.ts';

const interaction_spec: ScenarioInteractionSpec = {
  version: '1',
  allowed_actions: ['MOVE_FORWARD', 'BRAKE', 'STOP', 'ACCELERATE', 'PROCEED'],
  hazard_trigger: { distance_m: 18 },
  completion: { max_duration_ms: 30_000, stop_speed_kmh: 1 },
  decision_rules: [
    { option_id: 'opt_stop', all_of: ['BRAKE', 'STOP'], none_of: ['PROCEED'], priority: 20 },
    { option_id: 'opt_brake_only', all_of: ['BRAKE'], priority: 10 },
    { option_id: 'opt_rush', all_of: ['ACCELERATE', 'PROCEED'], priority: 20 },
  ],
};

const scenario = {
  options: [
    { id: 'opt_rush', label_vi: 'Tăng tốc' },
    { id: 'opt_stop', label_vi: 'Dừng lại' },
    { id: 'opt_brake_only', label_vi: 'Giảm tốc' },
  ],
  interaction_spec,
};

describe('interaction decision contract', () => {
  it('resolves actions to the real option id without relying on option order', () => {
    const trace: GameplayTraceEvent[] = [
      { action: 'MOVE_FORWARD', at_ms: 0, speed_kmh: 12 },
      { action: 'BRAKE', at_ms: 900, distance_to_hazard_m: 8 },
      { action: 'STOP', at_ms: 1400, speed_kmh: 0 },
    ];
    assert.deepEqual(resolveInteractionDecision(scenario, trace), {
      status: 'RESOLVED',
      option_id: 'opt_stop',
      matched_rule: 0,
    });
  });

  it('uses priority and specificity when multiple rules match', () => {
    const trace: GameplayTraceEvent[] = [
      { action: 'STOP', at_ms: 1200 },
      { action: 'BRAKE', at_ms: 800 },
    ];
    assert.equal(resolveInteractionDecision(scenario, trace).status, 'RESOLVED');
    assert.equal((resolveInteractionDecision(scenario, trace) as { option_id: string }).option_id, 'opt_stop');
  });

  it('ignores invalid timestamps and reports an incomplete trace', () => {
    assert.deepEqual(resolveInteractionDecision(scenario, [{ action: 'BRAKE', at_ms: -1 }]), {
      status: 'INCOMPLETE',
      reason: 'EMPTY_TRACE',
    });
  });

  it('does not resolve actions excluded by a rule', () => {
    const trace: GameplayTraceEvent[] = [
      { action: 'BRAKE', at_ms: 500 },
      { action: 'STOP', at_ms: 900 },
      { action: 'PROCEED', at_ms: 1100 },
    ];
    assert.deepEqual(resolveInteractionDecision(scenario, trace), {
      status: 'RESOLVED',
      option_id: 'opt_brake_only',
      matched_rule: 1,
    });
  });

  it('fails closed when a scenario has no interaction contract', () => {
    assert.deepEqual(resolveInteractionDecision({ options: scenario.options }, [{ action: 'BRAKE', at_ms: 1 }]), {
      status: 'INCOMPLETE',
      reason: 'NO_MATCHING_RULE',
    });
  });
});

it('resolves pilot outcomes by visual semantics rather than option position', () => {
  const options = [{ id: 'rush' }, { id: 'wait' }, { id: 'swerve' }];
  const visualSpec: ScenarioVisualSpec = {
    scene_type: 'PEDESTRIAN_CROSSING', road_layout: 'STRAIGHT', hazards: ['CROSSING_PEDESTRIAN'], actors: ['STUDENT', 'PEDESTRIAN'],
    traffic_control: 'NONE', weather: 'SUNNY', surface: 'DRY', time_of_day: 'MORNING', camera: 'FOLLOW_VEHICLE',
    decision_effects: {
      rush: { action: 'ACCELERATE', outcome: 'CONFLICT' },
      wait: { action: 'STOP', outcome: 'CONTROLLED_STOP' },
      swerve: { action: 'SWERVE', outcome: 'NEAR_MISS' },
    },
  };
  assert.equal(resolvePilotOutcomeOption(options, visualSpec, 'SAFE_STOP'), 'wait');
  assert.equal(resolvePilotOutcomeOption(options, visualSpec, 'CONFLICT'), 'rush');
  assert.equal(resolvePilotOutcomeOption(options, visualSpec, 'BLIND_ZONE_ENTRY'), 'swerve');
});
