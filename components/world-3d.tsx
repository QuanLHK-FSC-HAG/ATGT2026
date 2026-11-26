'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ScenarioVisualSpec } from '@/lib/types';

export type CameraMode = 'CINEMATIC_OVERVIEW' | 'FOLLOW_VEHICLE' | 'TOP_DOWN' | 'INTERSECTION';
export type VehicleType = 'BIKE' | 'E_BIKE' | 'E_SCOOTER' | 'MOTO_50CC' | 'WALK';

export type SceneArchetype =
  | 'STRAIGHT_ROAD'
  | 'INTERSECTION'
  | 'SCHOOL_GATE'
  | 'PEDESTRIAN_CROSSING'
  | 'OPENING_DOOR'
  | 'LARGE_VEHICLE_BLIND_SPOT'
  | 'BUS_STOP'
  | 'MERGE_LANE_CHANGE'
  | 'OVERTAKING'
  | 'RAILWAY_CROSSING'
  | 'ROUNDABOUT'
  | 'NARROW_ROAD'
  | 'LOW_VISIBILITY'
  | 'SLIPPERY_ROAD'
  | 'OBSTACLE_CONSTRUCTION'
  | 'EMERGENCY_VEHICLE';

export interface World3DProps {
  cameraMode?: CameraMode;
  vehicleType?: VehicleType;
  isDriving?: boolean;
  interactive?: boolean;
  weather?: 'sunny' | 'rain' | 'evening';
  hazardActive?: boolean;
  sceneKind?: string;
  sceneEvent?: string;
  correctAction?: string;
  selectedDecision?: string;
  visualSpec?: ScenarioVisualSpec;
}

const C = {
  grass: '#7ED957',
  grassDark: '#5CB85C',
  road: '#6C8EA6',
  roadDark: '#507082',
  line: '#FFFFFF',
  walk: '#D7E7F0',
  walkDark: '#B6CFDE',
  school: '#FFE0B2',
  schoolDark: '#FFCC80',
  roof: '#FF5A5F',
  window: '#7DD3FC',
  trunk: '#A1663B',
  leaf: '#4ADE80',
  player: '#3B82F6',
  playerDark: '#1D4ED8',
  truck: '#FFC542',
  truckDark: '#F59E0B',
  car: '#FF4D6D',
  carDark: '#C9184A',
  brake: '#FF2D55',
  signalOff: '#52606D',
  red: '#FF3B5C',
  yellow: '#FFD93D',
  green: '#4CD964',
  skin: '#FFD8A8',
  sky: '#7DD3FC',
};

type ResolvedScene = {
  archetype: SceneArchetype;
  hazards: Set<string>;
  actors: Set<string>;
  trafficControl: string;
  surface: string;
};

/** Ánh xạ trực tiếp spec.scene_type (do engine tính) sang archetype vẽ.
 * Trước đây resolveScene đoán archetype bằng regex trên chuỗi gộp — và vì
 * 'emergency' chứa chuỗi con 'merge' nên mọi cảnh xe ưu tiên đều vẽ thành
 * MERGE_LANE_CHANGE (ô tô hồng + mũi tên vàng). Chỉ khi không có spec
 * (màn chào) mới dùng heuristic cũ, với emergency kiểm tra TRƯỚC merge. */
const SPEC_ARCHETYPE: Record<string, SceneArchetype> = {
  INTERSECTION_SIGNAL: 'INTERSECTION',
  PEDESTRIAN_CROSSING: 'PEDESTRIAN_CROSSING',
  SCHOOL_GATE: 'SCHOOL_GATE',
  OPENING_DOOR: 'OPENING_DOOR',
  LARGE_VEHICLE_BLIND_SPOT: 'LARGE_VEHICLE_BLIND_SPOT',
  BUS_STOP: 'BUS_STOP',
  MERGE_LANE_CHANGE: 'MERGE_LANE_CHANGE',
  OVERTAKING: 'OVERTAKING',
  LOW_VISIBILITY: 'LOW_VISIBILITY',
  SLIPPERY_ROAD: 'SLIPPERY_ROAD',
  RAILWAY_CROSSING: 'RAILWAY_CROSSING',
  ROUNDABOUT: 'ROUNDABOUT',
  OBSTACLE_CONSTRUCTION: 'OBSTACLE_CONSTRUCTION',
  EMERGENCY_VEHICLE: 'EMERGENCY_VEHICLE',
  NARROW_ROAD: 'NARROW_ROAD',
};

export function resolveScene(spec: ScenarioVisualSpec | undefined, sceneKind: string, sceneEvent: string): ResolvedScene {
  if (spec?.scene_type && SPEC_ARCHETYPE[spec.scene_type]) {
    return {
      archetype: SPEC_ARCHETYPE[spec.scene_type],
      hazards: new Set((spec.hazards || []).map(value => value.toLowerCase())),
      actors: new Set((spec.actors || []).map(value => value.toLowerCase())),
      trafficControl: (spec.traffic_control || '').toLowerCase(),
      surface: (spec.surface || '').toLowerCase(),
    };
  }
  // Không có spec (màn chào): heuristic cũ, nhưng emergency trước merge.
  const raw = `${sceneKind} ${sceneEvent}`.toLowerCase();
  let archetype: SceneArchetype = 'STRAIGHT_ROAD';
  if (/rail|duong_sat|barrier/.test(raw)) archetype = 'RAILWAY_CROSSING';
  else if (/roundabout|vong_xuyen/.test(raw)) archetype = 'ROUNDABOUT';
  else if (/door|dooring|mo_cua/.test(raw)) archetype = 'OPENING_DOOR';
  else if (/truck|bus.*blind|blind|diem_mu|xe_tai/.test(raw)) archetype = 'LARGE_VEHICLE_BLIND_SPOT';
  else if (/bus_stop|tram_xe|bus_public/.test(raw)) archetype = 'BUS_STOP';
  else if (/emergency|priority|uu_tien/.test(raw)) archetype = 'EMERGENCY_VEHICLE';
  else if (/merge|lane_change|chuyen_lan|nhap_lan/.test(raw)) archetype = 'MERGE_LANE_CHANGE';
  else if (/overtak|vuot_xe|vuot_ben/.test(raw)) archetype = 'OVERTAKING';
  else if (/construction|obstacle|blocked|chuong_ngai/.test(raw)) archetype = 'OBSTACLE_CONSTRUCTION';
  else if (/low_visibility|fog|suong/.test(raw)) archetype = 'LOW_VISIBILITY';
  else if (/slippery|low_grip|wet|rain|tron/.test(raw)) archetype = 'SLIPPERY_ROAD';
  else if (/pedestrian|crosswalk|nguoi_di_bo|qua_duong/.test(raw)) archetype = 'PEDESTRIAN_CROSSING';
  else if (/intersection|traffic_light|giao_cat|nga_ba|nga_tu/.test(raw)) archetype = 'INTERSECTION';
  else if (/narrow|duong_hep|ngo_hep/.test(raw)) archetype = 'NARROW_ROAD';
  else if (/school|cong_truong/.test(raw)) archetype = 'SCHOOL_GATE';

  return {
    archetype,
    hazards: new Set(),
    actors: new Set(),
    trafficControl: (sceneEvent || '').toLowerCase(),
    surface: '',
  };
}

