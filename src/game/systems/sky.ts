import type { GameCore } from '../core';
import { STAGE_FOUR } from '../stage4';

export function skyStep(s: GameCore, dt: number) {
    const direction = (s.keys.includes('right') ? 1 : 0) - (s.keys.includes('left') ? 1 : 0);
    const p = s.p;
    p.vx += direction * 220 * dt;
    p.vx *= Math.exp(-1.4 * dt);
    p.vx = Math.max(-160, Math.min(160, p.vx));
    p.x = Math.max(80, Math.min(s.LEN - 80, p.x + p.vx * dt));
    const hoverY = STAGE_FOUR.spawn.y + Math.sin(s.time * 1.3) * 6;
    const targetSpeed = (hoverY - p.y) * 2;
    p.vy += (targetSpeed - p.vy) * (1 - Math.exp(-2.5 * dt));
    p.y += p.vy * dt;
    p.a += (direction * .06 - p.a) * (1 - Math.exp(-4 * dt));
    p.w = 0;
    s.ground = false;
    s.jumpQ = 0;
    s.sprayBurst = .24;
    const length = Math.hypot(direction * .35, 1);
    s.sprayDir = { x: -direction * .35 / length, y: 1 / length };
    s.actualSpeed = Math.abs(p.vx);
}
