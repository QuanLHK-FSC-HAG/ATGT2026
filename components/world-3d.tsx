'use client';

import React, { useEffect, useRef } from 'react';
import type { ScenarioVisualSpec } from '@/lib/types';

export type CameraMode = 'CINEMATIC_OVERVIEW' | 'FOLLOW_VEHICLE' | 'TOP_DOWN' | 'INTERSECTION';
export type VehicleType = 'BIKE' | 'E_BIKE' | 'E_SCOOTER' | 'MOTO_50CC';

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

function resolveScene(spec: ScenarioVisualSpec | undefined, sceneKind: string, sceneEvent: string): ResolvedScene {
  const raw = `${spec?.scene_type || ''} ${spec?.road_layout || ''} ${sceneKind} ${sceneEvent}`.toLowerCase();
  let archetype: SceneArchetype = 'STRAIGHT_ROAD';
  if (/rail|duong_sat|barrier/.test(raw)) archetype = 'RAILWAY_CROSSING';
  else if (/roundabout|vong_xuyen/.test(raw)) archetype = 'ROUNDABOUT';
  else if (/door|dooring|mo_cua/.test(raw)) archetype = 'OPENING_DOOR';
  else if (/truck|bus.*blind|blind|diem_mu|xe_tai/.test(raw)) archetype = 'LARGE_VEHICLE_BLIND_SPOT';
  else if (/bus_stop|tram_xe|bus_public/.test(raw)) archetype = 'BUS_STOP';
  else if (/merge|lane_change|chuyen_lan|nhap_lan/.test(raw)) archetype = 'MERGE_LANE_CHANGE';
  else if (/overtak|vuot_xe|vuot_ben/.test(raw)) archetype = 'OVERTAKING';
  else if (/emergency|priority|uu_tien/.test(raw)) archetype = 'EMERGENCY_VEHICLE';
  else if (/construction|obstacle|blocked|chuong_ngai/.test(raw)) archetype = 'OBSTACLE_CONSTRUCTION';
  else if (/low_visibility|fog|suong/.test(raw)) archetype = 'LOW_VISIBILITY';
  else if (/slippery|low_grip|wet|rain|tron/.test(raw)) archetype = 'SLIPPERY_ROAD';
  else if (/pedestrian|crosswalk|nguoi_di_bo|qua_duong/.test(raw)) archetype = 'PEDESTRIAN_CROSSING';
  else if (/intersection|traffic_light|giao_cat|nga_ba|nga_tu/.test(raw)) archetype = 'INTERSECTION';
  else if (/narrow|duong_hep|ngo_hep/.test(raw)) archetype = 'NARROW_ROAD';
  else if (/school|cong_truong/.test(raw)) archetype = 'SCHOOL_GATE';

  return {
    archetype,
    hazards: new Set((spec?.hazards || []).map(value => value.toLowerCase())),
    actors: new Set((spec?.actors || []).map(value => value.toLowerCase())),
    trafficControl: (spec?.traffic_control || sceneEvent || '').toLowerCase(),
    surface: (spec?.surface || '').toLowerCase(),
  };
}

