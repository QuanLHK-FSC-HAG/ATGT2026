import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SEED_PLAYABLE_SCENARIOS } from '../../lib/rules/engine.ts';
import {
  decisionEffect,
  drawsCrosswalk,
  lightStateFor,
  npcVehiclesFor,
  primaryNpcKind,
  resolveScene,
  roadColorFor,
  signLabel,
  skyColorFor,
} from '../../components/world-3d.tsx';

const byId = (id: string) => {
  const scenario = SEED_PLAYABLE_SCENARIOS.find(s => s.scenario_id === id);
  assert.ok(scenario, `missing scenario ${id}`);
  return scenario;
};

describe('3D fixes — visual spec theo bản rà soát 160 case', () => {
  it('suy màu đèn từ tiêu đề khi event thiếu từ khóa (L1)', () => {
    assert.equal(byId('SCN-117A').visual_spec.traffic_control, 'RED');
    assert.equal(byId('SCN-409A').visual_spec.traffic_control, 'RED');
    assert.equal(byId('SCN-119A').visual_spec.traffic_control, 'OFF');
    assert.equal(byId('SCN-401A').visual_spec.traffic_control, 'NONE');
    // Tiêu đề nhắc đèn mà không nêu màu thì mặc định đỏ (đèn đang chờ ở vạch dừng).
    assert.equal(byId('SCN-703A').visual_spec.traffic_control, 'RED');
    // 'đèn cảnh báo'/'đèn khẩn cấp' là đèn xe buýt, không phải đèn giao thông.
    assert.equal(byId('SCN-212A').visual_spec.traffic_control, 'NONE');
    assert.equal(byId('SCN-517A').visual_spec.traffic_control, 'NONE');
    // 'đèn pha'/'đèn phanh'/'đèn pin' cũng không phải đèn giao thông.
    assert.equal(byId('SCN-714A').visual_spec.traffic_control, 'NONE');
    assert.equal(byId('SCN-619A').visual_spec.traffic_control, 'NONE');
    assert.equal(byId('SCN-718A').visual_spec.traffic_control, 'NONE');
  });

  it('phân loại scene đúng các case từng sai (L1/L2/A1)', () => {
    assert.equal(byId('SCN-106A').visual_spec.scene_type, 'INTERSECTION_SIGNAL');
    assert.equal(byId('SCN-803A').visual_spec.scene_type, 'PEDESTRIAN_CROSSING');
    assert.equal(byId('SCN-413A').visual_spec.scene_type, 'INTERSECTION_SIGNAL');
    assert.equal(byId('SCN-120A').visual_spec.scene_type, 'OBSTACLE_CONSTRUCTION');
    assert.equal(byId('SCN-808A').visual_spec.scene_type, 'EMERGENCY_VEHICLE');
    assert.equal(byId('SCN-816A').visual_spec.scene_type, 'EMERGENCY_VEHICLE');
    assert.equal(byId('SCN-703A').visual_spec.scene_type, 'INTERSECTION_SIGNAL');
    assert.equal(byId('SCN-705A').visual_spec.scene_type, 'INTERSECTION_SIGNAL');
  });

  it('nhận diện xe ưu tiên và người điều tiết (N1/O1/A1)', () => {
    const ambulance = byId('SCN-801A').visual_spec;
    assert.ok(ambulance.actors.includes('EMERGENCY_VEHICLE'));
    assert.ok(byId('SCN-802A').visual_spec.actors.includes('EMERGENCY_VEHICLE'));
    assert.ok(byId('SCN-820A').visual_spec.actors.includes('EMERGENCY_VEHICLE'));
    // 'xe cảnh sát' là xe ưu tiên, không phải người điều tiết.
    const police = byId('SCN-808A').visual_spec;
    assert.ok(police.actors.includes('EMERGENCY_VEHICLE'));
    assert.ok(!police.actors.includes('TRAFFIC_OFFICER'));
    assert.ok(!police.actors.includes('CAR'));
    // Người điều tiết thật: cảnh sát giơ tay, tình nguyện viên, nhân viên điều tiết.
    assert.ok(byId('SCN-105A').visual_spec.actors.includes('TRAFFIC_OFFICER'));
    assert.ok(byId('SCN-220A').visual_spec.actors.includes('TRAFFIC_OFFICER'));
    assert.ok(byId('SCN-815A').visual_spec.actors.includes('TRAFFIC_OFFICER'));
    // 'đèn điều tiết' là đèn rẽ trái, không phải người điều tiết.
    assert.ok(!byId('SCN-119A').visual_spec.actors.includes('TRAFFIC_OFFICER'));
  });

  it('gắn biển báo, hướng rẽ, xi-nhan NPC và các cờ môi trường (S1/T1/R1/B1/F1/L5)', () => {
    assert.equal(byId('SCN-110A').visual_spec.sign, 'YIELD');
    assert.equal(byId('SCN-117A').visual_spec.sign, 'RIGHT_TURN');
    assert.equal(byId('SCN-108A').visual_spec.sign, 'NO_LEFT');
    assert.equal(byId('SCN-120A').visual_spec.sign, 'CONSTRUCTION');
    assert.equal(byId('SCN-401A').visual_spec.turn, 'RIGHT');
    assert.equal(byId('SCN-412A').visual_spec.turn, 'RIGHT');
    assert.equal(byId('SCN-117A').visual_spec.turn, 'RIGHT');
    assert.equal(byId('SCN-119A').visual_spec.turn, 'LEFT');
    assert.equal(byId('SCN-402A').visual_spec.npc_signal, 'LEFT');
    assert.equal(byId('SCN-404A').visual_spec.npc_signal, 'RIGHT');
    assert.equal(byId('SCN-507A').visual_spec.npc_signal, 'LEFT');
    assert.equal(byId('SCN-217A').visual_spec.npc_signal, 'RIGHT');
    assert.equal(byId('SCN-701A').visual_spec.raining, true);
    assert.equal(byId('SCN-705A').visual_spec.raining, false);
    assert.equal(byId('SCN-605A').visual_spec.raining, false);
    assert.equal(byId('SCN-611A').visual_spec.raining, false);
    assert.equal(byId('SCN-120A').visual_spec.at_school, false);
    assert.equal(byId('SCN-109A').visual_spec.crosswalk_faded, true);
    assert.equal(byId('SCN-104A').visual_spec.dual_arrow_light, true);
    assert.equal(byId('SCN-104A').visual_spec.traffic_control, 'RED');
  });

  it('resolveScene không vẽ xe ưu tiên thành nhập làn (lỗi chuỗi con emergency ⊃ merge)', () => {
    const police = byId('SCN-808A');
    const scene = resolveScene(police.visual_spec, police.npc_element ?? '', police.trigger_event ?? '');
    assert.equal(scene.archetype, 'EMERGENCY_VEHICLE');
    const convoy = byId('SCN-816A');
    assert.equal(resolveScene(convoy.visual_spec, convoy.npc_element ?? '', convoy.trigger_event ?? '').archetype, 'EMERGENCY_VEHICLE');
    assert.equal(primaryNpcKind('POLICE_CAR'), 'EMERGENCY');
    assert.equal(primaryNpcKind('FAMILY_CAR'), 'CAR');
  });

  it('vẽ NPC theo npc_element thay vì chỉ theo archetype (N2a/N3)', () => {
    // SCN-503A: NPC là xe buýt — trước đây luôn vẽ xe tải.
    const blind = byId('SCN-503A');
    const blindVehicles = npcVehiclesFor(blind.visual_spec, resolveScene(blind.visual_spec, blind.npc_element ?? '', blind.trigger_event ?? ''), blind.npc_element ?? '');
    assert.equal(blindVehicles[0]?.kind, 'BUS');
    // Cửa xe đưa đón mở: vẽ xe buýt, không phải ô tô.
    const door = byId('SCN-517A');
    const doorVehicles = npcVehiclesFor(door.visual_spec, resolveScene(door.visual_spec, door.npc_element ?? '', door.trigger_event ?? ''), door.npc_element ?? '');
    assert.equal(doorVehicles[0]?.kind, 'BUS');
    // Xe cứu thương phía sau: vẽ cả ô tô lẫn xe ưu tiên.
    const amb = byId('SCN-801A');
    const ambVehicles = npcVehiclesFor(amb.visual_spec, resolveScene(amb.visual_spec, amb.npc_element ?? '', amb.trigger_event ?? ''), amb.npc_element ?? '');
    assert.ok(ambVehicles.some(v => v.kind === 'CAR'));
    assert.ok(ambVehicles.some(v => v.kind === 'EMERGENCY'));
    // Đoàn xe ưu tiên: chỉ vẽ xe ưu tiên, không vẽ thêm ô tô hồng.
    const convoy = byId('SCN-816A');
    const convoyVehicles = npcVehiclesFor(convoy.visual_spec, resolveScene(convoy.visual_spec, convoy.npc_element ?? '', convoy.trigger_event ?? ''), convoy.npc_element ?? '');
    assert.ok(convoyVehicles.some(v => v.kind === 'EMERGENCY'));
    assert.ok(!convoyVehicles.some(v => v.kind === 'CAR'));
    // Xe buýt bật xi-nhan rời trạm mang tín hiệu LEFT.
    const bus = byId('SCN-507A');
    const busVehicles = npcVehiclesFor(bus.visual_spec, resolveScene(bus.visual_spec, bus.npc_element ?? '', bus.trigger_event ?? ''), bus.npc_element ?? '');
    assert.equal(busVehicles.find(v => v.kind === 'BUS')?.signal, 'LEFT');
  });

  it('lightStateFor: chỉ vẽ đèn khi có màu xác định, đèn người đi bộ riêng (L1/L2)', () => {
    assert.deepEqual(lightStateFor('RED'), { draw: true, phase: 'RED', ped: null, dual: false });
    assert.deepEqual(lightStateFor('NONE'), { draw: false, phase: 'RED', ped: null, dual: false });
    assert.deepEqual(lightStateFor('YIELD_SIGN'), { draw: false, phase: 'RED', ped: null, dual: false });
    assert.deepEqual(lightStateFor('PEDESTRIAN_GREEN'), { draw: true, phase: 'RED', ped: 'green', dual: false });
    assert.deepEqual(lightStateFor('PEDESTRIAN_RED'), { draw: true, phase: 'GREEN', ped: 'red', dual: false });
    assert.deepEqual(lightStateFor('OFF'), { draw: true, phase: 'OFF', ped: null, dual: false });
    assert.equal(lightStateFor('RED', true).dual, true);
  });

  it('decision_effects tra trúng bằng option.id (D1)', () => {
    for (const scenario of SEED_PLAYABLE_SCENARIOS) {
      for (const option of scenario.options) {
        const effect = decisionEffect(scenario.visual_spec, option.id);
        assert.notEqual(effect, option.id.toLowerCase(), `${scenario.scenario_id}:${option.id}`);
        assert.match(effect, /^(brake|stop|yield|signal|accelerate|swerve) /, `${scenario.scenario_id}:${option.id}`);
      }
    }
  });

  it('bầu trời, mặt đường, vạch qua đường và biển báo theo spec (E1/M1/F1/S1)', () => {
    assert.equal(skyColorFor({ time_of_day: 'NIGHT' } as never, 'sunny'), '#0f172a');
    assert.equal(skyColorFor({ time_of_day: 'EVENING' } as never, 'sunny'), '#e07840');
    assert.equal(skyColorFor({ time_of_day: 'MORNING' } as never, 'sunny'), '#38bdf8');
    assert.equal(roadColorFor({ surface: 'MUDDY' } as never, 'sunny'), '#6b4f2a');
    assert.equal(roadColorFor({ surface: 'WET' } as never, 'sunny'), '#435d6d');
    assert.equal(roadColorFor({ surface: 'DRY' } as never, 'sunny'), '#6C8EA6');
    assert.equal(drawsCrosswalk(byId('SCN-102A').visual_spec, 'PEDESTRIAN_CROSSING'), true);
    assert.equal(drawsCrosswalk({ actors: ['STUDENT', 'PEDESTRIAN'] } as never, 'BUS_STOP'), true);
    assert.equal(drawsCrosswalk({ actors: ['STUDENT'] } as never, 'BUS_STOP'), false);
    assert.equal(signLabel('YIELD'), 'NHƯỜNG ĐƯỜNG');
    assert.equal(signLabel('RIGHT_TURN'), 'RẼ PHẢI CÓ ĐIỀU KIỆN');
    assert.equal(signLabel(undefined), undefined);
  });
});