export function decisionEffect(spec: ScenarioVisualSpec | undefined, selectedDecision: string): string {
  const effect = spec?.decision_effects?.[selectedDecision];
  return effect ? `${effect.action} ${effect.outcome}`.toLowerCase() : selectedDecision.toLowerCase();
}

export type LightPhase = 'RED' | 'YELLOW' | 'GREEN' | 'OFF';
export interface LightState {
  /** Có vẽ cột đèn không. Không vẽ khi traffic_control là NONE/YIELD_SIGN/STOP_SIGN/OFFICER_STOP/RAIL_BARRIER. */
  draw: boolean;
  phase: LightPhase;
  /** Màu đèn người đi bộ (riêng), null khi không có đèn người đi bộ. */
  ped: 'red' | 'green' | null;
  /** Đèn 2 mũi tên (SCN-104A): xanh đi thẳng + đỏ rẽ trái, thay cho 3 đèn tròn. */
  dual: boolean;
}

/** Trạng thái đèn theo spec.traffic_control. Đèn người đi bộ và đèn xe là hai
 * đèn khác nhau: đèn người đi bộ xanh nghĩa là xe phải dừng (đỏ), đèn người
 * đi bộ đỏ nghĩa là xe được đi (xanh). Không còn chế độ đèn tự chạy vòng. */
export function lightStateFor(trafficControl: string | undefined, dualArrow?: boolean): LightState {
  const tc = (trafficControl || '').toUpperCase();
  switch (tc) {
    case 'RED': return { draw: true, phase: 'RED', ped: null, dual: Boolean(dualArrow) };
    case 'YELLOW': return { draw: true, phase: 'YELLOW', ped: null, dual: false };
    case 'GREEN': return { draw: true, phase: 'GREEN', ped: null, dual: false };
    case 'PEDESTRIAN_RED': return { draw: true, phase: 'GREEN', ped: 'red', dual: false };
    case 'PEDESTRIAN_GREEN': return { draw: true, phase: 'RED', ped: 'green', dual: false };
    case 'OFF': return { draw: true, phase: 'OFF', ped: null, dual: false };
    default: return { draw: false, phase: 'RED', ped: null, dual: false };
  }
}

export type NpcVehicleKind = 'BUS' | 'TRUCK' | 'CAR' | 'EMERGENCY';
export interface NpcVehicle {
  kind: NpcVehicleKind;
  x: number;
  z: number;
  signal?: 'LEFT' | 'RIGHT';
  /** Màu thân xe (mặc định theo loại xe). Dùng cho xe vượt màu teal. */
  color?: string;
}

const NPC_POSITION: Record<NpcVehicleKind, { x: number; z: number }> = {
  BUS: { x: 2.2, z: -3 },
  TRUCK: { x: -1.8, z: -2 },
  CAR: { x: 1.2, z: -3.5 },
  EMERGENCY: { x: -1.3, z: -4 },
};

/** NPC chính theo npc_element (sceneKind) — kiểm tra 'police' TRƯỚC 'car'
 * vì 'police_car' chứa 'car' (SCN-808A là xe cảnh sát, không phải ô tô thường). */
export function primaryNpcKind(sceneKind: string): NpcVehicleKind | undefined {
  const k = (sceneKind || '').toLowerCase();
  if (/bus/.test(k)) return 'BUS';
  if (/truck/.test(k)) return 'TRUCK';
  if (/police/.test(k)) return 'EMERGENCY';
  if (/car/.test(k)) return 'CAR';
  return undefined;
}

/** Danh sách xe NPC cần vẽ cho một cảnh, theo spec.actors (không chỉ theo
 * archetype): sửa nhóm N2a/N3 — xe buýt (8 case) và ô tô (17 case) từng vô hình
 * vì archetype không vẽ chúng. Xe chính mang spec.npc_signal (nếu có). */
export function npcVehiclesFor(spec: ScenarioVisualSpec | undefined, scene: ResolvedScene, sceneKind: string): NpcVehicle[] {
  if (!spec) return [];
  const actors = scene.actors;
  const archetype = scene.archetype;
  const primary = primaryNpcKind(sceneKind);
  const signal = spec.npc_signal;
  const out: NpcVehicle[] = [];
  const add = (kind: NpcVehicleKind, x?: number, z?: number, withSignal?: boolean, color?: string) => {
    const pos = NPC_POSITION[kind];
    out.push({ kind, x: x ?? pos.x, z: z ?? pos.z, signal: withSignal ? signal : undefined, color });
  };
  const hasVehicle = (k: 'bus' | 'truck' | 'car' | 'emergency_vehicle') => actors.has(k);
  // Xe theo archetype (xe chính của cảnh).
  if (archetype === 'LARGE_VEHICLE_BLIND_SPOT') {
    // Sửa SCN-503A: trước đây luôn vẽ xe tải trong khi NPC là xe buýt.
    const kind = hasVehicle('truck') ? 'TRUCK' : hasVehicle('bus') ? 'BUS' : 'CAR';
    add(kind, undefined, undefined, primary === kind);
  } else if (archetype === 'OPENING_DOOR') {
    // Cửa mở sát người chơi (z = 4); xe buýt nếu actors có BUS (SCN-517A/809A).
    const kind = hasVehicle('bus') ? 'BUS' : 'CAR';
    add(kind, 2.2, 4, primary === kind);
  } else if (archetype === 'BUS_STOP') {
    add('BUS', undefined, undefined, primary === 'BUS');
  } else if (archetype === 'MERGE_LANE_CHANGE') {
    add('CAR', undefined, undefined, primary === 'CAR');
  } else if (archetype === 'OVERTAKING') {
    add('CAR', -0.9, -2.8, primary === 'CAR', '#14b8a6');
    add('CAR', 0.9, -6.5);
  } else if (archetype === 'EMERGENCY_VEHICLE') {
    add('EMERGENCY', undefined, undefined, primary === 'EMERGENCY');
  }
  // Lớp bổ sung: mọi xe trong actors chưa được vẽ thì vẽ thêm (trừ xe con trong
  // cảnh xe ưu tiên — SCN-816A "đoàn xe ưu tiên" có npc FAMILY_CAR nhưng đoàn
  // xe toàn là xe ưu tiên, vẽ thêm ô tô hồng là sai nội dung).
  const drawn = new Set(out.map(v => v.kind));
  const extra: [string, NpcVehicleKind][] = [['bus', 'BUS'], ['truck', 'TRUCK'], ['car', 'CAR'], ['emergency_vehicle', 'EMERGENCY']];
  for (const [actor, kind] of extra) {
    if (actors.has(actor) && !drawn.has(kind)) {
      if (archetype === 'EMERGENCY_VEHICLE' && kind === 'CAR') continue;
      add(kind, undefined, undefined, primary === kind);
    }
  }
  return out;
}