function decisionEffect(spec: ScenarioVisualSpec | undefined, selectedDecision: string): string {
  const effect = spec?.decision_effects?.[selectedDecision];
  return effect ? `${effect.action} ${effect.outcome}`.toLowerCase() : selectedDecision.toLowerCase();
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
    if (!selectedDecision) {
      d.brake = false;
      d.targetSpeed = 0;
      d.signal = 'OFF';
    } else if (/brake|stop|yield|wait|slow|safe|keep_distance/.test(effect)) {
      d.brake = true;
      d.targetSpeed = 0;
      d.signal = 'OFF';
    } else if (/rush|accelerate|speed|overtake|pass/.test(effect)) {
      d.brake = false;
      d.targetSpeed = 20;
      d.signal = 'OFF';
    } else {
      d.brake = false;
      d.targetSpeed = 8;
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

      const zoom = d.cameraMode === 'INTERSECTION' ? 1.25 : d.cameraMode === 'CINEMATIC_OVERVIEW' ? 0.8 : 1;
      const tile = 34 * zoom;
      const camX = d.cameraMode === 'CINEMATIC_OVERVIEW' ? 0 : d.playerX;
      const camZ = d.cameraMode === 'CINEMATIC_OVERVIEW' ? 0 : d.playerZ - 8;
      const project: Projector = (x, y, z) => ({
        x: w / 2 + (x - camX) * tile * 0.72 - (z - camZ) * tile * 0.14,
        y: h * 0.60 + (z - camZ) * tile * 0.32 - y * tile * 0.48,
      });

      // Bầu trời 2.5D theo thời tiết
      ctx.fillStyle = activeWeather === 'evening' ? '#1f2937' : activeWeather === 'rain' ? '#64748b' : '#38bdf8';
      ctx.fillRect(0, 0, w, h);

      // Mặt đất 2.5D Isometric
      for (let x = -12; x <= 12; x++) {
        for (let z = Math.floor(camZ) - 18; z <= Math.floor(camZ) + 24; z++) {
          const isIntersection = ['INTERSECTION', 'PEDESTRIAN_CROSSING', 'ROUNDABOUT'].includes(scene.archetype);
          const isCrossRoad = isIntersection && z >= -2 && z <= 2;
          const roadHalfWidth = scene.archetype === 'NARROW_ROAD' ? 1 : 2;
          const isRoad = (x >= -roadHalfWidth && x <= roadHalfWidth) || isCrossRoad;
          const isWalk = x === -3 || x === 3;
          const isCrosswalk = scene.archetype === 'PEDESTRIAN_CROSSING' && z >= -1 && z <= 1 && Math.abs(x) <= 2;
          const isWet = activeWeather === 'rain' || /wet|slippery|tron|ngap/.test(scene.surface);
          const roadColor = isWet ? '#435d6d' : C.road;
          const top = isCrosswalk && x % 2 === 0 ? C.line : isRoad ? roadColor : isWalk ? C.walk : C.grass;
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

      if (scene.archetype === 'SCHOOL_GATE' || /school|cong_truong/.test(kind)) {
        block(ctx, project, -7.5, 0, -8, 4, 5, 4, C.school, shade(C.school, -40), shade(C.school, -20));
        block(ctx, project, -7.5, 5, -8, 4, 0.6, 4, C.roof, shade(C.roof, -40), shade(C.roof, -20));
        for (let i = 0; i < 3; i++) {
          block(ctx, project, -7.1 + i * 1.1, 2, -7.5, 0.7, 0.9, 0.15, C.window, shade(C.window, -40), shade(C.window, -20));
        }
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

      // Cây xanh ven đường
      for (const [tx, tz] of [[-6, 6], [6, 10], [-6, 16], [6, -2]] as const) {
        block(ctx, project, tx, 0, tz, 0.5, 2, 0.5, C.trunk, shade(C.trunk, -30), shade(C.trunk, -12));
        block(ctx, project, tx - 0.4, 2, tz - 0.4, 1.3, 1.6, 1.3, C.leaf, shade(C.leaf, -40), shade(C.leaf, -20));
      }

      if (scene.archetype === 'INTERSECTION' || /traffic_light|light|den_/.test(scene.trafficControl)) {
        block(ctx, project, 3.4, 0, 1.5, 0.3, 4, 0.3, C.signalOff, shade(C.signalOff, -30), shade(C.signalOff, -12));
        // Đèn cho người đi bộ và đèn cho xe là hai đèn khác nhau: đèn người đi bộ
        // xanh nghĩa là xe phải dừng (đỏ), đèn người đi bộ đỏ nghĩa là xe được đi (xanh).
        const isPedestrianGreen = /pedestrian_green/.test(scene.trafficControl);
        const isPedestrianRed = /pedestrian_red/.test(scene.trafficControl);
        const isRedEvent = isPedestrianGreen || (!isPedestrianRed && /red|dừng|den_do/.test(scene.trafficControl));
        const isYellowEvent = /yellow|vàng|den_vang/.test(scene.trafficControl);
        const isGreenEvent = isPedestrianRed || (!isPedestrianGreen && /green|xanh|den_xanh/.test(scene.trafficControl));
        const lightPhase = isRedEvent ? 0 : isYellowEvent ? 1 : isGreenEvent ? 2 : Math.floor(d.time / 3) % 3;
        block(ctx, project, 3.1, 3.4, 1.4, 0.9, 0.8, 0.6, lightPhase === 0 ? C.red : C.signalOff, '#111', '#222');
        block(ctx, project, 3.1, 2.5, 1.4, 0.9, 0.8, 0.6, lightPhase === 1 ? C.yellow : C.signalOff, '#111', '#222');
        block(ctx, project, 3.1, 1.6, 1.4, 0.9, 0.8, 0.6, lightPhase === 2 ? C.green : C.signalOff, '#111', '#222');
      }

      // Tình huống NPC hiểm họa 2.5D
      if (scene.archetype === 'LARGE_VEHICLE_BLIND_SPOT') {
        block(ctx, project, -1.8, 0, -2, 2.2, 2.2, 4, C.truck, shade(C.truck, -55), shade(C.truck, -25));
        block(ctx, project, -1.7, 2.2, -1.6, 2, 1.2, 2.2, shade(C.truck, 30), C.truckDark, C.truckDark);
        // Vùng nguy hiểm điểm mù màu đỏ nổi bật
        ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
        const mark = project(0.4, 0, -2);
        ctx.fillRect(mark.x - tile * 0.6, mark.y - tile * 0.25, tile * 1.2, tile * 0.6);
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 11px system-ui';
        ctx.fillText('⚠️ VÙNG ĐIỂM MÙ XE TẢI', mark.x - tile * 0.5, mark.y - tile * 0.3);
      }

      if (scene.archetype === 'PEDESTRIAN_CROSSING' || scene.actors.has('pedestrian')) {
        const walk = (Math.sin(d.time * 2) + 1) / 2;
        const nx = -1.6 + walk * 3.2;
        block(ctx, project, nx, 0, 0.2, 0.55, 1.1, 0.55, '#FF8A65', '#BF360C', '#E64A19');
        block(ctx, project, nx - 0.05, 1.1, 0.3, 0.65, 0.6, 0.6, C.skin, '#D28C5B', '#EAB389');
      }

      if (scene.archetype === 'OPENING_DOOR') {
        block(ctx, project, 2.2, 0, 4, 1.6, 1, 2.4, C.car, shade(C.car, -50), shade(C.car, -25));
        block(ctx, project, 1.2, 0.6, 4.3, 0.15, 1.3, 1.4, C.yellow, C.truckDark, C.truckDark);
      }

      if (scene.archetype === 'BUS_STOP') {
        block(ctx, project, 2.2, 0, -3, 2.2, 2.4, 4.8, '#22a6b3', '#14727b', '#1b8792');
        block(ctx, project, 4.8, 0, -2, 0.25, 3, 0.25, '#475569', '#334155', '#1e293b');
        block(ctx, project, 4.2, 2.5, -2.3, 1.5, 0.8, 0.3, '#f8fafc', '#cbd5e1', '#e2e8f0');
      }

      if (scene.archetype === 'MERGE_LANE_CHANGE') {
        for (let z = -8; z <= 5; z += 1.4) {
          block(ctx, project, 1.05, 0.02, z, 0.12, 0.04, 0.72, C.yellow, '#ca8a04', '#eab308');
        }
        block(ctx, project, 1.5, 0, -3.5, 1.05, 0.9, 2.2, C.car, shade(C.car, -45), shade(C.car, -20));
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
        block(ctx, project, -0.9, 0, -2.8, 1.15, 1, 2.5, '#14b8a6', '#0f766e', '#0d9488');
        block(ctx, project, 0.9, 0, -6.5, 1.15, 1, 2.5, C.car, shade(C.car, -45), shade(C.car, -20));
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

      if (scene.archetype === 'EMERGENCY_VEHICLE') {
        block(ctx, project, -1.3, 0, -4, 1.8, 1.2, 3, '#f8fafc', '#94a3b8', '#cbd5e1');
        const flash = Math.floor(d.time * 5) % 2 === 0 ? C.red : C.player;
        block(ctx, project, -0.8, 1.2, -3.4, 0.8, 0.25, 0.5, flash, shade(flash, -40), shade(flash, -20));
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

      // Phương tiện học sinh
      const px = d.playerX;
      const pz = d.playerZ;
      const playerColor = d.brake ? C.brake : C.player;
      const vehicleWidth = d.vehicleType === 'BIKE' ? 0.5 : d.vehicleType === 'MOTO_50CC' ? 0.9 : 0.72;
      const vehicleLength = d.vehicleType === 'BIKE' ? 1.5 : d.vehicleType === 'MOTO_50CC' ? 2 : 1.7;
      const vehicleHeight = d.vehicleType === 'BIKE' ? 0.28 : 0.48;
      block(ctx, project, px - vehicleWidth / 2, 0, pz, vehicleWidth, vehicleHeight, vehicleLength, playerColor, shade(playerColor, -55), shade(playerColor, -25));
      block(ctx, project, px - 0.25, vehicleHeight, pz + 0.2, 0.5, 0.6, 0.6, shade(C.player, 45), C.playerDark, C.playerDark);

      // Nhân vật học sinh 2.5D
      const head = project(px, 1.85, pz + 0.15);
      const hs = Math.max(12, tile * 0.44);
      ctx.fillStyle = C.skin;
      ctx.fillRect(head.x - hs / 2, head.y - hs / 2, hs, hs);

      // Mũ bảo hiểm đạt chuẩn ATGT
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(head.x - hs / 2 - 1, head.y - hs / 2 - 2, hs + 2, hs * 0.55);

      // Hiệu ứng mưa/chiều tối
      if (activeWeather === 'rain') {
        ctx.fillStyle = 'rgba(207,232,245,0.45)';
        for (let i = 0; i < 60; i++) {
          const rx = (i * 97 + d.time * 260) % w;
          const ry = (i * 53 + d.time * 420) % h;
          ctx.fillRect(rx, ry, 2, 8);
        }
      }
      if (d.visualSpec?.weather === 'FOG' || scene.archetype === 'LOW_VISIBILITY') {
        ctx.fillStyle = 'rgba(226, 232, 240, 0.42)';
        ctx.fillRect(0, 0, w, h);
      }

      const effect = decisionEffect(d.visualSpec, d.selectedDecision);
      const isUnsafeMovement = /rush|accelerate|speed|overtake|pass|ignore/.test(effect);
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

      // Badge phản xạ chọn phương án
      if (d.selectedDecision) {
        ctx.fillStyle = d.brake ? '#22c55e' : isUnsafeMovement ? '#ef4444' : '#f59e0b';
        ctx.font = '900 14px system-ui';
        ctx.fillText(d.brake ? 'ĐÃ GIẢM TỐC / NHƯỜNG ĐƯỜNG' : isUnsafeMovement ? 'NGUY CƠ XUNG ĐỘT TĂNG CAO' : 'ĐANG THỰC HIỆN LỰA CHỌN', 16, 28);
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
