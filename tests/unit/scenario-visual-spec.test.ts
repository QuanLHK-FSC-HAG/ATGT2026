import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildScenarioVisualSpec, CANONICAL_SCENARIOS, SEED_PLAYABLE_SCENARIOS, toPublicScenarioView } from '../../lib/rules/engine.ts';

describe('scenario visual contract', () => {
  it('classifies representative hazards into explicit scene archetypes', () => {
    const truck = buildScenarioVisualSpec({
      title_vi: 'Điểm mù xe tải rẽ phải',
      npc_element: 'TRUCK_HEAVY',
      trigger_event: 'blind_spot_right_turn',
      correct_action: 'SLOW_AND_STOP',
      option_ids: ['safe', 'rush'],
      safe_decisions: ['safe'],
    });
    assert.equal(truck.scene_type, 'LARGE_VEHICLE_BLIND_SPOT');
    assert.ok(truck.hazards.includes('BLIND_SPOT'));
    assert.ok(truck.actors.includes('TRUCK'));

    const railway = buildScenarioVisualSpec({
      title_vi: 'Thanh chắn đường sắt hạ xuống',
      trigger_event: 'rail_barrier',
      correct_action: 'STOP',
      option_ids: ['safe', 'rush'],
      safe_decisions: ['safe'],
    });
    assert.equal(railway.road_layout, 'RAIL_CROSSING');
    assert.equal(railway.traffic_control, 'RAIL_BARRIER');
    assert.ok(railway.actors.includes('TRAIN'));
  });

  it('gives every canonical scenario a complete visual contract and decision effects', () => {
    assert.ok(CANONICAL_SCENARIOS.length > 100);
    for (const scenario of CANONICAL_SCENARIOS) {
      const spec = scenario.visual_spec;
      assert.ok(spec.scene_type, scenario.scenario_id);
      assert.ok(spec.road_layout, scenario.scenario_id);
      assert.ok(spec.hazards.length > 0, scenario.scenario_id);
      assert.ok(spec.actors.includes('STUDENT'), scenario.scenario_id);
      assert.equal(Object.keys(spec.decision_effects).length, scenario.options.length, scenario.scenario_id);
      for (const option of scenario.options) assert.ok(spec.decision_effects[option.id], `${scenario.scenario_id}:${option.id}`);
    }
  });

  it('exposes visual metadata publicly without leaking the scoring rubric', () => {
    const publicView = toPublicScenarioView(CANONICAL_SCENARIOS[0]);
    assert.ok(publicView.visual_spec);
    assert.equal('rubric' in publicView, false);
  });

  it('keeps simulated schools anonymous without province or city labels', () => {
    for (const scenario of SEED_PLAYABLE_SCENARIOS) {
      assert.match(scenario.prompt_vi, /Trường THCS &amp; THPT [ABC]/, scenario.scenario_id);
      assert.doesNotMatch(scenario.prompt_vi, /\([^)]*(?:tỉnh|thành phố|TP\.?)[^)]*\)/i, scenario.scenario_id);
    }
  });
});
