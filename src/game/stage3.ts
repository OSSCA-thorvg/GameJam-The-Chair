import type { Point } from './types';
import { deepFreeze } from './freeze';

const blocks = [
    { id: 'room', x: -400, y: 420, width: 850, height: 380 },
    { id: 'pipe', x: 280, y: 384, width: 48, height: 36 },
    { id: 'lower', x: 450, y: 396, width: 1330, height: 404 },
    { id: 'practice', x: 850, y: 286, width: 80, height: 110 },
    { id: 'shaft-left', x: 1200, y: -650, width: 40, height: 910 },
    { id: 'right-pad', x: 1510, y: 276, width: 270, height: 28 },
    { id: 'left-pad', x: 1240, y: 136, width: 160, height: 28 },
    { id: 'duct', x: 1510, y: -4, width: 270, height: 32 },
    { id: 'upper', x: 1780, y: -144, width: 680, height: 944 },
    { id: 'rail', x: 2440, y: -204, width: 20, height: 60 },
];

export const STAGE_THREE = deepFreeze({
    length: 3320, goal: 2920,
    entrance: { duration: 2.6, openDuration: .85, emergeAt: .55, emergeEnd: 1.8, closeAt: 1.95, closeDuration: .65, fromX: 100, toX: 235 },
    pickup: { x: 600, y: 368 },
    duct: { x: 1660, y: 226, frontReach: 170, frontHeight: 80, inhaleDuration: .12, twitchDuration: .08, sneezeDuration: 1.3, repeatInhaleDuration: .06, repeatTwitchDuration: .04, repeatSneezeDuration: .5, firstKnockback: 285, repeatKnockback: 120 },
    edge: 2460,
    launch: { left: 2230, right: 2440, shotWindow: .65 },
    ceiling: -460,
    blocks,
    checkpoints: [
        { x: 100, y: 392 },
        { x: 640, y: 368 },
        { x: 1120, y: 368 },
        { x: 1860, y: -172 },
    ],
    terrain: blocks.map(b => [
        { x: b.x, y: b.y }, { x: b.x + b.width, y: b.y },
        { x: b.x + b.width, y: b.y + b.height }, { x: b.x, y: b.y + b.height },
    ]) satisfies Point[][],
});

export type DuctBurst = { kind: 'first' | 'repeat'; age: number };
export function ductTimings(kind: DuctBurst['kind']) {
    const d = STAGE_THREE.duct;
    return kind === 'first'
        ? { inhale: d.inhaleDuration, twitch: d.twitchDuration, sneeze: d.sneezeDuration }
        : { inhale: d.repeatInhaleDuration, twitch: d.repeatTwitchDuration, sneeze: d.repeatSneezeDuration };
}
