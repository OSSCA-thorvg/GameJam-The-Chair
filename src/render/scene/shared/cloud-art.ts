import type { RenderCtx } from '../../context';
import type { Curve, Vector } from '../../types';

export type CloudTone = {
    top: string;
    middle: string;
    belly: string;
    highlight: string;
    rim: string;
};

export const CLOUD_TONES = {
    dusk: {
        top: '#fff2df',
        middle: '#f2cdbf',
        belly: '#a99bb8',
        highlight: '#fff9ee',
        rim: '#ffe4bd',
    },
    ascent: {
        top: '#fdf8ef',
        middle: '#ebe4e2',
        belly: '#b3bdd2',
        highlight: '#ffffff',
        rim: '#fff1d6',
    },
    bread: {
        top: '#f8d98d',
        middle: '#d9943b',
        belly: '#8f4823',
        highlight: '#fff0bd',
        rim: '#ffe4a3',
    },
} satisfies Record<string, CloudTone>;

function mixHex(from: string, to: string, amount: number) {
    const channel = (hex: string, index: number) =>
        parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
    return (
        '#' +
        [0, 1, 2]
            .map((index) =>
                Math.round(
                    channel(from, index) +
                        (channel(to, index) - channel(from, index)) * amount,
                )
                    .toString(16)
                    .padStart(2, '0'),
            )
            .join('')
    );
}

export function blendCloudTone(
    from: CloudTone,
    to: CloudTone,
    amount: number,
): CloudTone {
    const t = Math.max(0, Math.min(1, amount));
    return {
        top: mixHex(from.top, to.top, t),
        middle: mixHex(from.middle, to.middle, t),
        belly: mixHex(from.belly, to.belly, t),
        highlight: mixHex(from.highlight, to.highlight, t),
        rim: mixHex(from.rim, to.rim, t),
    };
}

export type CloudOptions = {
    alpha?: number;
    fade?: boolean;
    detail?: 'auto' | 'full' | 'reduced';
};

type Puff = { x: number; y: number; r: number };
type CloudShape = {
    start: Vector;
    outline: Curve[];
    crestStart: Vector;
    crest: Curve[];
    puffs: Puff[];
    top: number;
    bottom: number;
};

const FLAT_BOTTOM = 34;
const shapes = new Map<string, CloudShape>();

