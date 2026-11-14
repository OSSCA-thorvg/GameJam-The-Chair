import type { Point } from '../../types';
import { deepFreeze } from '../../data';
import * as Det from '../../math';

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
    // The billboard's maintenance catwalk continues the roof out under the board.
    { id: 'catwalk', x: 2460, y: -144, width: 480, height: 12 },
];

export const STAGE_THREE = deepFreeze({
    length: 3320, goal: 2920,
    entrance: { duration: 2.6, openDuration: .85, emergeAt: .55, emergeEnd: 1.8, closeAt: 1.95, closeDuration: .65, fromX: 100, toX: 235 },
    pickup: { x: 600, y: 368 },
    // The duct runs on a timer and ignores the rider: `firstSneezeAt` seconds into the attempt it gives its
    // first big sneeze (scattering the overtime junk), then gusts again `gustPeriod` after each sneeze ends:
    // a long, visible inhale, then a strong gust.
    duct: { x: 1660, y: 226, firstSneezeAt: 6, inhaleDuration: .12, twitchDuration: .08, sneezeDuration: 1.3, firstKnockback: 285,
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
    // The company's sales chart: a rooftop billboard whose board starts at the roof edge and hangs out over
    // the street, held by a steel tower on the roof and struts from the facade. Its line already climbs
    // from the roof surface toward the top right, ending in an arrow. Rolling (or dropping) onto the line
    // inside the sign (points up to `catchUntil`) makes sales surge: the line carries the chair up, bursts
    // out of the top of the sign and its last stretch points straight up into the climb.
    // The ride accelerates from `startSpeed` to `topSpeed`; the bright line tip leads the chair by `lead`.
    graph: {
        points: [
            { x: 2460, y: -144 }, { x: 2540, y: -176 }, { x: 2580, y: -164 }, { x: 2660, y: -260 },
            { x: 2695, y: -240 }, { x: 2765, y: -380 }, { x: 2795, y: -360 }, { x: 2865, y: -540 },
            { x: 2880, y: -760 }, { x: 2886, y: -1000 },
        ],
        catchUntil: 7,
        catchBelow: 10, catchAbove: 30,
        startSpeed: 220, topSpeed: 820, accel: 480, lead: 130,
        // The chair leans with the line but never further than this, so it reads as riding up, not flipping.
        maxTilt: .75,
    },
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

export type DuctBurst = { kind: 'first' | 'gust'; age: number };
export function ductTimings(kind: DuctBurst['kind']) {
    const d = STAGE_THREE.duct;
    if (kind === 'first') return { inhale: d.inhaleDuration, twitch: d.twitchDuration, sneeze: d.sneezeDuration };
    return { inhale: d.gustInhaleDuration, twitch: d.gustTwitchDuration, sneeze: d.gustSneezeDuration };
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

export function inVentBlast(vent: Vent, p: Readonly<Point>) {
    const along = vent.axis === 'x' ? p.x - vent.x : p.y - vent.y;
    const across = vent.axis === 'x' ? p.y - vent.y : p.x - vent.x;
    const ahead = along * vent.dir;
    return ahead >= 0 && ahead <= vent.reach && Math.abs(across) <= vent.spread;
}

export function onSlickPaper(p: Readonly<Point>, ground: boolean) {
    return ground && STAGE_THREE.slick.some(span => p.x >= span.left && p.x <= span.right && Math.abs(p.y - (span.y - 28)) < 14);
}

// The sales graph as a polyline: cumulative length at each point.
const GRAPH = STAGE_THREE.graph.points;
const GRAPH_DIST = GRAPH.reduce<number[]>((acc, point, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + Det.hypot(point.x - GRAPH[i - 1].x, point.y - GRAPH[i - 1].y));
    return acc;
}, []);
export const GRAPH_LENGTH = GRAPH_DIST[GRAPH_DIST.length - 1];
// Arc-length positions of the line's corners, for the art (peaks light up once the chair passes).
export const GRAPH_CORNERS: readonly number[] = GRAPH_DIST;

// Point and unit tangent at arc length `dist` along the graph (clamped to the line).
export function graphPointAt(dist: number): { x: number; y: number; tx: number; ty: number } {
    const d = Math.max(0, Math.min(GRAPH_LENGTH, dist));
    let i = 1;
    while (i < GRAPH.length - 1 && GRAPH_DIST[i] < d) i++;
    const a = GRAPH[i - 1], b = GRAPH[i];
    const span = GRAPH_DIST[i] - GRAPH_DIST[i - 1];
    const k = span > 0 ? (d - GRAPH_DIST[i - 1]) / span : 0;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, tx: (b.x - a.x) / span, ty: (b.y - a.y) / span };
}

// Where a chair (centre `p`) rolling or dropping onto the line inside the sign boards it, as an arc
// length, or null when its wheels are not on the line.
export function graphCatch(p: Readonly<Point>): number | null {
    const g = STAGE_THREE.graph;
    for (let i = 1; i <= g.catchUntil; i++) {
        const a = GRAPH[i - 1], b = GRAPH[i];
        if (p.x < a.x || p.x > b.x) continue;
        const k = (p.x - a.x) / (b.x - a.x);
        const wheels = p.y + 28, line = a.y + (b.y - a.y) * k;
        if (wheels < line - g.catchBelow || wheels > line + g.catchAbove) return null;
        return GRAPH_DIST[i - 1] + Det.hypot(p.x - a.x, line - a.y);
    }
    return null;
}
