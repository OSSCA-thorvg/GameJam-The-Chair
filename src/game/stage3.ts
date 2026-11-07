import type { Point } from './types';
export type Fan = { x: number; y: number; width: number; period: number; phase: number; strength: number; height: number };
export const STAGE_THREE = {
    length: 2800, goal: 2680,
    checkpoints: [
        { x: 100, y: 392 },
        { x: 820, y: 392 },
        { x: 1540, y: 272 },
        { x: 2180, y: 152 },
    ],
    terrain: [
        // Safe practice floor (learn spray on flat ground).
        [{ x: -400, y: 420 }, { x: 900, y: 420 }, { x: 900, y: 800 }, { x: -400, y: 800 }],
        // Short gap then a rising platform you reach by spraying.
        [{ x: 1020, y: 420 }, { x: 1400, y: 420 }, { x: 1400, y: 800 }, { x: 1020, y: 800 }],
        // Vertical shaft wall (right side) and upper landing.
        [{ x: 1500, y: 300 }, { x: 1900, y: 300 }, { x: 1900, y: 800 }, { x: 1500, y: 800 }],
        // Rooftop deck reached by riding fan wind.
        [{ x: 2000, y: 180 }, { x: 2800, y: 180 }, { x: 2800, y: 800 }, { x: 2000, y: 800 }],
    ] satisfies Point[][],
    fans: [
        { x: 1710, y: 300, width: 160, period: 3.6, phase: 0, strength: 520, height: 300 },
        { x: 1950, y: 180, width: 150, period: 2.8, phase: Math.PI, strength: 560, height: 420 },
    ] satisfies Fan[]
};
export function floorAt(x: number) {
    if (x <= 900) return 420;
    if (x < 1020) return 800;
    if (x <= 1400) return 420;
    if (x < 1500) return 800;
    if (x <= 1900) return 300;
    if (x < 2000) return 800;
    return 180;
}
export function fanActive(fan: Fan, t: number) {
    return Math.sin(t * Math.PI * 2 / fan.period + fan.phase) > .1;
}
export function fanStrength(fan: Fan, t: number) {
    const s = Math.sin(t * Math.PI * 2 / fan.period + fan.phase);
    return Math.max(0, s) * fan.strength;
}