/** Màu bầu trời theo time_of_day của kịch bản (E1): tối/đêm không còn trời xanh. */
export function skyColorFor(spec: ScenarioVisualSpec | undefined, weather: 'sunny' | 'rain' | 'evening'): string {
  const tod = spec?.time_of_day;
  if (tod === 'NIGHT') return '#0f172a';
  if (tod === 'EVENING') return '#e07840';
  if (weather === 'evening') return '#1f2937';
  if (weather === 'rain') return '#64748b';
  return '#38bdf8';
}

/** Màu mặt đường: bùn (M1), sỏi, ướt giữ '#435d6d'. */
export function roadColorFor(spec: ScenarioVisualSpec | undefined, weather: 'sunny' | 'rain' | 'evening'): string {
  const surface = (spec?.surface || '').toLowerCase();
  if (surface === 'muddy') return '#6b4f2a';
  if (surface === 'gravel') return '#8d8578';
  const isWet = weather === 'rain' || /wet/.test(surface);
  return isWet ? '#435d6d' : C.road;
}

/** Vạch qua đường vẽ cả khi actors có PEDESTRIAN (không chỉ archetype
 * PEDESTRIAN_CROSSING) — khớp với chỗ vẽ người đi bộ. */
export function drawsCrosswalk(spec: ScenarioVisualSpec | undefined, archetype: SceneArchetype): boolean {
  if (archetype === 'PEDESTRIAN_CROSSING') return true;
  return (spec?.actors || []).includes('PEDESTRIAN');
}

const SIGN_LABELS: Record<string, string> = {
  YIELD: 'NHƯỜNG ĐƯỜNG',
  NO_LEFT: 'CẤM RẼ TRÁI',
  MANDATORY: 'ĐI VÒNG',
  SPEED_LIMIT: 'GIỚI HẠN TỐC ĐỘ',
  ONE_WAY: 'MỘT CHIỀU',
  SPEED_HUMP: 'GỜ GIẢM TỐC',
  SCHOOL: 'KHU VỰC TRƯỜNG HỌC',
  CHILDREN: 'TRẺ EM',
  LANE_SPLIT: 'TÁCH LÀN',
  RIGHT_TURN: 'RẼ PHẢI CÓ ĐIỀU KIỆN',
  STOP: 'DỪNG',
  CONSTRUCTION: 'CÔNG TRƯỜNG',
};

/** Nhãn biển báo vẽ trên cột biển (S1). */
export function signLabel(sign: string | undefined): string | undefined {
  return sign ? SIGN_LABELS[sign] : undefined;
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

// ===========================================================================
// 3D-lite: mô tả cảnh thuần túy (không phụ thuộc Three.js) + bộ dựng Three.js
// ---------------------------------------------------------------------------
// Vì sao dùng three thuần thay vì @react-three/fiber: bộ vẽ cũ đã là code
// mệnh lệnh (imperative); three thuần giữ bundle nhẹ cho máy phòng máy và
// điện thoại học sinh, không thêm React reconciler, và tránh rủi ro tương
// thích phiên bản R3F với React/Next mới nhất. Toàn bộ hình khối low-poly
// tự vẽ bằng code, không dùng ảnh AI, không texture nặng.
// ===========================================================================

/** Mô tả cảnh 3D thuần túy (số/chuỗi/boolean) — để kiểm thử mà không cần
 * WebGL, và để bộ dựng Three.js chỉ việc dịch mô tả thành mesh. */
export interface Scene3DDescription {
  scene: ResolvedScene;
  light: LightState;
  npcVehicles: NpcVehicle[];
  crosswalk: boolean;
  /** Vạch qua đường đã mờ (SCN-109A, F1): vẽ xám nhạt thay vì trắng đặc. */
  crosswalkFaded: boolean;
  sky: string;
  road: string;
  signText?: string;
  schoolBuilding: boolean;
  atSchool: boolean;
  pedestrian: boolean;
  officer: boolean;
  blindSpot: boolean;
  blindLabel?: string;
  rain: boolean;
  fog: boolean;
  night: boolean;
  evening: boolean;
  isWalk: boolean;
  /** Chuỗi gộp sceneKind + sceneEvent (chữ thường) — dùng cho chi tiết biên
   * như gầm cầu vượt (LOW_VISIBILITY). */
  kind: string;
}

export function describeScene3D(
  spec: ScenarioVisualSpec | undefined,
  sceneKind: string,
  sceneEvent: string,
  vehicleType: VehicleType,
  weather: 'sunny' | 'rain' | 'evening',
): Scene3DDescription {
  const scene = resolveScene(spec, sceneKind, sceneEvent);
  const kind = `${sceneKind || ''} ${sceneEvent || ''}`.toLowerCase();
  const specWeather = spec?.weather === 'RAIN' ? 'rain' : spec?.weather === 'FOG' ? 'evening' : 'sunny';
  const activeWeather = spec ? specWeather : weather;
  const npcVehicles = npcVehiclesFor(spec, scene, sceneKind);
  const blind = scene.archetype === 'LARGE_VEHICLE_BLIND_SPOT' ? npcVehicles[0] : undefined;
  return {
    scene,
    light: lightStateFor(spec?.traffic_control, spec?.dual_arrow_light),
    npcVehicles,
    crosswalk: drawsCrosswalk(spec, scene.archetype),
    crosswalkFaded: spec?.crosswalk_faded === true,
    sky: skyColorFor(spec, activeWeather),
    road: roadColorFor(spec, activeWeather),
    signText: signLabel(spec?.sign),
    schoolBuilding: scene.archetype === 'SCHOOL_GATE' || /school|cong_truong/.test(kind),
    atSchool: spec?.at_school !== false,
    pedestrian: scene.archetype === 'PEDESTRIAN_CROSSING' || scene.actors.has('pedestrian'),
    officer: scene.actors.has('traffic_officer'),
    blindSpot: scene.archetype === 'LARGE_VEHICLE_BLIND_SPOT',
    blindLabel: blind
      ? blind.kind === 'BUS'
        ? 'VÙNG ĐIỂM MÙ XE BUÝT'
        : blind.kind === 'CAR'
          ? 'VÙNG ĐIỂM MÙ XE Ô TÔ'
          : 'VÙNG ĐIỂM MÙ XE TẢI'
      : undefined,
    // Mưa chỉ khi kịch bản đang mưa thật (spec.raining); đường ướt sau mưa
    // không vẽ mưa (R1).
    rain: activeWeather === 'rain' && (!spec || spec.raining === true),
    fog: spec?.weather === 'FOG' || scene.archetype === 'LOW_VISIBILITY',
    night: spec?.time_of_day === 'NIGHT',
    evening: spec?.time_of_day === 'EVENING',
    isWalk: vehicleType === 'WALK',
    kind,
  };
}

// --- Helpers dựng mesh (chỉ chạy trong trình duyệt, bên trong useEffect) ---

function std(color: string, opts?: { emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number }): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0,
    emissive: opts?.emissive ?? '#000000',
    emissiveIntensity: opts?.emissiveIntensity ?? 1,
    transparent: opts?.transparent ?? false,
    opacity: opts?.opacity ?? 1,
  });
}

