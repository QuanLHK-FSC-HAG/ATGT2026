'use client';

import React, { useEffect, useRef } from 'react';
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

type Projector = (x: number, y: number, z: number) => { x: number; y: number };

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

function block(
  ctx: CanvasRenderingContext2D,
  p: Projector,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  top: string,
  left: string,
  right: string,
) {
  const a = p(x, y + h, z);
  const b = p(x + w, y + h, z);
  const c = p(x + w, y + h, z + d);
  const d0 = p(x, y + h, z + d);
  const aB = p(x, y, z);
  const cB = p(x + w, y, z + d);

  ctx.fillStyle = left;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(d0.x, d0.y);
  ctx.lineTo(cB.x, cB.y);
  ctx.lineTo(aB.x, aB.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = right;
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(cB.x, cB.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d0.x, d0.y);
  ctx.closePath();
  ctx.fill();
}

/** Vẽ một xe NPC (xe buýt xanh teal, xe tải vàng, ô tô hồng, xe ưu tiên trắng
 * + đèn chớp đỏ/xanh). Xi-nhan (T1): 2 chấm vàng cam nhấp nháy ở phía hướng
 * rẽ (trước + sau xe). */
function drawVehicle(
  ctx: CanvasRenderingContext2D,
  project: Projector,
  time: number,
  v: NpcVehicle,
) {
  const dims: Record<NpcVehicleKind, { w: number; h: number; d: number; top: string; dark: string }> = {
    BUS: { w: 2.2, h: 2.4, d: 4.8, top: '#22a6b3', dark: '#14727b' },
    TRUCK: { w: 2.2, h: 2.2, d: 4, top: C.truck, dark: C.truckDark },
    CAR: { w: 1.05, h: 0.9, d: 2.2, top: C.car, dark: C.carDark },
    EMERGENCY: { w: 1.8, h: 1.2, d: 3, top: '#f8fafc', dark: '#94a3b8' },
  };
  const dim = dims[v.kind];
  const top = v.color ?? dim.top;
  if (v.kind === 'TRUCK') {
    block(ctx, project, v.x, 0, v.z, dim.w, dim.h, dim.d, top, shade(top, -55), shade(top, -25));
    block(ctx, project, v.x + 0.1, 2.2, v.z + 0.4, 2, 1.2, 2.2, shade(C.truck, 30), C.truckDark, C.truckDark);
  } else if (v.kind === 'BUS') {
    block(ctx, project, v.x, 0, v.z, dim.w, dim.h, dim.d, top, '#14727b', '#1b8792');
  } else if (v.kind === 'EMERGENCY') {
    block(ctx, project, v.x, 0, v.z, dim.w, dim.h, dim.d, top, '#94a3b8', '#cbd5e1');
    const flash = Math.floor(time * 5) % 2 === 0 ? C.red : C.player;
    block(ctx, project, v.x + 0.5, 1.2, v.z + 0.6, 0.8, 0.25, 0.5, flash, shade(flash, -40), shade(flash, -20));
  } else {
    block(ctx, project, v.x, 0, v.z, dim.w, dim.h, dim.d, top, shade(top, -45), shade(top, -20));
  }
  if (v.signal && Math.floor(time * 3) % 2 === 0) {
    const sideX = v.signal === 'LEFT' ? v.x - 0.1 : v.x + dim.w - 0.1;
    const sigF = project(sideX, 0.9, v.z - 0.2);
    const sigB = project(sideX, 0.9, v.z + dim.d - 0.2);
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(sigF.x, sigF.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sigB.x, sigB.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let raf = 0;
    let last = 0;

    const frame = (now: number) => {
      if (now - last < 33) return; // 30fps smooth target
      last = now;

      const d = dataRef.current;
      const scene = resolveScene(d.visualSpec, d.sceneKind, d.sceneEvent);
      const kind = `${d.sceneKind || ''} ${d.sceneEvent || ''}`.toLowerCase();
      const specWeather = d.visualSpec?.weather === 'RAIN' ? 'rain' : d.visualSpec?.weather === 'FOG' ? 'evening' : 'sunny';
      const activeWeather = d.visualSpec ? specWeather : d.weather;
      const dt = 0.05;
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

      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(260, Math.floor(rect.height));
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // TOP_DOWN thật sự khác FOLLOW_VEHICLE: zoom 0.6 nhìn từ trên cao.
      const zoom = d.cameraMode === 'INTERSECTION' ? 1.25 : d.cameraMode === 'CINEMATIC_OVERVIEW' ? 0.8 : d.cameraMode === 'TOP_DOWN' ? 0.6 : 1;
      const tile = 34 * zoom;
      const camX = d.cameraMode === 'CINEMATIC_OVERVIEW' ? 0 : d.playerX;
      const camZ = d.cameraMode === 'CINEMATIC_OVERVIEW' ? 0 : d.playerZ - 8;
      const project: Projector = (x, y, z) => ({
        x: w / 2 + (x - camX) * tile * 0.72 - (z - camZ) * tile * 0.14,
        y: h * 0.60 + (z - camZ) * tile * 0.32 - y * tile * 0.48,
      });

      // Bầu trời 2.5D theo thời điểm trong kịch bản (E1: tối/đêm không còn trời xanh).
      ctx.fillStyle = skyColorFor(d.visualSpec, activeWeather);
      ctx.fillRect(0, 0, w, h);

      // Mặt đất 2.5D Isometric
      for (let x = -12; x <= 12; x++) {
        for (let z = Math.floor(camZ) - 18; z <= Math.floor(camZ) + 24; z++) {
          const isIntersection = ['INTERSECTION', 'PEDESTRIAN_CROSSING', 'ROUNDABOUT'].includes(scene.archetype);
          const isCrossRoad = isIntersection && z >= -2 && z <= 2;
          const roadHalfWidth = scene.archetype === 'NARROW_ROAD' ? 1 : 2;
          const isRoad = (x >= -roadHalfWidth && x <= roadHalfWidth) || isCrossRoad;
          const isWalk = x === -3 || x === 3;
          const isCrosswalk = drawsCrosswalk(d.visualSpec, scene.archetype) && z >= -1 && z <= 1 && Math.abs(x) <= 2;
          // Vạch mờ (F1): vạch màu xám nhạt thay vì trắng đặc.
          const crosswalkColor = d.visualSpec?.crosswalk_faded ? '#9aa5b1' : C.line;
          const roadColor = roadColorFor(d.visualSpec, activeWeather);
          const top = isCrosswalk && x % 2 === 0 ? crosswalkColor : isRoad ? roadColor : isWalk ? C.walk : C.grass;
          const left = shade(top, -26);
          const right = shade(top, -12);
          block(ctx, project, x, -0.35, z, 0.96, 0.32, 0.96, top, left, right);
        }
      }

      // Vạch sơn đường & vạch dừng
      for (let z = Math.floor(camZ) - 18; z <= Math.floor(camZ) + 24; z += 2) {
        block(ctx, project, -0.07, -0.01, z, 0.14, 0.02, 1, C.line, shade(C.line, -20), shade(C.line, -10));
      }
      for (const edge of [-2.2, 2.1]) {
        for (let z = Math.floor(camZ) - 18; z <= Math.floor(camZ) + 24; z++) {
          block(ctx, project, edge, -0.01, z, 0.1, 0.02, 0.98, C.line, shade(C.line, -20), shade(C.line, -10));
        }
      }
      for (let x = -2.1; x <= 2.1; x += 0.5) {
        block(ctx, project, x, -0.01, -1.6, 0.45, 0.02, 0.28, C.line, shade(C.line, -20), shade(C.line, -10));
      }

      // Tòa nhà trường chỉ mang biển TRƯỜNG A khi kịch bản ở khu vực trường
      // (B1: 10/12 case không ở trường thì vẽ tòa nhà chung chung, không biển).
      if (scene.archetype === 'SCHOOL_GATE' || /school|cong_truong/.test(kind)) {
        const atSchool = d.visualSpec?.at_school !== false;
        const wall = atSchool ? C.school : '#e8dcc8';
        const roof = atSchool ? C.roof : '#94a3b8';
        block(ctx, project, -7.5, 0, -8, 4, 5, 4, wall, shade(wall, -40), shade(wall, -20));
        block(ctx, project, -7.5, 5, -8, 4, 0.6, 4, roof, shade(roof, -40), shade(roof, -20));
        for (let i = 0; i < 3; i++) {
          block(ctx, project, -7.1 + i * 1.1, 2, -7.5, 0.7, 0.9, 0.15, C.window, shade(C.window, -40), shade(C.window, -20));
        }
        if (atSchool) {
          const sign = project(-5.5, 5.8, -8);
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(sign.x - 54, sign.y - 14, 108, 28);
          ctx.strokeStyle = '#ca8a04';
          ctx.lineWidth = 3;
          ctx.strokeRect(sign.x - 54, sign.y - 14, 108, 28);
          ctx.fillStyle = '#854d0e';
          ctx.font = '900 13px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('TRƯỜNG A', sign.x, sign.y + 5);
          ctx.textAlign = 'left';
        }
      }

      // Cây xanh ven đường
      for (const [tx, tz] of [[-6, 6], [6, 10], [-6, 16], [6, -2]] as const) {
        block(ctx, project, tx, 0, tz, 0.5, 2, 0.5, C.trunk, shade(C.trunk, -30), shade(C.trunk, -12));
        block(ctx, project, tx - 0.4, 2, tz - 0.4, 1.3, 1.6, 1.3, C.leaf, shade(C.leaf, -40), shade(C.leaf, -20));
      }

      // Đèn giao thông (L1+L2): chỉ vẽ khi traffic_control cho màu xác định
      // (RED/YELLOW/GREEN/PEDESTRIAN_RED/PEDESTRIAN_GREEN/OFF), bất kể archetype;
      // không vẽ khi NONE/YIELD_SIGN/STOP_SIGN/OFFICER_STOP/RAIL_BARRIER.
      // Không còn chế độ đèn tự chạy vòng.
      const light = lightStateFor(d.visualSpec?.traffic_control, d.visualSpec?.dual_arrow_light);
      if (light.draw) {
        block(ctx, project, 3.4, 0, 1.5, 0.3, 4, 0.3, C.signalOff, shade(C.signalOff, -30), shade(C.signalOff, -12));
        if (light.dual) {
          // Đèn 2 mũi tên (SCN-104A): xanh đi thẳng + đỏ rẽ trái.
          const arrowUp = project(3.55, 3.2, 1.5);
          const arrowLeft = project(3.55, 2.2, 1.5);
          ctx.font = '900 22px system-ui';
          ctx.textAlign = 'center';
          ctx.fillStyle = C.green;
          ctx.fillText('↑', arrowUp.x, arrowUp.y);
          ctx.fillStyle = C.red;
          ctx.fillText('←', arrowLeft.x, arrowLeft.y);
          ctx.textAlign = 'left';
        } else {
          const phaseIndex = light.phase === 'RED' ? 0 : light.phase === 'YELLOW' ? 1 : light.phase === 'GREEN' ? 2 : -1;
          block(ctx, project, 3.1, 3.4, 1.4, 0.9, 0.8, 0.6, phaseIndex === 0 ? C.red : C.signalOff, '#111', '#222');
          block(ctx, project, 3.1, 2.5, 1.4, 0.9, 0.8, 0.6, phaseIndex === 1 ? C.yellow : C.signalOff, '#111', '#222');
          block(ctx, project, 3.1, 1.6, 1.4, 0.9, 0.8, 0.6, phaseIndex === 2 ? C.green : C.signalOff, '#111', '#222');
        }
        // Đèn người đi bộ riêng ở cột đối diện (SCN-102A/308A).
        if (light.ped) {
          block(ctx, project, -3.4, 0, 1.5, 0.3, 2.2, 0.3, C.signalOff, shade(C.signalOff, -30), shade(C.signalOff, -12));
          const pedSign = project(-3.4, 2.6, 1.5);
          ctx.fillStyle = light.ped === 'green' ? C.green : C.red;
          ctx.font = '900 13px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(light.ped === 'green' ? 'ĐI' : 'DỪNG', pedSign.x, pedSign.y);
          ctx.textAlign = 'left';
        }
      }

      // Xe NPC theo spec.actors (N2a/N3) — xe buýt và ô tô từng vô hình vì
      // archetype không vẽ chúng. Nhãn vùng điểm mù đổi theo loại xe.
      const npcVehicles = npcVehiclesFor(d.visualSpec, scene, d.sceneKind);
      for (const v of npcVehicles) drawVehicle(ctx, project, d.time, v);
      if (scene.archetype === 'LARGE_VEHICLE_BLIND_SPOT') {
        const blind = npcVehicles[0];
        const blindLabel = blind?.kind === 'BUS' ? 'VÙNG ĐIỂM MÙ XE BUÝT' : blind?.kind === 'CAR' ? 'VÙNG ĐIỂM MÙ XE Ô TÔ' : 'VÙNG ĐIỂM MÙ XE TẢI';
        // Vùng nguy hiểm điểm mù màu đỏ nổi bật
        ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
        const mark = project(0.4, 0, -2);
        ctx.fillRect(mark.x - tile * 0.6, mark.y - tile * 0.25, tile * 1.2, tile * 0.6);
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 11px system-ui';
        ctx.fillText(`⚠️ ${blindLabel}`, mark.x - tile * 0.5, mark.y - tile * 0.3);
      }

      if (scene.archetype === 'PEDESTRIAN_CROSSING' || scene.actors.has('pedestrian')) {
        const walk = (Math.sin(d.time * 2) + 1) / 2;
        const nx = -1.6 + walk * 3.2;
        block(ctx, project, nx, 0, 0.2, 0.55, 1.1, 0.55, '#FF8A65', '#BF360C', '#E64A19');
        block(ctx, project, nx - 0.05, 1.1, 0.3, 0.65, 0.6, 0.6, C.skin, '#D28C5B', '#EAB389');
      }

      // Người điều tiết giao thông (O1): thân + đầu + biển DỪNG đỏ.
      if (scene.actors.has('traffic_officer')) {
        block(ctx, project, 1.6, 0, -0.5, 0.55, 1.1, 0.55, '#f59e0b', '#b45309', '#d97706');
        block(ctx, project, 1.55, 1.1, -0.4, 0.65, 0.6, 0.6, C.skin, '#D28C5B', '#EAB389');
        const stopSign = project(1.85, 1.6, -0.5);
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(stopSign.x, stopSign.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '900 8px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('DỪNG', stopSign.x, stopSign.y + 3);
        ctx.textAlign = 'left';
      }

      // Biển báo theo spec.sign (S1): cột + bảng ghi nhãn ngắn.
      const signText = signLabel(d.visualSpec?.sign);
      if (signText) {
        block(ctx, project, 3.2, 0, -2, 0.15, 2.2, 0.15, '#475569', '#334155', '#1e293b');
        const signPos = project(3.2, 2.5, -2);
        ctx.font = '900 11px system-ui';
        const signW = Math.max(64, ctx.measureText(signText).width + 16);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(signPos.x - signW / 2, signPos.y - 12, signW, 22);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.strokeRect(signPos.x - signW / 2, signPos.y - 12, signW, 22);
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.fillText(signText, signPos.x, signPos.y + 4);
        ctx.textAlign = 'left';
      }

      if (scene.archetype === 'OPENING_DOOR') {
        // Tấm cửa đang mở (xe đã vẽ trong npcVehiclesFor — xe buýt nếu là xe đưa đón).
        block(ctx, project, 1.2, 0.6, 4.3, 0.15, 1.3, 1.4, C.yellow, C.truckDark, C.truckDark);
      }

      if (scene.archetype === 'BUS_STOP') {
        // Trạm dừng (xe buýt đã vẽ trong npcVehiclesFor).
        block(ctx, project, 4.8, 0, -2, 0.25, 3, 0.25, '#475569', '#334155', '#1e293b');
        block(ctx, project, 4.2, 2.5, -2.3, 1.5, 0.8, 0.3, '#f8fafc', '#cbd5e1', '#e2e8f0');
      }

      if (scene.archetype === 'MERGE_LANE_CHANGE') {
        for (let z = -8; z <= 5; z += 1.4) {
          block(ctx, project, 1.05, 0.02, z, 0.12, 0.04, 0.72, C.yellow, '#ca8a04', '#eab308');
        }
        const mergeMark = project(0.9, 0.25, -1.2);
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(mergeMark.x + 34, mergeMark.y - 24);
        ctx.lineTo(mergeMark.x, mergeMark.y);
        ctx.lineTo(mergeMark.x + 28, mergeMark.y + 8);
        ctx.stroke();
      }

      if (scene.archetype === 'OVERTAKING') {
        // Hai xe vượt nhau đã vẽ trong npcVehiclesFor (teal + hồng).
        const conflict = project(0, 0.2, -4.2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.32)';
        ctx.beginPath();
        ctx.arc(conflict.x, conflict.y, tile * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

      if (scene.archetype === 'RAILWAY_CROSSING') {
        for (let x = -5; x <= 5; x += 0.5) {
          block(ctx, project, x, 0.02, 0.8, 0.38, 0.08, 0.16, '#475569', '#1e293b', '#334155');
          block(ctx, project, x, 0.02, -0.8, 0.38, 0.08, 0.16, '#475569', '#1e293b', '#334155');
        }
        block(ctx, project, -3, 0, 2, 0.22, 3.4, 0.22, '#e2e8f0', '#94a3b8', '#cbd5e1');
        block(ctx, project, -3, 2.8, 2, 5, 0.18, 0.18, C.red, '#991b1b', '#b91c1c');
      }

      if (scene.archetype === 'ROUNDABOUT') {
        block(ctx, project, -1.1, 0, -1.1, 2.2, 0.45, 2.2, C.grassDark, '#3f8f48', '#4fa556');
        block(ctx, project, -0.45, 0.45, -0.45, 0.9, 0.3, 0.9, C.walk, C.walkDark, '#c8dce7');
      }

      if (scene.archetype === 'OBSTACLE_CONSTRUCTION') {
        block(ctx, project, -1.5, 0, -1, 3, 0.7, 0.55, '#f97316', '#c2410c', '#ea580c');
        for (const x of [-1.2, 0, 1.2]) {
          block(ctx, project, x, 0.7, -0.9, 0.28, 0.8, 0.28, C.yellow, '#ca8a04', '#eab308');
        }
      }

      if (scene.archetype === 'LOW_VISIBILITY') {
        // Keep the leading vehicle barely visible so the scene matches the loss-of-visibility hazard.
        block(ctx, project, -0.65, 0, -4.8, 1.3, 0.95, 2.5, '#94a3b8', '#475569', '#64748b');
        if (/underpass|cau_vuot/.test(kind)) {
          block(ctx, project, -5.5, 0, -7, 1.2, 5.5, 1.2, '#64748b', '#334155', '#475569');
          block(ctx, project, 4.3, 0, -7, 1.2, 5.5, 1.2, '#64748b', '#334155', '#475569');
          block(ctx, project, -5.5, 5.5, -7, 11, 0.8, 1.2, '#94a3b8', '#475569', '#64748b');
        }
      }

      // Phương tiện học sinh (W1: đi bộ thì vẽ người đi bộ, không xe, không mũ).
      const px = d.playerX;
      const pz = d.playerZ;
      const isWalk = d.vehicleType === 'WALK';
      if (!isWalk) {
        const playerColor = d.brake ? C.brake : C.player;
        const vehicleWidth = d.vehicleType === 'BIKE' ? 0.5 : d.vehicleType === 'MOTO_50CC' ? 0.9 : 0.72;
        const vehicleLength = d.vehicleType === 'BIKE' ? 1.5 : d.vehicleType === 'MOTO_50CC' ? 2 : 1.7;
        const vehicleHeight = d.vehicleType === 'BIKE' ? 0.28 : 0.48;
        block(ctx, project, px - vehicleWidth / 2, 0, pz, vehicleWidth, vehicleHeight, vehicleLength, playerColor, shade(playerColor, -55), shade(playerColor, -25));
        block(ctx, project, px - 0.25, vehicleHeight, pz + 0.2, 0.5, 0.6, 0.6, shade(C.player, 45), C.playerDark, C.playerDark);
        // Đèn phanh: 2 ô đỏ sáng ở đuôi xe khi phanh.
        if (d.brake) {
          const tailL = project(px - vehicleWidth / 2 + 0.08, 0.15, pz + vehicleLength);
          const tailR = project(px + vehicleWidth / 2 - 0.08, 0.15, pz + vehicleLength);
          ctx.fillStyle = '#ff2d55';
          ctx.fillRect(tailL.x - 3, tailL.y - 3, 6, 6);
          ctx.fillRect(tailR.x - 3, tailR.y - 3, 6, 6);
        }
        // Xi-nhan xe học sinh (T1): 2 chấm vàng cam nhấp nháy bên hướng rẽ (trước + sau).
        if (d.signal !== 'OFF' && Math.floor(d.time * 3) % 2 === 0) {
          const sideX = d.signal === 'LEFT' ? px - vehicleWidth / 2 : px + vehicleWidth / 2;
          const sigF = project(sideX, 0.35, pz - 0.1);
          const sigB = project(sideX, 0.35, pz + vehicleLength - 0.1);
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(sigF.x, sigF.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(sigB.x, sigB.y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Người đi bộ: thân áo xanh, không xe.
        block(ctx, project, px - 0.28, 0, pz + 0.1, 0.55, 1.1, 0.55, C.player, shade(C.player, -55), shade(C.player, -25));
      }

      // Nhân vật học sinh 2.5D (đi bộ: không mũ bảo hiểm).
      const head = project(px, 1.85, pz + 0.15);
      const hs = Math.max(12, tile * 0.44);
      ctx.fillStyle = C.skin;
      ctx.fillRect(head.x - hs / 2, head.y - hs / 2, hs, hs);

      if (!isWalk) {
        // Mũ bảo hiểm đạt chuẩn ATGT
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(head.x - hs / 2 - 1, head.y - hs / 2 - 2, hs + 2, hs * 0.55);
      }

      // Hiệu ứng mưa (R1): chỉ vẽ vệt mưa khi kịch bản đang mưa thật
      // (spec.raining); đường ướt sau mưa không vẽ mưa. Màn chào không có spec
      // thì vẽ theo prop weather như cũ.
      if (activeWeather === 'rain' && (!d.visualSpec || d.visualSpec.raining)) {
        ctx.fillStyle = 'rgba(207,232,245,0.45)';
        for (let i = 0; i < 60; i++) {
          const rx = (i * 97 + d.time * 260) % w;
          const ry = (i * 53 + d.time * 420) % h;
          ctx.fillRect(rx, ry, 2, 8);
        }
      }
      // Lớp phủ tối ban đêm (E1).
      if (d.visualSpec?.time_of_day === 'NIGHT') {
        ctx.fillStyle = 'rgba(2, 6, 23, 0.28)';
        ctx.fillRect(0, 0, w, h);
      }
      if (d.visualSpec?.weather === 'FOG' || scene.archetype === 'LOW_VISIBILITY') {
        ctx.fillStyle = 'rgba(226, 232, 240, 0.42)';
        ctx.fillRect(0, 0, w, h);
      }

      const effect = decisionEffect(d.visualSpec, d.selectedDecision);
      const isUnsafeMovement = /rush|accelerate|speed|overtake|pass|ignore|swerve|conflict|near_miss/.test(effect);
      if (d.selectedDecision && isUnsafeMovement && scene.archetype !== 'STRAIGHT_ROAD') {
        const warning = project(px, 2.5, pz - 1.4);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.78)';
        ctx.beginPath();
        ctx.arc(warning.x, warning.y, 18 + Math.sin(d.time * 7) * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '900 16px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('!', warning.x, warning.y + 6);
        ctx.textAlign = 'left';
      }

      // Badge phản xạ chọn phương án — to hơn (18px) + nền pill tối để nhìn rõ.
      if (d.selectedDecision) {
        const badgeText = d.brake ? 'ĐÃ GIẢM TỐC / NHƯỜNG ĐƯỜNG' : isUnsafeMovement ? 'NGUY CƠ XUNG ĐỘT TĂNG CAO' : 'ĐANG THỰC HIỆN LỰA CHỌN';
        const badgeBg = d.brake ? '#22c55e' : isUnsafeMovement ? '#ef4444' : '#f59e0b';
        ctx.font = '900 18px system-ui';
        const badgeW = ctx.measureText(badgeText).width + 44;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.fillRect(12, 10, badgeW, 30);
        ctx.fillStyle = badgeBg;
        ctx.beginPath();
        ctx.arc(28, 25, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText(badgeText, 42, 31);
      }
    };

    frame(performance.now());
    const loop = (now: number) => {
      frame(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [weather, selectedDecision, visualSpec]);

  return (
    <div style={{ position: 'relative', width: '100%', flex: 1, minHeight: 420, background: '#38bdf8', overflow: 'hidden', borderRadius: '22px' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} aria-label="Mô phỏng giao thông 2.5D Isometric" />
      <div style={{ position: 'absolute', left: 12, bottom: 12, fontFamily: 'system-ui, sans-serif', fontSize: 11, fontWeight: 800, color: '#f8fafc', background: 'rgba(15, 23, 42, 0.75)', padding: '5px 10px', borderRadius: 8 }}>
        MÔ PHỎNG TÌNH HUỐNG 2.5D
      </div>
    </div>
  );
}
