'use client';

import { useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { GameplayAction } from '@/lib/types';
import styles from './interaction-controls.module.css';

type SignalDirection = 'OFF' | 'LEFT' | 'RIGHT';

export interface InteractionControlsProps {
  disabled?: boolean;
  speedKmh: number;
  braking?: boolean;
  signal?: SignalDirection;
  hazardVisible?: boolean;
  statusText?: string;
  onActionStart: (action: GameplayAction) => void;
  onActionEnd?: (action: GameplayAction) => void;
}

type ControlButtonProps = {
  action: GameplayAction;
  label: string;
  shortcut: string;
  className?: string;
  active?: boolean;
  disabled?: boolean;
  hold?: boolean;
  onActionStart: InteractionControlsProps['onActionStart'];
  onActionEnd?: InteractionControlsProps['onActionEnd'];
};

function ControlButton({
  action,
  label,
  shortcut,
  className = '',
  active = false,
  disabled = false,
  hold = false,
  onActionStart,
  onActionEnd,
}: ControlButtonProps) {
  const heldSources = useRef(new Set<string>());
  const callbacks = useRef({ onActionStart, onActionEnd });
  callbacks.current = { onActionStart, onActionEnd };

  const beginHold = (source: string) => {
    if (disabled || heldSources.current.has(source)) return;
    const wasIdle = heldSources.current.size === 0;
    heldSources.current.add(source);
    if (wasIdle) callbacks.current.onActionStart(action);
  };

  const endHold = (source: string) => {
    if (!heldSources.current.delete(source)) return;
    if (heldSources.current.size === 0) callbacks.current.onActionEnd?.(action);
  };

  const endAllHolds = () => {
    if (heldSources.current.size === 0) return;
    heldSources.current.clear();
    callbacks.current.onActionEnd?.(action);
  };

  useEffect(() => {
    if (disabled) endAllHolds();
    return endAllHolds;
  }, [disabled]);

  const pointerSource = (event: ReactPointerEvent<HTMLButtonElement>) => `pointer:${event.pointerId}`;
  const startPointerHold = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    beginHold(pointerSource(event));
  };
  const endPointerHold = (event: ReactPointerEvent<HTMLButtonElement>) => {
    endHold(pointerSource(event));
  };
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!hold || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    beginHold(`keyboard:${event.code}`);
  };
  const handleKeyUp = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!hold || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    endHold(`keyboard:${event.code}`);
  };

  return (
    <button
      type="button"
      className={`${styles.button} ${className}`}
      disabled={disabled}
      aria-pressed={active}
      data-active={active}
      onPointerDown={hold ? startPointerHold : undefined}
      onPointerUp={hold ? endPointerHold : undefined}
      onPointerCancel={hold ? endPointerHold : undefined}
      onLostPointerCapture={hold ? endPointerHold : undefined}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={hold ? endAllHolds : undefined}
      onClick={hold ? undefined : () => onActionStart(action)}
    >
      {label}
      <span className={styles.key}>{shortcut}</span>
    </button>
  );
}

export default function InteractionControls({
  disabled = false,
  speedKmh,
  braking = false,
  signal = 'OFF',
  hazardVisible = false,
  statusText,
  onActionStart,
  onActionEnd,
}: InteractionControlsProps) {
  const liveStatus = statusText || (hazardVisible ? 'Đã phát hiện nguy hiểm — xử lý ngay' : 'Quan sát sa bàn và điều khiển phương tiện');

  return (
    <section className={styles.shell} aria-label="Điều khiển sa bàn 2.5D">
      <div className={styles.hud}>
        <span className={styles.speed}>{Math.max(0, Math.round(speedKmh))} km/h</span>
        <span className={styles.status} data-alert={hazardVisible} role="status" aria-live="polite">
          {liveStatus}
        </span>
        <span aria-label={`Xi-nhan ${signal === 'OFF' ? 'đang tắt' : signal === 'LEFT' ? 'trái' : 'phải'}`}>
          {signal === 'LEFT' ? '← Nháy' : signal === 'RIGHT' ? 'Nháy →' : 'Xi-nhan: tắt'}
        </span>
      </div>

      <div className={styles.controls}>
        <div className={styles.directionPad} aria-label="Điều hướng">
          <ControlButton action="MOVE_FORWARD" label="↑ Tiến" shortcut="W / ↑" className={styles.forward} disabled={disabled} hold onActionStart={onActionStart} onActionEnd={onActionEnd} />
          <ControlButton action="STEER_LEFT" label="← Trái" shortcut="A / ←" className={styles.left} disabled={disabled} hold onActionStart={onActionStart} onActionEnd={onActionEnd} />
          <ControlButton action="MOVE_BACKWARD" label="↓ Lùi" shortcut="S / ↓" disabled={disabled} hold onActionStart={onActionStart} onActionEnd={onActionEnd} />
          <ControlButton action="STEER_RIGHT" label="Phải →" shortcut="D / →" disabled={disabled} hold onActionStart={onActionStart} onActionEnd={onActionEnd} />
        </div>

        <div className={styles.actions} aria-label="Hành động an toàn">
          <ControlButton action="BRAKE" label="Phanh" shortcut="Space" className={styles.brake} active={braking} disabled={disabled} hold onActionStart={onActionStart} onActionEnd={onActionEnd} />
          <ControlButton action="SIGNAL_LEFT" label="Xi-nhan trái" shortcut="Q" className={styles.signal} active={signal === 'LEFT'} disabled={disabled} onActionStart={onActionStart} />
          <ControlButton action="SIGNAL_RIGHT" label="Xi-nhan phải" shortcut="E" className={styles.signal} active={signal === 'RIGHT'} disabled={disabled} onActionStart={onActionStart} />
          <ControlButton action="YIELD" label="Nhường đường" shortcut="Y" className={styles.yield} disabled={disabled} onActionStart={onActionStart} />
        </div>
      </div>
    </section>
  );
}