function box(w: number, h: number, d: number, color: string, x: number, y: number, z: number, opts?: { emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number }): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(color, opts));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Texture chữ vẽ bằng canvas 2D (không phải ảnh AI) — dùng cho biển báo,
 * đèn người đi bộ, biển trường, vùng điểm mù, mũi tên đèn. Mặt phẳng quay
 * 45° để hướng về camera isometric (nhìn từ hướng +x/+z). */
function textTexture(text: string, opts?: { font?: string; color?: string; bg?: string; border?: string }): THREE.CanvasTexture {
  const font = opts?.font ?? '900 44px system-ui, sans-serif';
  const pad = 22;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D không khả dụng');
  ctx.font = font;
  const tw = Math.ceil(ctx.measureText(text).width);
  const th = 64;
  c.width = tw + pad * 2;
  c.height = th + pad * 2;
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas 2D không khả dụng');
  if (opts?.bg) {
    g.fillStyle = opts.bg;
    g.fillRect(0, 0, c.width, c.height);
  }
  if (opts?.border) {
    g.strokeStyle = opts.border;
    g.lineWidth = 6;
    g.strokeRect(3, 3, c.width - 6, c.height - 6);
  }
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = opts?.color ?? '#0f172a';
  g.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function textPlane(text: string, height: number, opts?: { font?: string; color?: string; bg?: string; border?: string }): THREE.Mesh {
  const tex = textTexture(text, opts);
  const img = tex.image as HTMLCanvasElement;
  const w = height * (img.width / img.height);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, height),
    new THREE.MeshBasicMaterial({ map: tex, transparent: !opts?.bg, side: THREE.DoubleSide }),
  );
  m.rotation.y = Math.PI / 4;
  return m;
}

type DynRefs = {
  blinkers: { mesh: THREE.Mesh; side: 'LEFT' | 'RIGHT'; owner: 'PLAYER' | 'NPC' }[];
  emergencyBars: { red: THREE.MeshStandardMaterial; blue: THREE.MeshStandardMaterial }[];
  brakeMats: THREE.MeshStandardMaterial[];
  pedestrian?: THREE.Group;
  rain?: THREE.Points;
  rainBase?: Float32Array;
  unsafeRing?: THREE.Mesh;
};

const GROUND_X = 12;
const GROUND_Z = 30;

function buildGround(desc: Scene3DDescription): THREE.InstancedMesh {
  const geo = new THREE.BoxGeometry(0.96, 0.3, 0.96);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  const count = (GROUND_X * 2 + 1) * (GROUND_Z * 2 + 1);
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let i = 0;
  for (let x = -GROUND_X; x <= GROUND_X; x++) {
    for (let z = -GROUND_Z; z <= GROUND_Z; z++) {
      const isIntersection = ['INTERSECTION', 'PEDESTRIAN_CROSSING', 'ROUNDABOUT'].includes(desc.scene.archetype);
      const isCrossRoad = isIntersection && z >= -2 && z <= 2;
      const roadHalfWidth = desc.scene.archetype === 'NARROW_ROAD' ? 1 : 2;
      const isRoad = (x >= -roadHalfWidth && x <= roadHalfWidth) || isCrossRoad;
      const isWalk = x === -3 || x === 3;
      const isCrosswalk = desc.crosswalk && z >= -1 && z <= 1 && Math.abs(x) <= 2;
      // Vạch mờ (F1): vạch màu xám nhạt thay vì trắng đặc.
      const crosswalkColor = desc.crosswalkFaded ? '#9aa5b1' : C.line;
      const top = isCrosswalk && x % 2 === 0 ? crosswalkColor : isRoad ? desc.road : isWalk ? C.walk : C.grass;
      dummy.position.set(x, -0.15, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.set(top));
      i++;
    }
  }
  mesh.count = i;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function buildMarkings(desc: Scene3DDescription): THREE.Group {
  const g = new THREE.Group();
  const white = std(C.line);
  const add = (w: number, d: number, x: number, z: number, color?: string) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), color ? std(color) : white);
    m.position.set(x, 0.02, z);
    m.receiveShadow = true;
    g.add(m);
  };
  // Vạch đứt giữa đường.
  for (let z = -GROUND_Z; z <= GROUND_Z; z += 2) add(0.14, 1, -0.07, z);
  // Vạch biên liền hai bên.
  add(0.1, GROUND_Z * 2, -2.2, 0);
  add(0.1, GROUND_Z * 2, 2.1, 0);
  // Vạch dừng trước ngã tư.
  for (let x = -2.1; x <= 2.1; x += 0.5) add(0.45, 0.28, x, -1.6);
  // Vạch qua đường: 3 dải (mờ → xám nhạt, F1).
  if (desc.crosswalk) {
    const stripeColor = desc.crosswalkFaded ? '#9aa5b1' : '#ffffff';
    for (const x of [-2, 0, 2]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.02, 2), std(stripeColor));
      m.position.set(x, 0.02, 0);
      m.receiveShadow = true;
      g.add(m);
    }
  }
  return g;
}

const VEHICLE_DIMS: Record<NpcVehicleKind, { w: number; h: number; d: number; top: string; dark: string }> = {
  BUS: { w: 2.2, h: 2.4, d: 4.8, top: '#22a6b3', dark: '#14727b' },
  TRUCK: { w: 2.2, h: 2.2, d: 4, top: C.truck, dark: C.truckDark },
  CAR: { w: 1.05, h: 0.9, d: 2.2, top: C.car, dark: C.carDark },
  EMERGENCY: { w: 1.8, h: 1.2, d: 3, top: '#f8fafc', dark: '#94a3b8' },
};

