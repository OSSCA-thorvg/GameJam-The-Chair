// Every sky cloud in the game is drawn here. Each seed grows its own lumpy silhouette from overlapping
// puffs, so no two clouds share a shape, while the same seed always yields the same cloud (no flicker).
import type { RenderCtx } from '../context';
import type { Curve, Vector } from '../types';

export type CloudTone = {
    /** Sunlit crown. */
    top: string;
    /** Body colour where the crown turns away from the light. */
    middle: string;
    /** Shadowed underside. */
    belly: string;
    /** Soft glow on each puff, offset toward the light. */
    highlight: string;
    /** Thin rim of light along the crest. */
    rim: string;
};

export const CLOUD_TONES = {
    /** Rooftop dusk: peach light, lilac shadow. */
    dusk: { top: '#fff2df', middle: '#f2cdbf', belly: '#a99bb8', highlight: '#fff9ee', rim: '#ffe4bd' },
    /** The climb from the rooftop: almost white, cool shadow. */
    ascent: { top: '#fdf8ef', middle: '#ebe4e2', belly: '#b3bdd2', highlight: '#ffffff', rim: '#fff1d6' },
    /** Above the clouds in stage 4: warm daylight. */
    day: { top: '#fcefe0', middle: '#e3cdd2', belly: '#a6b7d1', highlight: '#fff8ea', rim: '#fff2da' },
} satisfies Record<string, CloudTone>;

export type CloudOptions = {
    /** Overall opacity, 0..1. */
    alpha?: number;
    /** Fade the underside to transparent so the cloud melts into the sky below it. */
    fade?: boolean;
};

type Puff = { x: number; y: number; r: number };
type CloudShape = { start: Vector; outline: Curve[]; crestStart: Vector; crest: Curve[]; puffs: Puff[]; top: number; bottom: number };

const SAMPLES = 64;
const FLAT_BOTTOM = 34;
const shapes = new Map<number, CloudShape>();