export function seeded(seed: number) {
    let a = (Math.imul(seed | 0, 0x9e3779b1) ^ 0x5bd1e995) >>> 0;
    return (): number => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

type Lump = { x: number; y: number; rx: number; ry: number };

function envelope(
    lumps: readonly Lump[],
    x: number,
    side: -1 | 1,
): number | null {
    let edge: number | null = null;
    for (const l of lumps) {
        const u = (x - l.x) / l.rx;
        if (u * u > 1) {
            continue;
        }
        const y = l.y + side * l.ry * Math.sqrt(1 - u * u);
        if (edge === null || (side < 0 ? y < edge : y > edge)) {
            edge = y;
        }
    }
    return edge;
}

function smoothLoop(points: Vector[], from: number, to: number): Curve[] {
    const n = points.length;
    const at = (i: number) => points[((i % n) + n) % n];
    const curves: Curve[] = [];
    for (let i = from; i < to; i++) {
        const p0 = at(i - 1);
        const p1 = at(i);
        const p2 = at(i + 1);
        const p3 = at(i + 2);
        curves.push([
            p1[0] + (p2[0] - p0[0]) / 6,
            p1[1] + (p2[1] - p0[1]) / 6,
            p2[0] - (p3[0] - p1[0]) / 6,
            p2[1] - (p3[1] - p1[1]) / 6,
            p2[0],
            p2[1],
        ]);
    }
    return curves;
}

function buildShape(seed: number, samples: number): CloudShape {
    const random = seeded(seed);
    const count = 4 + Math.floor(random() * 3);
    const width = 230 + random() * 130;
    const peak = 0.25 + random() * 0.5;
    const puffs: Puff[] = [];
    for (let i = 0; i < count; i++) {
        const along = i / (count - 1);
        const swell = Math.max(0.2, 1 - Math.abs(along - peak) * 1.5);
        const r = Math.max(
            (width / (count - 1)) * (0.52 + random() * 0.14),
            (24 + 54 * swell) * (0.7 + random() * 0.6),
        );
        const x =
            -width / 2 +
            width * along +
            (((random() - 0.5) * width) / count) * 0.4;
        puffs.push({ x, y: 18 - r * (0.42 + random() * 0.3), r });
    }
    const base = { x: (random() - 0.5) * 20, y: 10, rx: width * 0.42, ry: 26 };
    const lumps: Lump[] = [
        ...puffs.map((p) => ({ x: p.x, y: p.y, rx: p.r, ry: p.r })),
        base,
    ];
    const left = Math.min(...lumps.map((l) => l.x - l.rx)) + 0.01;
    const right = Math.max(...lumps.map((l) => l.x + l.rx)) - 0.01;
    const xs = Array.from({ length: samples + 1 }, (_, k) => {
        const u = k / samples;
        return (
            left + ((right - left) * (u + (1 - Math.cos(Math.PI * u)) / 2)) / 2
        );
    });
    const crown: Vector[] = [];
    const belly: Vector[] = [];
    for (const x of xs) {
        const top = envelope(lumps, x, -1);
        const under = envelope(lumps, x, 1);
        if (top === null || under === null) {
            continue;
        }
        crown.push([x, top]);
        belly.push([x, Math.min(FLAT_BOTTOM, under)]);
    }
    const points = [...crown, ...belly.slice(1, -1).reverse()];
    const crestFrom = Math.round(crown.length * 0.05);
    const crestTo = Math.round(crown.length * 0.95);
    return {
        start: points[0],
        outline: smoothLoop(points, 0, points.length),
        crestStart: points[crestFrom],
        crest: smoothLoop(points, crestFrom, crestTo),
        puffs,
        top: Math.min(...crown.map((p) => p[1])),
        bottom: FLAT_BOTTOM,
    };
}

function shapeFor(seed: number, detail: 'full' | 'reduced') {
    const key = `${seed}:${detail}`;
    let shape = shapes.get(key);
    if (!shape) {
        if (shapes.size > 256) {
            shapes.clear();
        }
        shapes.set(
            key,
            (shape = buildShape(seed, detail === 'full' ? 64 : 32)),
        );
    }
    return shape;
}

function circle(x: number, y: number, r: number): [Vector, Curve[]] {
    const k = r * 0.5523;
    return [
        [x - r, y],
        [
            [x - r, y - k, x - k, y - r, x, y - r],
            [x + k, y - r, x + r, y - k, x + r, y],
            [x + r, y + k, x + k, y + r, x, y + r],
            [x - k, y + r, x - r, y + k, x - r, y],
        ],
    ];
}

export function puffCloud(
    ctx: RenderCtx,
    x: number,
    y: number,
    size: number,
    seed: number,
    tone: CloudTone,
    options: CloudOptions = {},
): void {
    const projected = size * ctx.localScale * ctx.scale;
    const detail =
        options.detail === 'full' ||
        (options.detail !== 'reduced' && projected >= 0.9)
            ? 'full'
            : 'reduced';
    const shape = shapeFor(seed, detail);
    const alpha = options.alpha ?? 1;
    const ox = ctx.ox;
    const oy = ctx.oy;
    const scale = ctx.localScale;
    const rotation = ctx.rotation;
    ctx.ox = x;
    ctx.oy = y;
    ctx.localScale = size;
    ctx.rotation = 0;

    ctx.effectPath(
        shape.start,
        shape.outline,
        ctx.gradientFill(
            0,
            shape.top,
            0,
            shape.bottom,
            [
                [0, tone.top],
                [0.5, tone.middle],
                [1, options.fade ? ctx.tint(tone.belly, 0) : tone.belly],
            ],
            alpha,
        ),
    );
    if (!options.fade) {
        ctx.effectPath(
            shape.start,
            shape.outline,
            ctx.gradientFill(
                0,
                shape.bottom - 32,
                0,
                shape.bottom,
                [
                    [0, ctx.tint(tone.belly, 0)],
                    [1, ctx.tint(tone.belly, 0.55)],
                ],
                alpha,
            ),
        );
    }
    const litPuffs =
        detail === 'full'
            ? shape.puffs
            : shape.puffs.filter((_, index) => index % 2 === 0);
    for (const puff of litPuffs) {
        const cx = puff.x - puff.r * 0.16;
        const cy = puff.y - puff.r * 0.2;
        const r = puff.r * 0.72;
        const [start, curves] = circle(cx, cy, r);
        ctx.effectPath(
            start,
            curves,
            ctx.radialFill(
                cx - r * 0.25,
                cy - r * 0.3,
                r * 1.05,
                [
                    [0, ctx.tint(tone.highlight, 0.8)],
                    [0.55, ctx.tint(tone.highlight, 0.22)],
                    [1, ctx.tint(tone.highlight, 0)],
                ],
                alpha,
            ),
        );
    }
    ctx.strokePath(shape.crestStart, shape.crest, {
        width: 2.2,
        color: ctx.tint(tone.rim, 0.7 * alpha),
        cap: 'round',
    });

    ctx.ox = ox;
    ctx.oy = oy;
    ctx.localScale = scale;
    ctx.rotation = rotation;
}

export function breadCloud(
    ctx: RenderCtx,
    x: number,
    y: number,
    size: number,
    seed: number,
    near = false,
): void {
    puffCloud(ctx, x, y, size, seed, CLOUD_TONES.bread, {
        alpha: near ? 0.95 : 0.72,
        fade: true,
    });
}
