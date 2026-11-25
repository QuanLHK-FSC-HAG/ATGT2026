import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolvePilotOutcomeOption } from '../../lib/gameplay/interaction.ts';
import type { ScenarioVisualSpec } from '../../lib/types.ts';

function spec(
  scene_type: ScenarioVisualSpec['scene_type'],
  decision_effects: ScenarioVisualSpec['decision_effects'],
): ScenarioVisualSpec {
  return {
    scene_type,
    road_layout: scene_type === 'INTERSECTION_SIGNAL' ? 'CROSS_INTERSECTION' : 'STRAIGHT',
    hazards: scene_type === 'PEDESTRIAN_CROSSING'
      ? ['CROSSING_PEDESTRIAN']
      : scene_type === 'LARGE_VEHICLE_BLIND_SPOT'
        ? ['BLIND_SPOT']
        : ['SIGNAL_CONFLICT'],
    actors: scene_type === 'PEDESTRIAN_CROSSING'
      ? ['STUDENT', 'PEDESTRIAN']
      : scene_type === 'LARGE_VEHICLE_BLIND_SPOT'
        ? ['STUDENT', 'TRUCK']
        : ['STUDENT', 'CAR'],
    traffic_control: scene_type === 'INTERSECTION_SIGNAL' ? 'RED' : 'NONE',
    weather: 'SUNNY',
    surface: 'DRY',
    time_of_day: 'MORNING',
    camera: 'FOLLOW_VEHICLE',
    decision_effects,
  };
}

describe('pilot terminal outcome mapping', () => {
  it('maps a pedestrian safe stop to the real safe option after option order is shuffled', () => {
    const options = [{ id: 'opt_swerve' }, { id: 'opt_rush' }, { id: 'opt_stop' }];
    const visual = spec('PEDESTRIAN_CROSSING', {
      opt_rush: { action: 'ACCELERATE', outcome: 'CONFLICT' },
      opt_stop: { action: 'STOP', outcome: 'CONTROLLED_STOP' },
      opt_swerve: { action: 'SWERVE', outcome: 'NEAR_MISS' },
    });
    assert.equal(resolvePilotOutcomeOption(options, visual, 'SAFE_STOP'), 'opt_stop');
    assert.equal(resolvePilotOutcomeOption(options, visual, 'CONFLICT'), 'opt_rush');
  });

  it('uses the unique safe semantic fallback for an intersection yield', () => {
    const options = [{ id: 'opt_cross' }, { id: 'opt_wait' }, { id: 'opt_dodge' }];
    const visual = spec('INTERSECTION_SIGNAL', {
      opt_cross: { action: 'ACCELERATE', outcome: 'CONFLICT' },
      opt_wait: { action: 'BRAKE', outcome: 'SAFE_CLEARANCE' },
      opt_dodge: { action: 'SWERVE', outcome: 'NEAR_MISS' },
    });
    assert.equal(resolvePilotOutcomeOption(options, visual, 'SAFE_YIELD'), 'opt_wait');
  });

  it('maps blind-zone entry to near miss before falling back to conflict', () => {
    const options = [{ id: 'opt_pass' }, { id: 'opt_hold' }, { id: 'opt_blind' }];
    const visual = spec('LARGE_VEHICLE_BLIND_SPOT', {
      opt_hold: { action: 'YIELD', outcome: 'SAFE_CLEARANCE' },
      opt_pass: { action: 'ACCELERATE', outcome: 'CONFLICT' },
      opt_blind: { action: 'SWERVE', outcome: 'NEAR_MISS' },
    });
    assert.equal(resolvePilotOutcomeOption(options, visual, 'BLIND_ZONE_ENTRY'), 'opt_blind');
  });

  it('fails closed when multiple options share the same terminal semantic', () => {
    const options = [{ id: 'opt_a' }, { id: 'opt_b' }];
    const visual = spec('LARGE_VEHICLE_BLIND_SPOT', {
      opt_a: { action: 'SWERVE', outcome: 'NEAR_MISS' },
      opt_b: { action: 'SWERVE', outcome: 'NEAR_MISS' },
    });
    assert.equal(resolvePilotOutcomeOption(options, visual, 'BLIND_ZONE_ENTRY'), null);
  });
});