function buildVehicleMesh(v: NpcVehicle): { group: THREE.Group; blinkers: THREE.Mesh[]; bar?: { red: THREE.MeshStandardMaterial; blue: THREE.MeshStandardMaterial } } {
  const g = new THREE.Group();
  const blinkers: THREE.Mesh[] = [];
  let bar: { red: THREE.MeshStandardMaterial; blue: THREE.MeshStandardMaterial } | undefined;
  const dim = VEHICLE_DIMS[v.kind];
  const top = v.color ?? dim.top;
  const addWheel = (x: number, z: number) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.2, 12), std('#1f2937'));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.32, z);
    wheel.castShadow = true;
    g.add(wheel);
  };
  if (v.kind === 'TRUCK') {
    g.add(box(dim.w, dim.h, dim.d, top, 0, dim.h / 2, 0));
    g.add(box(2, 1.2, 2.2, shade(C.truck, 30), 0.1, 2.2 + 0.6, 0.4));
  } else if (v.kind === 'BUS') {
    g.add(box(dim.w, dim.h, dim.d, top, 0, dim.h / 2, 0));
    g.add(box(dim.w + 0.04, 0.7, dim.d * 0.7, '#bae6fd', 0, 1.7, 0));
  } else if (v.kind === 'EMERGENCY') {
    g.add(box(dim.w, dim.h, dim.d, top, 0, dim.h / 2, 0));
    g.add(box(dim.w * 0.8, 0.5, dim.d * 0.6, '#dbeafe', 0, dim.h + 0.1, 0));
    const red = std('#dc2626', { emissive: '#dc2626', emissiveIntensity: 1 });
    const blue = std('#2563eb', { emissive: '#2563eb', emissiveIntensity: 1 });
    const barRed = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.5), red);
    barRed.position.set(-0.25, dim.h + 0.45, 0.3);
    const barBlue = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.5), blue);
    barBlue.position.set(0.25, dim.h + 0.45, 0.3);
    g.add(barRed, barBlue);
    bar = { red, blue };
  } else {
    g.add(box(dim.w, dim.h, dim.d, top, 0, dim.h / 2, 0));
    g.add(box(dim.w * 0.85, 0.55, dim.d * 0.55, '#dbeafe', 0, dim.h + 0.2, 0));
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addWheel(sx * (dim.w / 2 - 0.05), sz * (dim.d / 2 - 0.45));
    }
  }
  // Xi-nhan NPC (T1): 2 chấm vàng cam ở phía hướng rẽ (trước + sau xe).
  if (v.signal) {
    const sideX = v.signal === 'LEFT' ? -dim.w / 2 : dim.w / 2;
    for (const z of [-dim.d / 2 + 0.1, dim.d / 2 - 0.1]) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), std('#f59e0b', { emissive: '#f59e0b', emissiveIntensity: 1.6 }));
      dot.position.set(sideX, 0.9, z);
      g.add(dot);
      blinkers.push(dot);
    }
  }
  g.position.set(v.x, 0, v.z);
  return { group: g, blinkers, bar };
}

function buildTrafficLight(desc: Scene3DDescription): THREE.Group {
  const g = new THREE.Group();
  const light = desc.light;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4, 10), std(C.signalOff));
  pole.position.set(3.4, 2, 1.5);
  pole.castShadow = true;
  g.add(pole);
  if (light.dual) {
    // Mũi tên ở mặt trước cột đèn (hướng +z, phía xe học sinh tới).
    const up = textPlane('↑', 0.9, { color: C.green, font: '900 60px system-ui, sans-serif' });
    up.position.set(3.55, 3.2, 1.85);
    const left = textPlane('←', 0.9, { color: C.red, font: '900 60px system-ui, sans-serif' });
    left.position.set(3.55, 2.2, 1.85);
    g.add(up, left);
  } else {
    const housing = box(0.9, 2.6, 0.6, '#111827', 3.4, 2.5, 1.5);
    g.add(housing);
    const phases: ['RED' | 'YELLOW' | 'GREEN', number][] = [['RED', 3.4], ['YELLOW', 2.5], ['GREEN', 1.6]];
    for (const [phase, y] of phases) {
      const on = light.phase === phase;
      const color = phase === 'RED' ? C.red : phase === 'YELLOW' ? C.yellow : C.green;
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 14, 14),
        std(on ? color : C.signalOff, on ? { emissive: color, emissiveIntensity: 2 } : undefined),
      );
      // Đèn ở mặt trước hộp đèn (z = 1.85) để xe tới từ hướng +z nhìn thấy.
      lamp.position.set(3.4, y, 1.85);
      g.add(lamp);
    }
  }
  // Đèn người đi bộ riêng ở cột đối diện (SCN-102A/308A).
  if (light.ped) {
    const pedPole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 2.2, 10), std(C.signalOff));
    pedPole.position.set(-3.4, 1.1, 1.5);
    pedPole.castShadow = true;
    g.add(pedPole);
    const sign = textPlane(light.ped === 'green' ? 'ĐI' : 'DỪNG', 0.7, {
      color: '#ffffff',
      bg: light.ped === 'green' ? C.green : C.red,
      font: '900 40px system-ui, sans-serif',
    });
    sign.position.set(-3.4, 2.6, 1.5);
    g.add(sign);
  }
  return g;
}

function buildPlayer(vehicleType: VehicleType): { group: THREE.Group; brakeMats: THREE.MeshStandardMaterial[]; blinkers: { left: THREE.Mesh[]; right: THREE.Mesh[] } } {
  const g = new THREE.Group();
  const brakeMats: THREE.MeshStandardMaterial[] = [];
  const blinkers: { left: THREE.Mesh[]; right: THREE.Mesh[] } = { left: [], right: [] };
  const isWalk = vehicleType === 'WALK';
  const addBlinker = (side: 'left' | 'right', x: number, z: number, y: number) => {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), std('#f59e0b', { emissive: '#f59e0b', emissiveIntensity: 1.6 }));
    dot.position.set(x, y, z);
    g.add(dot);
    blinkers[side].push(dot);
  };
  const addBrakeLight = (x: number, z: number) => {
    const m = std('#7f1d1d', { emissive: '#ff2d55', emissiveIntensity: 0.15 });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.06), m);
    lamp.position.set(x, 0.35, z);
    g.add(lamp);
    brakeMats.push(m);
  };
  if (!isWalk) {
    const dims = {
      BIKE: { w: 0.5, h: 0.28, d: 1.5 },
      E_BIKE: { w: 0.72, h: 0.48, d: 1.7 },
      E_SCOOTER: { w: 0.72, h: 0.48, d: 1.7 },
      MOTO_50CC: { w: 0.9, h: 0.48, d: 2 },
    }[vehicleType];
    if (vehicleType === 'BIKE') {
      for (const z of [-0.55, 0.55]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 16), std('#1f2937'));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(0, 0.34, z);
        wheel.castShadow = true;
        g.add(wheel);
      }
      g.add(box(0.08, 0.08, 1.1, C.player, 0, 0.55, 0));
    } else {
      g.add(box(dims.w, dims.h, dims.d, C.player, 0, dims.h / 2 + 0.1, 0));
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 12), std('#1f2937'));
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(sx * (dims.w / 2 - 0.05), 0.3, sz * (dims.d / 2 - 0.35));
          wheel.castShadow = true;
          g.add(wheel);
        }
      }
    }
    // Người lái: thân + đầu + mũ bảo hiểm.
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 10), std(shade(C.player, 45)));
    body.position.set(0, 1.05, 0.1);
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), std(C.skin));
    head.position.set(0, 1.62, 0.12);
    head.castShadow = true;
    g.add(head);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 14), std('#0284c7'));
    helmet.scale.set(1, 0.7, 1);
    helmet.position.set(0, 1.68, 0.12);
    helmet.castShadow = true;
    g.add(helmet);
    // Đèn phanh 2 ô đỏ ở đuôi xe + xi-nhan 2 bên.
    addBrakeLight(-dims.w / 2 + 0.1, dims.d / 2);
    addBrakeLight(dims.w / 2 - 0.1, dims.d / 2);
    addBlinker('left', -dims.w / 2, -dims.d / 2 + 0.1, 0.5);
    addBlinker('left', -dims.w / 2, dims.d / 2 - 0.1, 0.5);
    addBlinker('right', dims.w / 2, -dims.d / 2 + 0.1, 0.5);
    addBlinker('right', dims.w / 2, dims.d / 2 - 0.1, 0.5);
  } else {
    // Người đi bộ: thân áo xanh, đầu, không xe, không mũ bảo hiểm (W1).
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.6, 4, 10), std(C.player));
    body.position.set(0, 0.85, 0.1);
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), std(C.skin));
    head.position.set(0, 1.5, 0.12);
    head.castShadow = true;
    g.add(head);
  }
  return { group: g, brakeMats, blinkers };
}

