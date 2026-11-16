'use client';

import React, { useEffect, useRef, useState } from 'react';

export type CameraMode = 'CINEMATIC_OVERVIEW' | 'FOLLOW_VEHICLE' | 'TOP_DOWN' | 'INTERSECTION';
export type VehicleType = 'BIKE' | 'E_BIKE' | 'E_SCOOTER' | 'MOTO_50CC';

export interface World3DProps {
  cameraMode?: CameraMode;
  vehicleType?: VehicleType;
  isDriving?: boolean;
  onAction?: (action: string) => void;
  interactive?: boolean;
  weather?: 'sunny' | 'rain' | 'evening';
  hazardActive?: boolean;
}

export default function World3D({
  cameraMode = 'CINEMATIC_OVERVIEW',
  vehicleType = 'BIKE',
  isDriving = false,
  onAction,
  interactive = true,
  weather = 'sunny',
  hazardActive = false,
}: World3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fps, setFps] = useState<number>(60);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [isBraking, setIsBraking] = useState<boolean>(false);
  const [signalState, setSignalState] = useState<'OFF' | 'LEFT' | 'RIGHT'>('OFF');
  const [activeCam, setActiveCam] = useState<CameraMode>(cameraMode);

  const stateRef = useRef({
    cameraMode,
    vehicleType,
    isDriving,
    interactive,
    weather,
    hazardActive,
    time: 0,
    playerX: 18,
    playerZ: 120,
    speed: 0,
    targetSpeed: 0,
    brake: false,
    signal: 'OFF' as 'OFF' | 'LEFT' | 'RIGHT',
    trafficLight: 'GREEN' as 'GREEN' | 'YELLOW' | 'RED',
    lightTimer: 0,
    orbitAngle: 0.65,
    orbitPitch: 0.55,
    orbitZoom: 1.0,
    busZ: -140,
    truckZ: 130,
    carX: -140,
    pedX: -48,
    pedDir: 1,
  });

  useEffect(() => {
    stateRef.current.cameraMode = cameraMode;
    setActiveCam(cameraMode);
    stateRef.current.vehicleType = vehicleType;
    stateRef.current.isDriving = isDriving;
    stateRef.current.interactive = interactive;
    stateRef.current.weather = weather;
    stateRef.current.hazardActive = hazardActive;
  }, [cameraMode, vehicleType, isDriving, interactive, weather, hazardActive]);

  const handleAction = (act: string) => {
    if (act === 'BRAKE') {
      stateRef.current.brake = true;
      stateRef.current.targetSpeed = 0;
      setIsBraking(true);
      setTimeout(() => setIsBraking(false), 700);
    } else if (act === 'ACCEL') {
      stateRef.current.brake = false;
      stateRef.current.targetSpeed = vehicleType === 'BIKE' ? 16 : 24;
    } else if (act === 'LEFT') {
      stateRef.current.playerX = Math.max(-45, stateRef.current.playerX - 8);
    } else if (act === 'RIGHT') {
      stateRef.current.playerX = Math.min(45, stateRef.current.playerX + 8);
    } else if (act === 'SIGNAL_LEFT') {
      const next = stateRef.current.signal === 'LEFT' ? 'OFF' : 'LEFT';
      stateRef.current.signal = next;
      setSignalState(next);
    } else if (act === 'SIGNAL_RIGHT') {
      const next = stateRef.current.signal === 'RIGHT' ? 'OFF' : 'RIGHT';
      stateRef.current.signal = next;
      setSignalState(next);
    }
    if (onAction) onAction(act);
  };

  const switchCam = (mode: CameraMode) => {
    stateRef.current.cameraMode = mode;
    setActiveCam(mode);
  };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsTimer = performance.now();

    const keys: Record<string, boolean> = {};
    const isEditableTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      return Boolean(
        element &&
        (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)),
      );
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      // Không chặn phím khi người dùng đang nhập vào form (dấu cách, mũi tên, w/q/e...).
      if (isEditableTarget(e.target)) return;
      if (!stateRef.current.interactive) return;
      keys[e.key.toLowerCase()] = true;
      if (['arrowup', 'w'].includes(e.key.toLowerCase())) handleAction('ACCEL');
      if ([' ', 'spacebar'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        handleAction('BRAKE');
      }
      if (e.key.toLowerCase() === 'q') handleAction('SIGNAL_LEFT');
      if (e.key.toLowerCase() === 'e') handleAction('SIGNAL_RIGHT');
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false;
      if (isEditableTarget(e.target)) return;
      if (['arrowup', 'w'].includes(e.key.toLowerCase()) && !keys['arrowup'] && !keys['w']) {
        stateRef.current.targetSpeed = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Chuẩn hóa Phép chiếu phối cảnh Isometric 3D với Chiều sâu Cinematic
    // Cho phép camera xoay mượt mà, bao quát toàn cảnh giao lộ đẹp như game 3D
    const projectIso = (wx: number, wy: number, wz: number, w: number, h: number, camX: number, camY: number, camZ: number, yaw: number, pitch: number, zoom: number) => {
      // Dịch chuyển tương đối
      const rx = wx - camX;
      const ry = wy - camY;
      const rz = wz - camZ;

      // Xoay theo góc ngắm Yaw (Trục Y)
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const x1 = rx * cosY - rz * sinY;
      const z1 = rx * sinY + rz * cosY;

      // Xoay theo góc ngẩng Pitch (Trục X)
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const y2 = ry * cosP - z1 * sinP;
      const z2 = ry * sinP + z1 * cosP;

      // Phối cảnh Perspective
      const dist = 380;
      const f = (dist + z2 * 0.45);
      if (f <= 20) return null; // Vật ở phía sau lưng camera
      const scale = (dist / f) * zoom;

      const screenX = w / 2 + x1 * scale;
      const screenY = h / 2 - y2 * scale;
      return { x: screenX, y: screenY, depth: z2, scale };
    };

    // Hàm vẽ khối hộp 3D phong cách Stylized PBR (Mặt trên sáng, mặt trước đậm, mặt cạnh tương phản)
    const drawBlock = (
      wx: number, wy: number, wz: number,
      bw: number, bh: number, bd: number,
      topColor: string, frontColor: string, sideColor: string,
      camX: number, camY: number, camZ: number, yaw: number, pitch: number, zoom: number
    ) => {
      const w = canvas.width;
      const h = canvas.height;
      const hw = bw / 2;
      const hd = bd / 2;

      // 8 đỉnh 3D
      const p1 = projectIso(wx - hw, wy, wz - hd, w, h, camX, camY, camZ, yaw, pitch, zoom);
      const p2 = projectIso(wx + hw, wy, wz - hd, w, h, camX, camY, camZ, yaw, pitch, zoom);
      const p3 = projectIso(wx + hw, wy, wz + hd, w, h, camX, camY, camZ, yaw, pitch, zoom);
      const p4 = projectIso(wx - hw, wy, wz + hd, w, h, camX, camY, camZ, yaw, pitch, zoom);

      const p5 = projectIso(wx - hw, wy + bh, wz - hd, w, h, camX, camY, camZ, yaw, pitch, zoom);
      const p6 = projectIso(wx + hw, wy + bh, wz - hd, w, h, camX, camY, camZ, yaw, pitch, zoom);
      const p7 = projectIso(wx + hw, wy + bh, wz + hd, w, h, camX, camY, camZ, yaw, pitch, zoom);
      const p8 = projectIso(wx - hw, wy + bh, wz + hd, w, h, camX, camY, camZ, yaw, pitch, zoom);

      if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6 || !p7 || !p8) return;

      // Đổ bóng mềm xuống mặt đường
      ctx.beginPath();
      ctx.ellipse((p1.x + p3.x) / 2, Math.max(p1.y, p3.y) + 2, (bw + bd) * 0.45 * p1.scale, (bw + bd) * 0.18 * p1.scale, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
      ctx.fill();

      // Mặt trước
      ctx.beginPath();
      ctx.moveTo(p4.x, p4.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p7.x, p7.y);
      ctx.lineTo(p8.x, p8.y);
      ctx.closePath();
      ctx.fillStyle = frontColor;
      ctx.fill();

      // Mặt cạnh
      ctx.beginPath();
      ctx.moveTo(p3.x, p3.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p6.x, p6.y);
      ctx.lineTo(p7.x, p7.y);
      ctx.closePath();
      ctx.fillStyle = sideColor;
      ctx.fill();

      // Mặt trên
      ctx.beginPath();
      ctx.moveTo(p8.x, p8.y);
      ctx.lineTo(p7.x, p7.y);
      ctx.lineTo(p6.x, p6.y);
      ctx.lineTo(p5.x, p5.y);
      ctx.closePath();
      ctx.fillStyle = topColor;
      ctx.fill();
    };

    // Vòng lặp Render 60 FPS
    const render = (time: number) => {
      const delta = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;
      stateRef.current.time += delta;

      frameCount++;
      if (time - fpsTimer >= 1000) {
        setFps(Math.round((frameCount * 1000) / (time - fpsTimer)));
        frameCount = 0;
        fpsTimer = time;
      }

      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }
      const w = canvas.width;
      const h = canvas.height;
      const st = stateRef.current;

      // Chu kỳ đèn giao thông ngã tư: Xanh 6s -> Vàng 2s -> Đỏ 5s
      st.lightTimer += delta;
      if (st.lightTimer < 6) st.trafficLight = 'GREEN';
      else if (st.lightTimer < 8) st.trafficLight = 'YELLOW';
      else if (st.lightTimer < 13) st.trafficLight = 'RED';
      else st.lightTimer = 0;

      // Động lực học xe người chơi
      if (st.brake) {
        st.speed = Math.max(0, st.speed - 40 * delta);
      } else {
        st.speed += (st.targetSpeed - st.speed) * Math.min(1, 5 * delta);
      }
      setCurrentSpeed(Math.round(st.speed));

      if (keys['arrowleft'] || keys['a']) {
        st.playerX = Math.max(-45, st.playerX - 22 * delta);
      }
      if (keys['arrowright'] || keys['d']) {
        st.playerX = Math.min(45, st.playerX + 22 * delta);
      }
      st.playerZ -= st.speed * 2.8 * delta;
      if (st.playerZ < -160) st.playerZ = 160;

      // Chuyển động xe NPC trong thành phố
      st.busZ += 14 * delta;
      if (st.busZ > 160) st.busZ = -160;

      st.truckZ -= 18 * delta;
      if (st.truckZ < -160) st.truckZ = 160;

      st.carX += 20 * delta;
      if (st.carX > 160) st.carX = -160;

      // Học sinh đi bộ qua vạch sang đường
      st.pedX += 16 * delta * st.pedDir;
      if (st.pedX > 48) { st.pedX = 48; st.pedDir = -1; }
      if (st.pedX < -48) { st.pedX = -48; st.pedDir = 1; }

      // Tính toán Camera thông minh theo Mode
      let camX = 0;
      let camY = 120;
      let camZ = 0;
      let yaw = 0.65;
      let pitch = 0.52;
      let zoom = 1.05;

      if (st.cameraMode === 'FOLLOW_VEHICLE') {
        camX = st.playerX;
        camY = 45;
        camZ = st.playerZ + 65;
        yaw = 0;
        pitch = 0.32;
        zoom = 1.35;
      } else if (st.cameraMode === 'INTERSECTION') {
        camX = 40;
        camY = 135;
        camZ = 45;
        yaw = 0.78;
        pitch = 0.62;
        zoom = 1.15;
      } else if (st.cameraMode === 'TOP_DOWN') {
        camX = 0;
        camY = 220;
        camZ = 0;
        yaw = 0;
        pitch = 1.52;
        zoom = 1.0;
      } else {
        // CINEMATIC_OVERVIEW (Góc máy xoay nhẹ toàn cảnh đô thị học đường sống động như ảnh chụp mẫu)
        yaw = 0.55 + Math.sin(st.time * 0.15) * 0.12;
        pitch = 0.52 + Math.cos(st.time * 0.12) * 0.05;
        camX = Math.sin(st.time * 0.1) * 30;
        camY = 130;
        camZ = 30 + Math.cos(st.time * 0.1) * 20;
        zoom = 1.12;
      }
      // 1. Vẽ Bầu trời & Ánh sáng ban ngày ấm áp
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      if (st.weather === 'rain') {
        skyGrad.addColorStop(0, '#94a3b8');
        skyGrad.addColorStop(1, '#cbd5e1');
      } else {
        skyGrad.addColorStop(0, '#38bdf8');
        skyGrad.addColorStop(0.55, '#bae6fd');
        skyGrad.addColorStop(1, '#fef08a');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Mặt cỏ công viên & Sân trường xanh mát
      const lawnW = 340;
      const lawnD = 340;
      const c1 = projectIso(-lawnW, 0, -lawnD, w, h, camX, camY, camZ, yaw, pitch, zoom);
      const c2 = projectIso(lawnW, 0, -lawnD, w, h, camX, camY, camZ, yaw, pitch, zoom);
      const c3 = projectIso(lawnW, 0, lawnD, w, h, camX, camY, camZ, yaw, pitch, zoom);
      const c4 = projectIso(-lawnW, 0, lawnD, w, h, camX, camY, camZ, yaw, pitch, zoom);

      if (c1 && c2 && c3 && c4) {
        ctx.beginPath();
        ctx.moveTo(c1.x, c1.y);
        ctx.lineTo(c2.x, c2.y);
        ctx.lineTo(c3.x, c3.y);
        ctx.lineTo(c4.x, c4.y);
        ctx.closePath();
        ctx.fillStyle = st.weather === 'rain' ? '#65a30d' : '#84cc16';
        ctx.fill();
      }

      // 2. Mạng lưới Giao lộ Ngã tư Đường Nhựa Đô thị Việt Nam (Asphalt Road Grid)
      const roadW = 86;
      // Đường trục Bắc - Nam (Trục trước cổng trường)
      const r1 = projectIso(-roadW / 2, 0.4, -lawnD, w, h, camX, camY, camZ, yaw, pitch, zoom);
      const r2 = projectIso(roadW / 2, 0.4, -lawnD, w, h, camX, camY, camZ, yaw, pitch, zoom);
      const r3 = projectIso(roadW / 2, 0.4, lawnD, w, h, camX, camY, camZ, yaw, pitch, zoom);
      const r4 = projectIso(-roadW / 2, 0.4, lawnD, w, h, camX, camY, camZ, yaw, pitch, zoom);
      if (r1 && r2 && r3 && r4) {
        ctx.beginPath();
        ctx.moveTo(r1.x, r1.y); ctx.lineTo(r2.x, r2.y); ctx.lineTo(r3.x, r3.y); ctx.lineTo(r4.x, r4.y);
        ctx.closePath();
        ctx.fillStyle = '#233345';
        ctx.fill();
      }

      // Đường trục Đông - Tây cắt ngang tạo ngã tư
      const rx1 = projectIso(-lawnW, 0.4, -roadW / 2, w, h, camX, camY, camZ, yaw, pitch, zoom);
      const rx2 = projectIso(lawnW, 0.4, -roadW / 2, w, h, camX, camY, camZ, yaw, pitch, zoom);
      const rx3 = projectIso(lawnW, 0.4, roadW / 2, w, h, camX, camY, camZ, yaw, pitch, zoom);
      const rx4 = projectIso(-lawnW, 0.4, roadW / 2, w, h, camX, camY, camZ, yaw, pitch, zoom);
      if (rx1 && rx2 && rx3 && rx4) {
        ctx.beginPath();
        ctx.moveTo(rx1.x, rx1.y); ctx.lineTo(rx2.x, rx2.y); ctx.lineTo(rx3.x, rx3.y); ctx.lineTo(rx4.x, rx4.y);
        ctx.closePath();
        ctx.fillStyle = '#233345';
        ctx.fill();
      }

      // Vỉa hè đá lát hoa văn (Sidewalks) ở 4 góc ngã tư
      const swBlock = (sx: number, sz: number) => {
        drawBlock(sx, 0, sz, 90, 3, 90, '#f1f5f9', '#cbd5e1', '#94a3b8', camX, camY, camZ, yaw, pitch, zoom);
      };
      swBlock(-95, -95);
      swBlock(95, -95);
      swBlock(-95, 95);
      swBlock(95, 95);

      // Vạch tim đường nét đứt màu vàng chuẩn Việt Nam
      for (let z = -260; z < 260; z += 30) {
        if (Math.abs(z) < 45) continue; // Chừa khoảng giữa ngã tư
        const m1 = projectIso(-1.2, 0.6, z, w, h, camX, camY, camZ, yaw, pitch, zoom);
        const m2 = projectIso(1.2, 0.6, z, w, h, camX, camY, camZ, yaw, pitch, zoom);
        const m3 = projectIso(1.2, 0.6, z + 16, w, h, camX, camY, camZ, yaw, pitch, zoom);
        const m4 = projectIso(-1.2, 0.6, z + 16, w, h, camX, camY, camZ, yaw, pitch, zoom);
        if (m1 && m2 && m3 && m4) {
          ctx.beginPath();
          ctx.moveTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y); ctx.lineTo(m3.x, m3.y); ctx.lineTo(m4.x, m4.y);
          ctx.closePath();
          ctx.fillStyle = '#facc15';
          ctx.fill();
        }
      }

      // Vạch sang đường cho người đi bộ (Zebra Crosswalk) màu trắng nổi bật
      const drawZebra = (cx: number, cz: number, isVertical: boolean) => {
        for (let i = -36; i <= 36; i += 12) {
          const zx = isVertical ? cx + i : cx;
          const zz = isVertical ? cz : cz + i;
          const bw = isVertical ? 6 : 24;
          const bd = isVertical ? 24 : 6;
          const z1 = projectIso(zx - bw / 2, 0.7, zz - bd / 2, w, h, camX, camY, camZ, yaw, pitch, zoom);
          const z2 = projectIso(zx + bw / 2, 0.7, zz - bd / 2, w, h, camX, camY, camZ, yaw, pitch, zoom);
          const z3 = projectIso(zx + bw / 2, 0.7, zz + bd / 2, w, h, camX, camY, camZ, yaw, pitch, zoom);
          const z4 = projectIso(zx - bw / 2, 0.7, zz + bd / 2, w, h, camX, camY, camZ, yaw, pitch, zoom);
          if (z1 && z2 && z3 && z4) {
            ctx.beginPath();
            ctx.moveTo(z1.x, z1.y); ctx.lineTo(z2.x, z2.y); ctx.lineTo(z3.x, z3.y); ctx.lineTo(z4.x, z4.y);
            ctx.closePath();
            ctx.fillStyle = '#ffffff';
            ctx.fill();
          }
        }
      };
      drawZebra(0, -56, true);
      drawZebra(0, 56, true);
      drawZebra(-56, 0, false);
      drawZebra(56, 0, false);

      // Vạch dừng Stop Line
      const drawStopLine = (sx: number, sz: number, sw: number, sd: number) => {
        const l1 = projectIso(sx - sw / 2, 0.7, sz - sd / 2, w, h, camX, camY, camZ, yaw, pitch, zoom);
        const l2 = projectIso(sx + sw / 2, 0.7, sz - sd / 2, w, h, camX, camY, camZ, yaw, pitch, zoom);
        const l3 = projectIso(sx + sw / 2, 0.7, sz + sd / 2, w, h, camX, camY, camZ, yaw, pitch, zoom);
        const l4 = projectIso(sx - sw / 2, 0.7, sz + sd / 2, w, h, camX, camY, camZ, yaw, pitch, zoom);
        if (l1 && l2 && l3 && l4) {
          ctx.beginPath();
          ctx.moveTo(l1.x, l1.y); ctx.lineTo(l2.x, l2.y); ctx.lineTo(l3.x, l3.y); ctx.lineTo(l4.x, l4.y);
          ctx.closePath();
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
      };
      drawStopLine(20, 72, 36, 4);
      drawStopLine(-20, -72, 36, 4);

      // 3. Công trình Kiến trúc Trường học Việt Nam (Cổng trường mái ngói đỏ & Tòa nhà lớp học)
      // Tòa nhà trường học màu vàng chanh, mái đỏ
      drawBlock(-115, 0, -135, 110, 48, 60, '#fef08a', '#eab308', '#ca8a04', camX, camY, camZ, yaw, pitch, zoom);
      drawBlock(-115, 48, -135, 120, 14, 68, '#ef4444', '#dc2626', '#b91c1c', camX, camY, camZ, yaw, pitch, zoom);

      // Cổng trường học mái ngói chữ TRƯỜNG HỌC AN TOÀN
      drawBlock(-54, 0, -82, 10, 36, 10, '#ea580c', '#c2410c', '#9a3412', camX, camY, camZ, yaw, pitch, zoom);
      drawBlock(-18, 0, -82, 10, 36, 10, '#ea580c', '#c2410c', '#9a3412', camX, camY, camZ, yaw, pitch, zoom);
      drawBlock(-36, 32, -82, 54, 10, 14, '#dc2626', '#b91c1c', '#991b1b', camX, camY, camZ, yaw, pitch, zoom);

      // Hàng cây xanh tán tròn & Cây phượng vĩ nở hoa đỏ
      const drawTree = (tx: number, tz: number, isFlamboyant: boolean) => {
        drawBlock(tx, 0, tz, 5, 20, 5, '#78350f', '#522509', '#3b1a06', camX, camY, camZ, yaw, pitch, zoom);
        drawBlock(tx, 18, tz, 24, 22, 24, isFlamboyant ? '#ef4444' : '#22c55e', isFlamboyant ? '#dc2626' : '#16a34a', isFlamboyant ? '#b91c1c' : '#15803d', camX, camY, camZ, yaw, pitch, zoom);
      };
      drawTree(-75, -60, true);
      drawTree(75, -60, false);
      drawTree(-75, 75, false);
      drawTree(85, 80, true);
      drawTree(125, -120, false);

      // 4. Cột Đèn Tín hiệu Giao thông 3 màu (Xanh / Vàng / Đỏ) tự động đổi trạng thái
      drawBlock(46, 0, 58, 3, 34, 3, '#64748b', '#475569', '#334155', camX, camY, camZ, yaw, pitch, zoom);
      drawBlock(46, 26, 58, 7, 18, 7, '#1e293b', '#0f172a', '#020617', camX, camY, camZ, yaw, pitch, zoom);

      const lightPos = projectIso(46, 31, 58, w, h, camX, camY, camZ, yaw, pitch, zoom);
      if (lightPos) {
        ctx.beginPath();
        ctx.arc(lightPos.x, lightPos.y - 7 * lightPos.scale, 3.5 * lightPos.scale, 0, Math.PI * 2);
        ctx.fillStyle = st.trafficLight === 'RED' ? '#ef4444' : '#450a0a';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(lightPos.x, lightPos.y, 3.5 * lightPos.scale, 0, Math.PI * 2);
        ctx.fillStyle = st.trafficLight === 'YELLOW' ? '#facc15' : '#422006';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(lightPos.x, lightPos.y + 7 * lightPos.scale, 3.5 * lightPos.scale, 0, Math.PI * 2);
        ctx.fillStyle = st.trafficLight === 'GREEN' ? '#22c55e' : '#052e16';
        ctx.fill();
      }

      // Biển báo "ĐI CHẬM - KHU VỰC TRƯỜNG HỌC"
      drawBlock(-46, 0, 68, 2.5, 30, 2.5, '#64748b', '#475569', '#334155', camX, camY, camZ, yaw, pitch, zoom);
      drawBlock(-46, 24, 68, 14, 14, 2, '#f59e0b', '#d97706', '#b45309', camX, camY, camZ, yaw, pitch, zoom);

      // 5. Xe Buýt Đưa Đón Học Sinh màu Vàng Cam (School Bus)
      drawBlock(20, 0, st.busZ, 26, 24, 52, '#f59e0b', '#d97706', '#b45309', camX, camY, camZ, yaw, pitch, zoom);
      drawBlock(20, 10, st.busZ + 16, 22, 10, 14, '#38bdf8', '#0284c7', '#0369a1', camX, camY, camZ, yaw, pitch, zoom); // Kính trước

      // 6. Xe Tải Lớn màu Xanh Dương và Vùng Cảnh Báo Điểm Mù (Blind Spot Zone)
      drawBlock(-20, 0, st.truckZ, 28, 30, 56, '#0284c7', '#0369a1', '#075985', camX, camY, camZ, yaw, pitch, zoom);
      if (st.hazardActive) {
        // Vùng đỏ cảnh báo điểm mù ngay bên sườn xe tải
        const b1 = projectIso(-6, 0.8, st.truckZ - 24, w, h, camX, camY, camZ, yaw, pitch, zoom);
        const b2 = projectIso(14, 0.8, st.truckZ - 24, w, h, camX, camY, camZ, yaw, pitch, zoom);
        const b3 = projectIso(14, 0.8, st.truckZ + 24, w, h, camX, camY, camZ, yaw, pitch, zoom);
        const b4 = projectIso(-6, 0.8, st.truckZ + 24, w, h, camX, camY, camZ, yaw, pitch, zoom);
        if (b1 && b2 && b3 && b4) {
          ctx.beginPath();
          ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(b3.x, b3.y); ctx.lineTo(b4.x, b4.y);
          ctx.closePath();
          ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.fill();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Xe ô tô con màu Đỏ chạy ngang ngã tư
      drawBlock(st.carX, 0, -18, 42, 18, 22, '#ef4444', '#dc2626', '#b91c1c', camX, camY, camZ, yaw, pitch, zoom);

      // Học sinh đi bộ sang đường trên vạch trắng
      drawBlock(st.pedX, 0, 56, 6, 12, 6, '#1e293b', '#0f172a', '#020617', camX, camY, camZ, yaw, pitch, zoom);
      drawBlock(st.pedX, 12, 56, 7, 10, 7, '#ffffff', '#e2e8f0', '#cbd5e1', camX, camY, camZ, yaw, pitch, zoom);
      drawBlock(st.pedX, 22, 56, 5, 5, 5, '#fed7aa', '#fdba74', '#fb923c', camX, camY, camZ, yaw, pitch, zoom);
      drawBlock(st.pedX, 26, 56, 7, 4, 7, '#0284c7', '#0369a1', '#075985', camX, camY, camZ, yaw, pitch, zoom); // Mũ bảo hiểm

      // 7. Phương tiện của Người chơi (Xe đạp / Xe đạp điện / Xe máy điện)
      const px = st.playerX;
      const pz = st.playerZ;
      if (st.vehicleType === 'BIKE') {
        drawBlock(px, 0, pz, 3, 11, 22, '#2563eb', '#1d4ed8', '#1e40af', camX, camY, camZ, yaw, pitch, zoom);
      } else {
        drawBlock(px, 0, pz, 8, 14, 26, '#059669', '#047857', '#065f46', camX, camY, camZ, yaw, pitch, zoom);
      }
      // Người lái xe đội mũ bảo hiểm chuẩn
      drawBlock(px, 12, pz + 2, 7, 12, 7, '#1e3a8a', '#1e40af', '#172554', camX, camY, camZ, yaw, pitch, zoom);
      drawBlock(px, 24, pz + 2, 5, 5, 5, '#fed7aa', '#fdba74', '#fb923c', camX, camY, camZ, yaw, pitch, zoom);
      drawBlock(px, 28, pz + 2, 8, 5, 8, '#ef4444', '#dc2626', '#b91c1c', camX, camY, camZ, yaw, pitch, zoom); // Mũ bảo hiểm đỏ đạt chuẩn

      // Đèn phanh sáng đỏ khi nhấn phanh
      if (st.brake || isBraking) {
        drawBlock(px, 8, pz + 12, 8, 4, 2, '#ef4444', '#f87171', '#dc2626', camX, camY, camZ, yaw, pitch, zoom);
      }

      // Đèn xi-nhan nhấp nháy vàng khi rẽ
      if (st.signal === 'LEFT' && Math.floor(st.time * 4) % 2 === 0) {
        drawBlock(px - 5, 10, pz - 10, 3, 3, 2, '#facc15', '#eab308', '#ca8a04', camX, camY, camZ, yaw, pitch, zoom);
      } else if (st.signal === 'RIGHT' && Math.floor(st.time * 4) % 2 === 0) {
        drawBlock(px + 5, 10, pz - 10, 3, 3, 2, '#facc15', '#eab308', '#ca8a04', camX, camY, camZ, yaw, pitch, zoom);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [cameraMode, vehicleType, isBraking, signalState]);
  return (
    <div className="game-viewport-wrap">
      {/* 3D Isometric Viewport Canvas */}
      <canvas ref={canvasRef} className="game-viewport-canvas" />

      {/* Thanh Chỉ số Nổi trên Không gian 3D (HUD) */}
      <div className="game-hud-top-left">
        <div className="hud-badge-speed">
          <span className="hud-pulse-dot" />
          <span>Tốc độ: <strong>{currentSpeed}</strong> km/h</span>
        </div>
        {isBraking && (
          <div className="hud-badge-brake">
            🛑 ĐANG PHANH
          </div>
        )}
      </div>

      {/* Bộ Chọn Góc Camera 3D (Góc nhìn toàn cảnh ngã tư, theo sau xe, từ trên cao) */}
      <div className="game-hud-top-right">
        <button
          type="button"
          onClick={() => switchCam('CINEMATIC_OVERVIEW')}
          className={`cam-pill ${activeCam === 'CINEMATIC_OVERVIEW' ? 'active' : ''}`}
        >
          🎬 Toàn cảnh 3D
        </button>
        <button
          type="button"
          onClick={() => switchCam('FOLLOW_VEHICLE')}
          className={`cam-pill ${activeCam === 'FOLLOW_VEHICLE' ? 'active' : ''}`}
        >
          📷 Theo xe
        </button>
        <button
          type="button"
          onClick={() => switchCam('INTERSECTION')}
          className={`cam-pill ${activeCam === 'INTERSECTION' ? 'active' : ''}`}
        >
          🚦 Ngã tư
        </button>
      </div>

      {/* Bảng Nút Thao tác Lái xe 3D Gọn gàng, Đẹp mắt, Không thô */}
      {interactive && (
        <div className="game-controls-bar">
          <div className="controls-group">
            <button
              type="button"
              onMouseDown={() => handleAction('SIGNAL_LEFT')}
              onTouchStart={() => handleAction('SIGNAL_LEFT')}
              className={`ctrl-btn ${signalState === 'LEFT' ? 'active-amber' : ''}`}
              title="Phím tắt: Q"
            >
              ⬅ Xi-nhan Trái (Q)
            </button>
            <button
              type="button"
              onMouseDown={() => handleAction('SIGNAL_RIGHT')}
              onTouchStart={() => handleAction('SIGNAL_RIGHT')}
              className={`ctrl-btn ${signalState === 'RIGHT' ? 'active-amber' : ''}`}
              title="Phím tắt: E"
            >
              Xi-nhan Phải (E) ➡
            </button>
          </div>

          <div className="controls-group">
            <button
              type="button"
              onMouseDown={() => handleAction('LEFT')}
              onTouchStart={() => handleAction('LEFT')}
              className="ctrl-btn"
              title="Phím tắt: A / ←"
            >
              ◀ Lách Trái
            </button>
            <button
              type="button"
              onMouseDown={() => handleAction('RIGHT')}
              onTouchStart={() => handleAction('RIGHT')}
              className="ctrl-btn"
              title="Phím tắt: D / →"
            >
              Lách Phải ▶
            </button>
          </div>

          <div className="controls-group primary-drive">
            <button
              type="button"
              onMouseDown={() => handleAction('ACCEL')}
              onTouchStart={() => handleAction('ACCEL')}
              onMouseUp={() => (stateRef.current.targetSpeed = 0)}
              onTouchEnd={() => (stateRef.current.targetSpeed = 0)}
              className="ctrl-btn drive-accel"
              title="Phím tắt: W / Phím Mũi tên Lên"
            >
              🚀 ĐẠP GA (W)
            </button>
            <button
              type="button"
              onClick={() => handleAction('BRAKE')}
              className="ctrl-btn drive-brake"
              title="Phím tắt: Phím Cách (Space)"
            >
              🛑 PHANH (Cách)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}