// mulberry32: tiny seeded generator so render-side randomness stays repeatable.
function seeded(seed: number) {
    let a = (Math.imul(seed | 0, 0x9e3779b1) ^ 0x5bd1e995) >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

type Lump = { x: number; y: number; rx: number; ry: number };

// Upper (-1) or lower (+1) edge of the union of lumps at `x`; null where nothing covers it.
function envelope(lumps: readonly Lump[], x: number, side: -1 | 1): number | null {
    let edge: number | null = null;
    for (const l of lumps) {
        const u = (x - l.x) / l.rx;
        if (u * u > 1) continue;
        const y = l.y + side * l.ry * Math.sqrt(1 - u * u);
        if (edge === null || (side < 0 ? y < edge : y > edge)) edge = y;
    }
    return edge;
}

// Closed Catmull-Rom spline through the samples, as cubic Béziers.
function smoothLoop(points: Vector[], from: number, to: number): Curve[] {
    const n = points.length, at = (i: number) => points[((i % n) + n) % n];
    const curves: Curve[] = [];
    for (let i = from; i < to; i++) {
        const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
        curves.push([
            p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
            p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
            p2[0], p2[1],
        ]);
    }
    return curves;
}

function buildShape(seed: number): CloudShape {
    const random = seeded(seed);
    const count = 4 + Math.floor(random() * 3);
    const width = 230 + random() * 130;
    const peak = .25 + random() * .5;
    const puffs: Puff[] = [];
    for (let i = 0; i < count; i++) {
        const along = i / (count - 1);
        const swell = Math.max(.2, 1 - Math.abs(along - peak) * 1.5);
        // Neighbouring puffs always overlap, so the crown dips between them instead of splitting.
        const r = Math.max(width / (count - 1) * .62, (30 + 44 * swell) * (.82 + random() * .36));
        const x = -width / 2 + width * along + (random() - .5) * width / count * .4;
        puffs.push({ x, y: 18 - r * (.42 + random() * .3), r });
    }
    // A flattened base ties the puffs together so the underside stays continuous.
    const base = { x: (random() - .5) * 20, y: 10, rx: width * .42, ry: 26 };
    const lumps: Lump[] = [...puffs.map(p => ({ x: p.x, y: p.y, rx: p.r, ry: p.r })), base];
    const left = Math.min(...lumps.map(l => l.x - l.rx)) + .01, right = Math.max(...lumps.map(l => l.x + l.rx)) - .01;
    // Half-cosine spacing adds samples where the silhouette turns steeply at both ends.
    const xs = Array.from({ length: SAMPLES + 1 }, (_, k) => {
        const u = k / SAMPLES;
        return left + (right - left) * (u + (1 - Math.cos(Math.PI * u)) / 2) / 2;
    });
    const crown: Vector[] = [], belly: Vector[] = [];
    for (const x of xs) {
        const top = envelope(lumps, x, -1), under = envelope(lumps, x, 1);
        if (top === null || under === null) continue;
        crown.push([x, top]);
        belly.push([x, Math.min(FLAT_BOTTOM, under)]);
    }
    // Over the top left to right, then back along the underside.
    const points = [...crown, ...belly.slice(1, -1).reverse()];
    const crestFrom = Math.round(crown.length * .05), crestTo = Math.round(crown.length * .95);
    return {
        start: points[0],
        outline: smoothLoop(points, 0, points.length),
        crestStart: points[crestFrom],
        crest: smoothLoop(points, crestFrom, crestTo),
        puffs,
        top: Math.min(...crown.map(p => p[1])),
        bottom: FLAT_BOTTOM,
    };
}

function shapeFor(seed: number) {
    let shape = shapes.get(seed);
    if (!shape) {
        // Stage 4 keeps minting ids as clouds scroll past; old shapes are cheap to rebuild.
        if (shapes.size > 256) shapes.clear();
        shapes.set(seed, shape = buildShape(seed));
    }
    return shape;
}

function circle(x: number, y: number, r: number): [Vector, Curve[]] {
    const k = r * .5523;
    return [[x - r, y], [
        [x - r, y - k, x - k, y - r, x, y - r], [x + k, y - r, x + r, y - k, x + r, y],
        [x + r, y + k, x + k, y + r, x, y + r], [x - k, y + r, x - r, y + k, x - r, y],
    ]];
}

/** Draws one cloud centred on (x, y); `size` 1 is roughly 300 units wide. The same seed gives the same cloud. */
export function puffCloud(ctx: RenderCtx, x: number, y: number, size: number, seed: number, tone: CloudTone, options: CloudOptions = {}) {
    const shape = shapeFor(seed);
    const alpha = options.alpha ?? 1;
    const ox = ctx.ox, oy = ctx.oy, scale = ctx.localScale, rotation = ctx.rotation;
    ctx.ox = x; ctx.oy = y; ctx.localScale = size; ctx.rotation = 0;

    // Body: lit crown to shadowed belly.
    ctx.effectPath(shape.start, shape.outline, ctx.gradientFill(0, shape.top, 0, shape.bottom, [
        [0, tone.top], [.5, tone.middle], [1, options.fade ? ctx.tint(tone.belly, 0) : tone.belly],
    ], alpha));
    // Underside shade: a slightly darker band hugging the flat base.
    if (!options.fade) {
        ctx.effectPath(shape.start, shape.outline, ctx.gradientFill(0, shape.bottom - 32, 0, shape.bottom, [
            [0, ctx.tint(tone.belly, 0)], [1, ctx.tint(tone.belly, .55)],
        ], alpha));
    }
    // Each puff catches the light up and to the left, which gives the cloud its volume.
    for (const puff of shape.puffs) {
        const cx = puff.x - puff.r * .16, cy = puff.y - puff.r * .2, r = puff.r * .72;
        const [start, curves] = circle(cx, cy, r);
        ctx.effectPath(start, curves, ctx.radialFill(cx - r * .25, cy - r * .3, r * 1.05, [
            [0, ctx.tint(tone.highlight, .8)], [.55, ctx.tint(tone.highlight, .22)], [1, ctx.tint(tone.highlight, 0)],
        ], alpha));
    }
    // Rim light along the crest only.
    ctx.strokePath(shape.crestStart, shape.crest, { width: 2.2, color: ctx.tint(tone.rim, .7 * alpha), cap: 'round' });

    ctx.ox = ox; ctx.oy = oy; ctx.localScale = scale; ctx.rotation = rotation;
}
