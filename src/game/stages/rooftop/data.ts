import type { Point } from '../../types';
import { deepFreeze } from '../../data';

// The duct shaft (x 1240-1780) is a zig-zag chimney: ledges alternate from the left and right walls and
// meet at x 1540, so every column is roofed by some ledge and the spray cannot be held straight up through.
// Pipes close off the wall sides, and a parapet leaves only a slot under the ceiling onto the upper roof.
const blocks = [
    { id: 'room', x: -400, y: 420, width: 850, height: 380 },
    { id: 'pipe', x: 280, y: 384, width: 48, height: 36 },
    { id: 'lower', x: 450, y: 396, width: 1330, height: 404 },
    { id: 'practice', x: 850, y: 286, width: 80, height: 110 },
    { id: 'shaft-left', x: 1200, y: -650, width: 40, height: 910 },
    { id: 'right-pad', x: 1540, y: 276, width: 240, height: 28 },
    { id: 'left-pad', x: 1240, y: 106, width: 300, height: 24 },
    { id: 'duct', x: 1540, y: -64, width: 240, height: 28 },
    { id: 'high-pad', x: 1240, y: -234, width: 300, height: 24 },
    { id: 'pipe-low', x: 1700, y: 132, width: 80, height: 16 },
    { id: 'pipe-mid', x: 1240, y: -44, width: 100, height: 16 },
    { id: 'pipe-high', x: 1712, y: -262, width: 68, height: 16 },
    { id: 'upper', x: 1780, y: -144, width: 680, height: 944 },
    { id: 'parapet', x: 1780, y: -330, width: 22, height: 186 },
    { id: 'rail', x: 2440, y: -204, width: 20, height: 60 },
];

export const STAGE_THREE = deepFreeze({
    length: 3320, goal: 2920,
    entrance: { duration: 2.6, openDuration: .85, emergeAt: .55, emergeEnd: 1.8, closeAt: 1.95, closeDuration: .65, fromX: 100, toX: 235 },
    pickup: { x: 600, y: 368 },
    duct: { x: 1660, y: 226, wakeReach: 260, wakeHeight: 120, frontReach: 170, frontHeight: 80, rearReach: 45, inhaleDuration: .12, twitchDuration: .08, sneezeDuration: 1.3, repeatInhaleDuration: .06, repeatTwitchDuration: .04, repeatSneezeDuration: .5, firstKnockback: 285, repeatKnockback: 120,
        // Once awake the duct keeps sneezing on its own: a long, visible inhale, then a strong gust.
        gustPeriod: 3.4, gustInhaleDuration: .45, gustTwitchDuration: .12, gustSneezeDuration: .8, gustKnockback: 260 },
    // Steam vents in the shaft: a hiss (warn), then a blast. The wall vents sit just above a ledge, so the
    // ledge itself is a safe place to wait, and shove a chair flying past back across the shaft; the
    // ceiling vent over the exit slot presses down onto the parapet.
    // `axis` is the blast direction ('x' sideways, 'y' up/down) and `dir` its sign; `spread` is the
    // half-width across the blast.
    vents: [
        { x: 1780, y: -172, axis: 'x', dir: -1, period: 3.2, offset: 0, warn: .7, blow: .9, reach: 330, spread: 62, force: 1500 },
        { x: 1240, y: -342, axis: 'x', dir: 1, period: 3.2, offset: 1.1, warn: .7, blow: .9, reach: 330, spread: 62, force: 1500 },
        { x: 1735, y: -552, axis: 'y', dir: 1, period: 3.2, offset: 2.2, warn: .7, blow: .9, reach: 230, spread: 80, force: 1500 },
    ],
    // Printouts the first sneeze scatters over the ledges. Once the duct is awake they make these spans
    // as slippery as spilled water. Each span is the ledge top `y` from `left` to `right`. Every ledge keeps
    // a narrow bare strip under the open column, so a careful climber can always take off with grip.
    slick: [
        { left: 1550, right: 1640, y: 276 },
        { left: 1390, right: 1530, y: 106 },
        { left: 1560, right: 1640, y: -64 },
        { left: 1390, right: 1530, y: -234 },
    ],
    edge: 2460,
    launch: { left: 2230, right: 2440, shotWindow: .65 },
    ceiling: -460,
    // Extinguisher bursts allowed per time in the air; touching the ground refills them.
    airSprayLimit: 3,
    blocks,
    checkpoints: [
        { x: 100, y: 392 },
        { x: 640, y: 368 },
        { x: 1120, y: 368 },
        // Halfway up the shaft, past the duct and before the steam vents.
        { x: 1310, y: 78 },
        { x: 1860, y: -172 },
    ],
    terrain: blocks.map(b => [
        { x: b.x, y: b.y }, { x: b.x + b.width, y: b.y },
        { x: b.x + b.width, y: b.y + b.height }, { x: b.x, y: b.y + b.height },
    ]) satisfies Point[][],
});

export type DuctBurst = { kind: 'first' | 'repeat' | 'gust'; age: number };
export function ductTimings(kind: DuctBurst['kind']) {
    const d = STAGE_THREE.duct;
    if (kind === 'first') return { inhale: d.inhaleDuration, twitch: d.twitchDuration, sneeze: d.sneezeDuration };
    if (kind === 'gust') return { inhale: d.gustInhaleDuration, twitch: d.gustTwitchDuration, sneeze: d.gustSneezeDuration };
    return { inhale: d.repeatInhaleDuration, twitch: d.repeatTwitchDuration, sneeze: d.repeatSneezeDuration };
}

export type Vent = (typeof STAGE_THREE.vents)[number];
export type VentPhase = { kind: 'idle' | 'warn' | 'blow'; age: number };

// Where a vent is in its cycle at attempt time `time`: quiet, hissing, then blowing.
export function ventPhase(vent: Vent, time: number): VentPhase {
    const t = ((time - vent.offset) % vent.period + vent.period) % vent.period;
    const quiet = vent.period - vent.warn - vent.blow;
    if (t < quiet) return { kind: 'idle', age: t };
    if (t < quiet + vent.warn) return { kind: 'warn', age: t - quiet };
    return { kind: 'blow', age: t - quiet - vent.warn };
}

// Whether a point sits in the vent's blast: in front of the vent, within its reach and spread.
export function inVentBlast(vent: Vent, p: Readonly<Point>) {
    const along = vent.axis === 'x' ? p.x - vent.x : p.y - vent.y;
    const across = vent.axis === 'x' ? p.y - vent.y : p.x - vent.x;
    const ahead = along * vent.dir;
    return ahead >= 0 && ahead <= vent.reach && Math.abs(across) <= vent.spread;
}

// Whether the chair (centre `p`, wheels down) stands on one of the paper-covered spans.
export function onSlickPaper(p: Readonly<Point>, ground: boolean) {
    return ground && STAGE_THREE.slick.some(span => p.x >= span.left && p.x <= span.right && Math.abs(p.y - (span.y - 28)) < 14);
}
