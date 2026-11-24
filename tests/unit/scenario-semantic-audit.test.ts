import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import seedRows from '../../data/scenarios.seed.json';
import { CANONICAL_SCENARIOS } from '../../lib/rules/engine.ts';
import { auditScenarioSeeds, classifyScenarioArchetype } from '../../lib/scenarios/semantic-audit.ts';

describe('scenario semantic audit', () => {
  it('inventories every seed scenario without structural blockers', () => {
    const report = auditScenarioSeeds(seedRows);

    assert.equal(report.scenario_count, seedRows.length);
    assert.equal(report.scenario_count, 160);
    assert.equal(report.severity_counts.BLOCKER, 0);
    assert.equal(Object.values(report.coverage).reduce((sum, count) => sum + count, 0), seedRows.length);
    assert.ok(Object.values(report.coverage).filter(count => count > 0).length >= 10);
  });

  it('audits all playable scenarios with complete generated visual metadata', () => {
    const report = auditScenarioSeeds(CANONICAL_SCENARIOS);

    assert.equal(report.scenario_count, 163);
    assert.equal(report.severity_counts.BLOCKER, 0);
    assert.equal(report.issues.filter(issue => issue.code === 'MISSING_VISUAL_SPEC').length, 0);
  });

  it('classifies representative hazards into distinct visual archetypes', () => {
    assert.equal(classifyScenarioArchetype({ scenario_title: 'Đèn đỏ', npc_element: 'TRAFFIC_LIGHT', trigger_condition: { event: 'red_light' } }), 'TRAFFIC_CONTROL');
    assert.equal(classifyScenarioArchetype({ scenario_title: 'Cửa ô tô mở bất ngờ', npc_element: 'FAMILY_CAR', trigger_condition: { event: 'car_door' } }), 'OPENING_DOOR');
    assert.equal(classifyScenarioArchetype({ scenario_title: 'Mưa lớn làm đường trơn', npc_element: 'FAMILY_CAR', trigger_condition: { event: 'heavy_rain', surface_state: 'wet' } }), 'WET_SLIPPERY_ROAD');
    assert.equal(classifyScenarioArchetype({ scenario_title: 'Xe cứu thương xin đường', npc_element: 'FAMILY_CAR', trigger_condition: { event: 'ambulance_priority' } }), 'EMERGENCY_VEHICLE');
  });

  it('flags contradictions and missing visual metadata without exposing narrative data', () => {
    const report = auditScenarioSeeds([{
      scenario_id: 'SCN-AUDIT',
      scenario_title: 'Đèn đỏ yêu cầu dừng',
      npc_element: 'TRAFFIC_LIGHT',
      correct_action: 'MAINTAIN_DISTANCE',
      trigger_condition: { event: 'red_light', time_of_day: 'morning', surface_state: 'dry' },
    }]);

    assert.equal(report.valid, true);
    assert.ok(report.issues.some(issue => issue.code === 'STOP_EVENT_ACTION_MISMATCH'));
    assert.ok(report.issues.some(issue => issue.code === 'MISSING_VISUAL_SPEC'));
    assert.deepEqual(Object.keys(report.issues[0]).sort(), ['code', 'message', 'scenario_id', 'severity']);
  });
});
