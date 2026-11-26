import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SEED_PLAYABLE_SCENARIOS } from '../../lib/rules/engine.ts';
import {
  describeScene3D,
  lightStateFor,
  npcVehiclesFor,
} from '../../components/world-3d.tsx';

const byId = (id: string) => {
  const scenario = SEED_PLAYABLE_SCENARIOS.find(s => s.scenario_id === id);
  assert.ok(scenario, `missing scenario ${id}`);
  return scenario;
};

const desc = (id: string, vehicleType: 'BIKE' | 'WALK' = 'BIKE') => {
  const s = byId(id);
  return describeScene3D(s.visual_spec, s.npc_element ?? '', s.trigger_event ?? '', vehicleType, 'sunny');
};

describe('3D-lite — mô tả cảnh thuần túy cho bộ vẽ Three.js', () => {
  it('SCN-117A: đèn đỏ + biển rẽ phải có điều kiện, xe tới vạch dừng', () => {
    const d = desc('SCN-117A');
    assert.equal(d.scene.archetype, 'INTERSECTION');
    assert.equal(d.light.draw, true);
    assert.equal(d.light.phase, 'RED');
    assert.equal(d.signText, 'RẼ PHẢI CÓ ĐIỀU KIỆN');
    assert.equal(d.light.dual, false);
  });

  it('SCN-102A: đèn người đi bộ đỏ + xe đỏ, người đi bộ qua vạch', () => {
    const d = desc('SCN-102A', 'WALK');
    assert.equal(d.light.draw, true);
    assert.equal(d.light.phase, 'GREEN');
    assert.equal(d.light.ped, 'red');
    assert.equal(d.pedestrian, true);
    assert.equal(d.crosswalk, true);
    assert.equal(d.isWalk, true);
  });

  it('SCN-803A: nhóm bạn chiếm vỉa hè, người đi bộ qua vạch', () => {
    const d = desc('SCN-803A', 'WALK');
    assert.equal(d.scene.archetype, 'PEDESTRIAN_CROSSING');
    assert.equal(d.pedestrian, true);
    assert.equal(d.crosswalk, true);
    assert.equal(d.isWalk, true);
  });

  it('SCN-503A: xe buýt ở vùng điểm mù (không phải xe tải)', () => {
    const d = desc('SCN-503A');
    assert.equal(d.scene.archetype, 'LARGE_VEHICLE_BLIND_SPOT');
    assert.ok(d.npcVehicles.some(v => v.kind === 'BUS'), 'phải vẽ xe buýt');
    assert.ok(!d.npcVehicles.some(v => v.kind === 'TRUCK'), 'không vẽ xe tải');
    assert.equal(d.blindSpot, true);
    assert.equal(d.blindLabel, 'VÙNG ĐIỂM MÙ XE BUÝT');
  });

  it('mọi case: đèn trong mô tả 3D khớp lightStateFor (không đèn chạy vòng)', () => {
    for (const s of SEED_PLAYABLE_SCENARIOS) {
      const d = describeScene3D(s.visual_spec, s.npc_element ?? '', s.trigger_event ?? '', 'BIKE', 'sunny');
      const expected = lightStateFor(s.visual_spec.traffic_control, s.visual_spec.dual_arrow_light);
      assert.deepEqual(d.light, expected, `${s.scenario_id}: đèn mô tả 3D lệch`);
    }
  });

  it('mọi case: mọi xe trong actors đều có mesh NPC tương ứng', () => {
    for (const s of SEED_PLAYABLE_SCENARIOS) {
      const d = describeScene3D(s.visual_spec, s.npc_element ?? '', s.trigger_event ?? '', 'BIKE', 'sunny');
      const kinds = d.npcVehicles.map(v => v.kind);
      const actors = s.visual_spec.actors;
      if (actors.includes('BUS')) assert.ok(kinds.includes('BUS'), `${s.scenario_id}: thiếu xe buýt`);
      if (actors.includes('TRUCK')) assert.ok(kinds.includes('TRUCK'), `${s.scenario_id}: thiếu xe tải`);
      if (actors.includes('EMERGENCY_VEHICLE')) assert.ok(kinds.includes('EMERGENCY'), `${s.scenario_id}: thiếu xe ưu tiên`);
      if (actors.includes('CAR') && s.visual_spec.scene_type !== 'EMERGENCY_VEHICLE') {
        assert.ok(kinds.includes('CAR'), `${s.scenario_id}: thiếu ô tô`);
      }
      assert.deepEqual(kinds, npcVehiclesFor(s.visual_spec, d.scene, s.npc_element ?? '').map(v => v.kind));
    }
  });

  it('vạch mờ chỉ SCN-109A, đèn 2 mũi tên chỉ SCN-104A', () => {
    const faded = SEED_PLAYABLE_SCENARIOS.filter(s => describeScene3D(s.visual_spec, '', '', 'BIKE', 'sunny').crosswalkFaded);
    assert.deepEqual(faded.map(s => s.scenario_id), ['SCN-109A']);
    const dual = SEED_PLAYABLE_SCENARIOS.filter(s => describeScene3D(s.visual_spec, '', '', 'BIKE', 'sunny').light.dual);
    assert.deepEqual(dual.map(s => s.scenario_id), ['SCN-104A']);
  });

  it('mưa chỉ khi kịch bản đang mưa thật; trời tối/đêm theo time_of_day', () => {
    for (const s of SEED_PLAYABLE_SCENARIOS) {
      const d = describeScene3D(s.visual_spec, '', '', 'BIKE', 'sunny');
      assert.equal(d.rain, s.visual_spec.raining === true, `${s.scenario_id}: rain lệch`);
      if (s.visual_spec.time_of_day === 'NIGHT') assert.equal(d.night, true);
      if (s.visual_spec.time_of_day === 'EVENING') assert.equal(d.evening, true);
      if (s.visual_spec.time_of_day === 'NIGHT') assert.equal(d.sky, '#0f172a');
      if (s.visual_spec.time_of_day === 'EVENING') assert.equal(d.sky, '#e07840');
    }
  });

  it('đi bộ: 30 case STUDENT_WALKER vẽ người đi bộ, không xe', () => {
    const walkers = SEED_PLAYABLE_SCENARIOS.filter(s => s.vehicle_group === 'PEDESTRIAN');
    assert.equal(walkers.length, 30);
    for (const s of walkers) {
      const d = describeScene3D(s.visual_spec, '', '', 'WALK', 'sunny');
      assert.equal(d.isWalk, true, `${s.scenario_id}: phải vẽ người đi bộ`);
    }
  });
});
