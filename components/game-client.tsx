'use client';

import { useEffect, useRef, useState } from 'react';
import type { GameAction } from '@/game/types';

type Direction = 'up' | 'down' | 'left' | 'right';
export default function GameClient({ onAction }: { onAction: (action: GameAction) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef({ direction: '' as Direction | '', brake: false, signal: false, yielding: false, paused: false });
  const callback = useRef(onAction);
  callback.current = onAction;
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [signal, setSignal] = useState(false);
  const [status, setStatus] = useState('Dùng phím ↑ hoặc W để tiến về vạch qua đường.');

  function act(action: GameAction) {
    if (controls.current.paused && action !== 'RESUME') return;
    if (action === 'BRAKE') { controls.current.brake = true; setStatus('Đã phanh. Quan sát trước khi tiếp tục.'); }
    if (action === 'SIGNAL') { controls.current.signal = !controls.current.signal; setSignal(controls.current.signal); setStatus('Đã thay đổi tín hiệu xi-nhan.'); }
    if (action === 'YIELD') { controls.current.brake = true; controls.current.yielding = true; setStatus('Đang dừng, nhường người đi bộ qua đường.'); }
    callback.current(action);
  }
  const actRef = useRef(act);
  actRef.current = act;

  function pause(value: boolean) {
    controls.current.paused = value;
    controls.current.direction = '';
    setPaused(value);
    callback.current(value ? 'PAUSE' : 'RESUME');
  }

  useEffect(() => {
    let mounted = true;
    let destroy: (() => void) | undefined;
    const hide = () => { if (document.hidden) { controls.current.paused = true; controls.current.direction = ''; setPaused(true); callback.current('PAUSE'); } };
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', hide);
    void import('phaser').then(({ default: Phaser }) => {
      if (!mounted || !host.current) return;
      class RoadScene extends Phaser.Scene {
        private rider!: Phaser.GameObjects.Container;
        private pedestrian!: Phaser.GameObjects.Container;
        private lamp!: Phaser.GameObjects.Arc;
        private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
        private warned = false;
        constructor() { super('school-road'); }
        create() {
          this.cameras.main.setBackgroundColor('#d9ede5');
          this.add.rectangle(400, 251, 800, 156, 0xb0cabc);
          this.add.rectangle(400, 251, 800, 118, 0x426171);
          this.add.rectangle(410, 250, 236, 500, 0xb8cfc4);
          this.add.rectangle(410, 250, 204, 500, 0x426171);
          for (let y = 20; y < 500; y += 60) this.add.rectangle(410, y, 4, 28, 0xf9f6df);
          for (let x = 335; x < 505; x += 26) this.add.rectangle(x, 326, 14, 44, 0xfffdf1);
          this.add.rectangle(462, 365, 90, 5, 0xffffff);
          this.add.rectangle(134, 99, 206, 119, 0xfff8e8).setStrokeStyle(3, 0xd6cbb6);
          this.add.rectangle(134, 48, 222, 17, 0xf09660);
          this.add.text(58, 66, 'TRƯỜNG HỌC', { fontFamily: 'Arial', fontSize: '19px', color: '#183f4c', fontStyle: 'bold' });
          for (let x = 69; x < 220; x += 38) this.add.rectangle(x, 122, 22, 30, 0x85b9b7);
          this.add.rectangle(134, 175, 65, 13, 0xe6ba75);
          this.add.text(573, 360, 'CHẬM LẠI\nCỔNG TRƯỜNG', { fontFamily: 'Arial', fontSize: '17px', color: '#315951', lineSpacing: 7 });
          for (const [x, y] of [[54, 411], [197, 370], [631, 80], [723, 146], [696, 433]]) {
            this.add.rectangle(x, y + 16, 8, 32, 0xa78059);
            this.add.circle(x, y, 30, 0x6caa85); this.add.circle(x - 9, y - 8, 18, 0x85bc90);
          }
          const bus = this.add.rectangle(668, 249, 102, 43, 0xeab257).setStrokeStyle(3, 0xfff2cf);
          this.add.text(bus.x - 33, bus.y - 7, 'XE BUÝT', { fontFamily: 'Arial', fontSize: '12px', color: '#233e50' });
          this.lamp = this.add.circle(544, 295, 10, 0xefac45).setStrokeStyle(4, 0x203f4c);
          this.pedestrian = this.add.container(312, 327, [this.add.circle(0, 0, 9, 0xed885e), this.add.rectangle(0, 13, 12, 16, 0xfff5df)]);
          this.rider = this.add.container(462, 445, [this.add.rectangle(0, -16, 5, 13, 0x19394d), this.add.rectangle(0, 17, 5, 13, 0x19394d), this.add.rectangle(0, 0, 19, 29, 0x167e83).setStrokeStyle(2, 0xffffff), this.add.circle(0, -3, 8, 0xffd38e)]);
          if (this.input.keyboard) {
            this.keys = this.input.keyboard.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE,Q,E,Y') as Record<string, Phaser.Input.Keyboard.Key>;
          }
          if (mounted) setReady(true);
        }
        update(_time: number, delta: number) {
          const input = controls.current;
          if (input.paused) return;
          const just = (name: string) => this.keys[name] && Phaser.Input.Keyboard.JustDown(this.keys[name]);
          if (just('SPACE')) actRef.current('BRAKE');
          if (just('Q') || just('E')) actRef.current('SIGNAL');
          if (just('Y')) actRef.current('YIELD');
          const down = (name: string) => this.keys[name]?.isDown;
          let direction = input.direction;
          if (down('UP') || down('W')) direction = 'up';
          if (down('DOWN') || down('S')) direction = 'down';
          if (down('LEFT') || down('A')) direction = 'left';
          if (down('RIGHT') || down('D')) direction = 'right';
          if (direction) input.brake = false;
          const step = Math.min(delta, 40) * 0.095;
          if (!input.brake && direction) {
            if (direction === 'up') this.rider.y -= step;
            if (direction === 'down') this.rider.y += step;
            if (direction === 'left') this.rider.x -= step;
            if (direction === 'right') this.rider.x += step;
            this.rider.x = Phaser.Math.Clamp(this.rider.x, 322, 499);
            this.rider.y = Phaser.Math.Clamp(this.rider.y, 20, 473);
          }
          if (input.yielding) this.pedestrian.x = Math.min(554, this.pedestrian.x + step * 0.9);
          this.lamp.setFillStyle(input.signal ? 0xefac45 : 0x304d58);
          if (this.rider.y < 358 && this.pedestrian.x < 520 && !this.warned) {
            this.warned = true;
            setStatus('Em đã tới vạch qua đường. Hãy dừng và quan sát người đi bộ.');
            callback.current('HAZARD_VISIBLE');
          }
        }
      }
      const instance = new Phaser.Game({ type: Phaser.AUTO, parent: host.current, width: 800, height: 500, scene: RoadScene, render: { antialias: true }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, input: { keyboard: true } });
      destroy = () => instance.destroy(true);
    }).catch(() => { if (mounted) setFailed(true); });
    return () => { mounted = false; destroy?.(); document.removeEventListener('visibilitychange', hide); window.removeEventListener('blur', hide); };
  }, []);

  return <section className="simulation" aria-label="Sân tập tương tác">
    <div className="simulation-top"><span><span className="live-dot" /> SÂN TẬP 2D · XE ĐẠP</span><button onClick={() => pause(!paused)} disabled={!ready}>{paused ? '▶ Tiếp tục' : 'Ⅱ Tạm dừng'}</button></div>
    <div className="canvas-wrap"><div ref={host} className="game-canvas" role="img" aria-label="Đường hai chiều, cổng trường, xe buýt và người đi bộ tại vạch qua đường" />{!ready && <div className="game-overlay">{failed ? 'Không tải được mô phỏng. Em vẫn có thể dùng câu hỏi bên cạnh.' : 'Đang mở sân tập…'}</div>}{paused && <div className="game-overlay"><button className="primary" onClick={() => pause(false)}>Tiếp tục sân tập</button></div>}</div>
    <div className="touch-controls"><div className="direction-pad">{([['left', '←'], ['up', '↑'], ['down', '↓'], ['right', '→']] as const).map(([direction, label]) => <button key={direction} aria-label={`Di chuyển ${direction}`} disabled={paused || !ready} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); controls.current.direction = direction; }} onPointerUp={() => { controls.current.direction = ''; }} onPointerCancel={() => { controls.current.direction = ''; }} onKeyDown={(event) => { if (event.key === 'Enter') controls.current.direction = direction; }} onKeyUp={() => { controls.current.direction = ''; }}>{label}</button>)}</div><div className="action-pad"><button disabled={paused || !ready} onClick={() => act('BRAKE')}>Phanh <kbd>Space</kbd></button><button disabled={paused || !ready} aria-pressed={signal} onClick={() => act('SIGNAL')}>Xi-nhan <kbd>Q/E</kbd></button><button disabled={paused || !ready} onClick={() => act('YIELD')}>Nhường <kbd>Y</kbd></button></div></div>
    <p className="game-status" role="status">{status}</p><p className="small muted">↑ ↓ ← → / WASD để di chuyển. Giữ nút mũi tên trên màn hình cảm ứng. Mô phỏng chỉ hỗ trợ học tập, không hướng dẫn lái xe ngoài đời.</p>
  </section>;
}