function buildWorld(desc: Scene3DDescription, vehicleType: VehicleType, dyn: DynRefs): { group: THREE.Group; player: ReturnType<typeof buildPlayer> } {
  const g = new THREE.Group();
  g.add(buildGround(desc));
  g.add(buildMarkings(desc));

  // Tòa nhà (B1): chỉ mang biển TRƯỜNG A khi kịch bản ở khu vực trường.
  if (desc.schoolBuilding) {
    const wall = desc.atSchool ? C.school : '#e8dcc8';
    const roof = desc.atSchool ? C.roof : '#94a3b8';
    g.add(box(4, 5, 4, wall, -5.5, 2.5, -6));
    g.add(box(4, 0.6, 4, roof, -5.5, 5.3, -6));
    for (let i = 0; i < 3; i++) {
      g.add(box(0.7, 0.9, 0.15, C.window, -6.6 + i * 1.1, 3.5, -3.95));
    }
    if (desc.atSchool) {
      const sign = textPlane('TRƯỜNG A', 0.8, { color: '#854d0e', bg: '#fef08a', border: '#ca8a04', font: '900 40px system-ui, sans-serif' });
      sign.position.set(-5.5, 6.1, -4);
      g.add(sign);
    }
  }

  // Cây xanh ven đường.
  for (const [tx, tz] of [[-6, 6], [6, 10], [-6, 16], [6, -2]] as const) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 2, 8), std(C.trunk));
    trunk.position.set(tx, 1, tz);
    trunk.castShadow = true;
    g.add(trunk);
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 0), std(C.leaf));
    leaf.position.set(tx, 2.8, tz);
    leaf.castShadow = true;
    g.add(leaf);
  }

  // Đèn giao thông + đèn người đi bộ.
  if (desc.light.draw) g.add(buildTrafficLight(desc));

  // Xe NPC.
  for (const v of desc.npcVehicles) {
    const built = buildVehicleMesh(v);
    g.add(built.group);
    for (const b of built.blinkers) dyn.blinkers.push({ mesh: b, side: v.signal ?? 'RIGHT', owner: 'NPC' });
    if (built.bar) dyn.emergencyBars.push(built.bar);
  }

  // Vùng điểm mù (xe buýt/xe tải/ô tô): nền đỏ mờ + nhãn đặt TRƯỚC ĐẦU XE
  // (vùng học sinh sắp bước vào), không đặt dưới thân xe.
  if (desc.blindSpot && desc.blindLabel) {
    const blind = desc.npcVehicles[0];
    const dimD = blind ? VEHICLE_DIMS[blind.kind].d : 4;
    const zoneX = blind ? blind.x : 0.4;
    const zoneZ = blind ? blind.z + dimD / 2 + 1.1 : -2;
    const zone = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
    zone.rotation.x = -Math.PI / 2;
    zone.position.set(zoneX, 0.04, zoneZ);
    g.add(zone);
    const label = textPlane(`⚠ ${desc.blindLabel}`, 0.7, { color: '#dc2626', font: '900 40px system-ui, sans-serif' });
    label.position.set(zoneX, 0.9, zoneZ);
    g.add(label);
  }

  // Người đi bộ qua đường (đi lại ngang vạch).
  if (desc.pedestrian) {
    const p = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.55, 4, 10), std('#FF8A65'));
    body.position.set(0, 0.85, 0);
    body.castShadow = true;
    p.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 14), std(C.skin));
    head.position.set(0, 1.5, 0);
    head.castShadow = true;
    p.add(head);
    p.position.set(0, 0, 0.2);
    g.add(p);
    dyn.pedestrian = p;
  }

  // Người điều tiết giao thông (O1): thân cam + đầu + biển DỪNG đỏ.
  if (desc.officer) {
    const o = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.55, 4, 10), std('#f59e0b'));
    body.position.set(0, 0.85, 0);
    body.castShadow = true;
    o.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 14), std(C.skin));
    head.position.set(0, 1.5, 0);
    head.castShadow = true;
    o.add(head);
    const stop = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), std('#dc2626', { emissive: '#dc2626', emissiveIntensity: 0.3 }));
    stop.position.set(0.35, 1.6, 0);
    stop.rotation.y = Math.PI / 4;
    o.add(stop);
    const stopText = textPlane('DỪNG', 0.34, { color: '#ffffff', font: '900 40px system-ui, sans-serif' });
    stopText.position.set(0.35, 1.6, 0.02);
    o.add(stopText);
    o.position.set(1.6, 0, -0.5);
    g.add(o);
  }

  // Biển báo theo spec.sign (S1).
  if (desc.signText) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8), std('#475569'));
    pole.position.set(3.2, 1.1, -2);
    pole.castShadow = true;
    g.add(pole);
    const sign = textPlane(desc.signText, 0.62, { color: '#0f172a', bg: '#f8fafc', border: '#334155', font: '900 40px system-ui, sans-serif' });
    sign.position.set(3.2, 2.5, -2);
    g.add(sign);
  }

  // Chi tiết theo archetype.
  const a = desc.scene.archetype;
  if (a === 'OPENING_DOOR') {
    g.add(box(0.15, 1.3, 1.4, C.yellow, 1.2, 1.25, 4.3));
  }
  if (a === 'BUS_STOP') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 8), std('#475569'));
    pole.position.set(4.8, 1.5, -2);
    g.add(pole);
    g.add(box(1.5, 0.3, 0.8, '#f8fafc', 4.8, 2.9, -2));
  }
  if (a === 'MERGE_LANE_CHANGE') {
    for (let z = -8; z <= 5; z += 1.4) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.72), std(C.yellow));
      dash.position.set(1.05, 0.03, z);
      g.add(dash);
    }
    const arrow = textPlane('↗', 1.2, { color: '#fef08a', font: '900 70px system-ui, sans-serif' });
    arrow.position.set(0.9, 0.8, -1.2);
    g.add(arrow);
  }
  if (a === 'OVERTAKING') {
    const ring = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.04, -4.2);
    g.add(ring);
  }
  if (a === 'RAILWAY_CROSSING') {
    for (const z of [0.8, -0.8]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(10, 0.08, 0.16), std('#475569'));
      rail.position.set(0, 0.05, z);
      g.add(rail);
    }
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 3.4, 8), std('#e2e8f0'));
    post.position.set(-3, 1.7, 2);
    g.add(post);
    g.add(box(5, 0.18, 0.18, C.red, -0.5, 3.1, 2));
  }
  if (a === 'ROUNDABOUT') {
    const island = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.45, 20), std(C.grassDark));
    island.position.set(0, 0.22, 0);
    island.castShadow = true;
    island.receiveShadow = true;
    g.add(island);
    const center = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 16), std(C.walk));
    center.position.set(0, 0.6, 0);
    g.add(center);
  }
  if (a === 'OBSTACLE_CONSTRUCTION') {
    g.add(box(3, 0.7, 0.55, '#f97316', 0, 0.35, -1));
    for (const x of [-1.2, 0, 1.2]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.8, 10), std(C.yellow));
      cone.position.set(x, 1.1, -0.9);
      cone.castShadow = true;
      g.add(cone);
    }
  }
  if (a === 'LOW_VISIBILITY') {
    g.add(box(1.3, 0.95, 2.5, '#94a3b8', -0.65, 0.48, -4.8));
    if (/underpass|cau_vuot/.test(desc.kind)) {
      g.add(box(1.2, 5.5, 1.2, '#64748b', -5.5, 2.75, -7));
      g.add(box(1.2, 5.5, 1.2, '#64748b', 4.3, 2.75, -7));
      g.add(box(11, 0.8, 1.2, '#94a3b8', -0.6, 5.9, -7));
    }
  }

  // Vòng cảnh báo đỏ trên đầu xe HS khi lựa chọn gây xung đột (thay cho vòng
  // tròn canvas cũ) — ẩn/hiện theo từng khung hình.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.09, 8, 24),
    std('#ef4444', { emissive: '#ef4444', emissiveIntensity: 1.2 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.visible = false;
  g.add(ring);
  dyn.unsafeRing = ring;

  const player = buildPlayer(vehicleType);
  for (const b of player.blinkers.left) dyn.blinkers.push({ mesh: b, side: 'LEFT', owner: 'PLAYER' });
  for (const b of player.blinkers.right) dyn.blinkers.push({ mesh: b, side: 'RIGHT', owner: 'PLAYER' });
  dyn.brakeMats.push(...player.brakeMats);
  g.add(player.group);
  return { group: g, player };
}

export default function World3D({
  cameraMode = 'CINEMATIC_OVERVIEW',
  vehicleType = 'BIKE',
  isDriving = false,
  weather = 'sunny',
  hazardActive = false,
  sceneKind = '',
  sceneEvent = '',
  selectedDecision = '',
  visualSpec,
}: World3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const dataRef = useRef({
    cameraMode,
    vehicleType,
    isDriving,
    weather,
    hazardActive,
    playerX: 0,
    playerZ: 26,
    targetSpeed: 0,
    speed: 0,
    brake: false,
    // safeApproach: lựa chọn an toàn thì xe tiến tới dừng sát vạch (z = -1.6)
    // thay vì dừng chết tại chỗ — phản ứng nhìn thấy được.
    safeApproach: false,
    signal: 'OFF' as 'OFF' | 'LEFT' | 'RIGHT',
    signalTimer: 0,
    time: 0,
    sceneKind,
    sceneEvent,
    selectedDecision,
    visualSpec,
  });

  useEffect(() => {
    Object.assign(dataRef.current, {
      cameraMode,
      vehicleType,
      isDriving,
      weather,
      hazardActive,
      sceneKind,
      sceneEvent,
      selectedDecision,
      visualSpec,
    });
    const d = dataRef.current;
    const effect = decisionEffect(visualSpec, selectedDecision);
    // Người đi bộ di chuyển chậm hơn xe (tốc độ × 0.35).
    const speedScale = d.vehicleType === 'WALK' ? 0.35 : 1;
    if (!selectedDecision) {
      d.brake = false;
      d.targetSpeed = 0;
      d.safeApproach = false;
      d.signal = 'OFF';
    } else if (/brake|stop|yield|wait|slow|safe|keep_distance/.test(effect)) {
      // Lựa chọn an toàn: nếu chưa tới vạch dừng (z = -1.6) thì TIẾN TỚI vạch
      // rồi mới phanh dừng — học sinh nhìn thấy xe di chuyển và dừng đúng chỗ;
      // nếu đã qua vạch thì dừng tại chỗ. Xi-nhan giữ bật theo hướng rẽ
      // (cả khi đang rẽ thì dừng chờ — vd SCN-412A/117A/119A).
      d.signal = visualSpec?.turn ?? (effect.startsWith('signal') ? 'RIGHT' : 'OFF');
      if (d.playerZ > -1.4) {
        d.brake = false;
        d.safeApproach = true;
        d.targetSpeed = 6 * speedScale;
      } else {
        d.brake = true;
        d.safeApproach = false;
        d.targetSpeed = 0;
      }
    } else if (/rush|accelerate|speed|overtake|pass/.test(effect)) {
      d.brake = false;
      d.safeApproach = false;
      d.targetSpeed = 20 * speedScale;
      d.signal = 'OFF';
    } else {
      d.brake = false;
      d.safeApproach = false;
      d.targetSpeed = 8 * speedScale;
      d.signal = /left/.test(effect) ? 'LEFT' : /right|signal/.test(effect) ? 'RIGHT' : 'OFF';
    }
  }, [cameraMode, vehicleType, isDriving, weather, hazardActive, sceneKind, sceneEvent, selectedDecision, visualSpec]);

  // Badge phản xạ (DOM thay cho chữ vẽ trên canvas): tính thuần từ props,
  // nhưng màu xanh chỉ hiện khi xe ĐÃ phanh dừng thật (brakeLive đồng bộ
  // từ vòng lặp) — đang tiến tới vạch thì vẫn vàng "đang thực hiện".
  const badgeEffect = decisionEffect(visualSpec, selectedDecision);
  const badgeSafe = Boolean(selectedDecision) && /brake|stop|yield|wait|slow|safe|keep_distance/.test(badgeEffect);
  const badgeUnsafe = Boolean(selectedDecision) && /rush|accelerate|speed|overtake|pass|ignore|swerve|conflict|near_miss/.test(badgeEffect);
  const [brakeLive, setBrakeLive] = useState(false);
  const brakeLiveRef = useRef(false);
  const badgeBrake = badgeSafe && brakeLive;
  const badgeText = badgeBrake ? 'ĐÃ GIẢM TỐC / NHƯỜNG ĐƯỜNG' : badgeUnsafe ? 'NGUY CƠ XUNG ĐỘT TĂNG CAO' : 'ĐANG THỰC HIỆN LỰA CHỌN';
  const badgeBg = badgeBrake ? '#22c55e' : badgeUnsafe ? '#ef4444' : '#f59e0b';
  const desc = describeScene3D(visualSpec, sceneKind, sceneEvent, vehicleType, weather);
  const skyBg = desc.sky;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const d = dataRef.current;
    const sceneDesc = describeScene3D(d.visualSpec, d.sceneKind, d.sceneEvent, d.vehicleType, d.weather);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft đã bị gỡ từ three 0.187
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.setAttribute('aria-label', 'Mô phỏng giao thông 3D Isometric');
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(sceneDesc.sky);
    if (sceneDesc.fog) scene.fog = new THREE.Fog(sceneDesc.sky, 34, 72);

    // Ánh sáng: bán cầu + mặt trời có bóng đổ (bóng 1024, đủ nhẹ cho máy yếu).
    const hemi = new THREE.HemisphereLight(0xdfefff, 0x6b7c5e, sceneDesc.night ? 0.35 : sceneDesc.evening ? 0.8 : 1.0);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d9, sceneDesc.night ? 0.45 : sceneDesc.evening ? 0.9 : 1.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 90;
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    scene.add(sun.target);

    // Camera trực giao isometric — nhìn quen như bản 2.5D nhưng có chiều sâu.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    const zoomFor = (mode: CameraMode) => (mode === 'INTERSECTION' ? 1.25 : mode === 'CINEMATIC_OVERVIEW' ? 0.8 : mode === 'TOP_DOWN' ? 0.6 : 1);
    const applyFrustum = () => {
      const w = Math.max(320, container.clientWidth);
      const h = Math.max(260, container.clientHeight);
      const halfH = 12 / zoomFor(d.cameraMode);
      const aspect = w / h;
      camera.left = -halfH * aspect;
      camera.right = halfH * aspect;
      camera.top = halfH;
      camera.bottom = -halfH;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    applyFrustum();

    const dyn: DynRefs = { blinkers: [], emergencyBars: [], brakeMats: [] };
    const { group: world, player } = buildWorld(sceneDesc, d.vehicleType, dyn);
    scene.add(world);

    // Mưa (chỉ khi đang mưa thật): 300 hạt Points quanh camera.
    let rainGeo: THREE.BufferGeometry | undefined;
    if (sceneDesc.rain) {
      const count = 300;
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 40;
        pos[i * 3 + 1] = Math.random() * 14;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
      }
      rainGeo = new THREE.BufferGeometry();
      rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const rain = new THREE.Points(
        rainGeo,
        new THREE.PointsMaterial({ color: '#cfe8f5', size: 0.14, transparent: true, opacity: 0.55 }),
      );
      dyn.rain = rain;
      dyn.rainBase = pos;
      scene.add(rain);
    }

    const ro = new ResizeObserver(applyFrustum);
    ro.observe(container);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      d.time += dt;
      d.speed += (d.targetSpeed - d.speed) * 0.1;
      if (d.isDriving) d.playerZ -= d.speed * dt;
      // Lựa chọn an toàn: tới vạch dừng (z = -1.6) thì phanh dừng hẳn.
      if (d.safeApproach && d.playerZ <= -1.6) {
        d.targetSpeed = 0;
        d.brake = true;
        d.safeApproach = false;
      }
      if (d.playerZ < -24) d.playerZ = 24;
      if (d.signal !== 'OFF') d.signalTimer += dt;
      // Đồng bộ trạng thái phanh thật ra badge DOM (chỉ đổi khi thay đổi).
      if (d.brake !== brakeLiveRef.current) {
        brakeLiveRef.current = d.brake;
        setBrakeLive(d.brake);
      }

      player.group.position.set(d.playerX, 0, d.playerZ);

      // Camera bám xe (trừ màn chào nhìn toàn cảnh).
      const camX = d.cameraMode === 'CINEMATIC_OVERVIEW' ? 0 : d.playerX;
      const camZ = d.cameraMode === 'CINEMATIC_OVERVIEW' ? 0 : d.playerZ - 8;
      const target = new THREE.Vector3(camX, 0, camZ - 4);
      if (d.cameraMode === 'TOP_DOWN') {
        camera.position.set(camX + 0.1, 42, camZ - 3.9);
      } else {
        camera.position.set(camX + 17, 15, camZ + 13);
      }
      camera.lookAt(target);
      sun.position.set(target.x + 20, 28, target.z + 12);
      sun.target.position.copy(target);

      // Xi-nhan nhấp nháy (3Hz) — chỉ bên hướng rẽ đang bật.
      const blinkOn = Math.floor(d.time * 3) % 2 === 0;
      for (const b of dyn.blinkers) {
        const active = b.owner === 'PLAYER' ? b.side === d.signal : true;
        b.mesh.visible = active && blinkOn;
      }
      // Đèn chớp xe ưu tiên đỏ/xanh xen kẽ (5Hz).
      const flashRed = Math.floor(d.time * 5) % 2 === 0;
      for (const bar of dyn.emergencyBars) {
        bar.red.emissiveIntensity = flashRed ? 2.4 : 0.25;
        bar.blue.emissiveIntensity = flashRed ? 0.25 : 2.4;
      }
      // Đèn phanh sáng khi phanh.
      for (const m of dyn.brakeMats) m.emissiveIntensity = d.brake ? 2.2 : 0.15;
      // Người đi bộ qua đường đi ngang vạch.
      if (dyn.pedestrian) {
        const walk = (Math.sin(d.time * 2) + 1) / 2;
        dyn.pedestrian.position.x = -1.6 + walk * 3.2;
      }
      // Mưa rơi.
      if (dyn.rain && dyn.rainBase && rainGeo) {
        const attr = rainGeo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < attr.count; i++) {
          let y = attr.getY(i) - dt * 11;
          if (y < 0) y = 14;
          attr.setY(i, y);
          attr.setX(i, dyn.rainBase[i * 3] + d.time * 1.2);
        }
        attr.needsUpdate = true;
        dyn.rain.position.set(camX, 0, camZ);
      }
      // Vòng cảnh báo khi lựa chọn gây xung đột.
      if (dyn.unsafeRing) {
        const eff = decisionEffect(d.visualSpec, d.selectedDecision);
        const unsafe = Boolean(d.selectedDecision) && /rush|accelerate|speed|overtake|pass|ignore|swerve|conflict|near_miss/.test(eff);
        dyn.unsafeRing.visible = unsafe;
        if (unsafe) {
          const s = 1 + Math.sin(d.time * 7) * 0.12;
          dyn.unsafeRing.scale.set(s, s, s);
          dyn.unsafeRing.position.set(d.playerX, 2.4, d.playerZ - 0.4);
        }
      }
      // Lớp phủ tối ban đêm (E1) — mô phỏng bằng sương mù tối nhẹ.
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else if (material) material.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === container) container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraMode, vehicleType, weather, sceneKind, sceneEvent, visualSpec]);

  return (
    <div style={{ position: 'relative', width: '100%', flex: 1, minHeight: 420, background: skyBg, overflow: 'hidden', borderRadius: '22px' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {selectedDecision && (
        <div style={{ position: 'absolute', left: 12, top: 10, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(15, 23, 42, 0.8)', padding: '6px 12px 6px 6px', borderRadius: 999 }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: badgeBg, display: 'inline-block' }} />
          <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: 18, fontWeight: 900, color: '#fff' }}>{badgeText}</span>
        </div>
      )}
      <div style={{ position: 'absolute', left: 12, bottom: 12, fontFamily: 'system-ui, sans-serif', fontSize: 11, fontWeight: 800, color: '#f8fafc', background: 'rgba(15, 23, 42, 0.75)', padding: '5px 10px', borderRadius: 8 }}>
        MÔ PHỎNG 3D • ISOMETRIC
      </div>
    </div>
  );
}
