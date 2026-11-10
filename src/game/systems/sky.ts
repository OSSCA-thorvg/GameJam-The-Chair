import { STAGE_FOUR } from '../stage4';
import type { Player, Point } from '../types';

// Hovering above the clouds: left/right drift the chair, the extinguisher keeps it bobbing in place.
export function skyStep(player: Readonly<Player>, direction: number, time: number, length: number, dt: number): { p: Player; sprayDir: Point; speed: number } {
    const p = { ...player };
    p.vx += direction * 220 * dt;
    p.vx *= Math.exp(-1.4 * dt);
    p.vx = Math.max(-160, Math.min(160, p.vx));
    p.x = Math.max(80, Math.min(length - 80, p.x + p.vx * dt));
    const hoverY = STAGE_FOUR.spawn.y + Math.sin(time * 1.3) * 6;
    const targetSpeed = (hoverY - p.y) * 2;
    p.vy += (targetSpeed - p.vy) * (1 - Math.exp(-2.5 * dt));
    p.y += p.vy * dt;
    p.a += (direction * .06 - p.a) * (1 - Math.exp(-4 * dt));
    p.w = 0;
    const tilt = Math.hypot(direction * .35, 1);
    return { p, sprayDir: { x: -direction * .35 / tilt, y: 1 / tilt }, speed: Math.abs(p.vx) };
}
