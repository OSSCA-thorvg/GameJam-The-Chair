import type { RenderCtx } from '../context';
import type { Curve, Vector } from '../types';
import type { Point3, SkyProjection } from './sky-projection';
import { SIGN_FONT } from '../fonts';

// The strawberry shortcake slice on the last desk, drawn in "cake units": x runs from the low cream end (-130)
// to the high, decorated end (+130), y is down with the cake's base at -10. The 2D course art and the 3D departure
// both map these units into their own space, so the slice that turns solid is the one the player landed beside.
const INK = '#7a2f2a';
const CREAM = '#fff6f4';
const BLUSH = '#f6b7c1';
const BODY = { left: -130, right: 130, base: -10, leftTop: -124, rightTop: -112 };
const BANDS: readonly [number, number, string][] = [
    [0, .06, '#b8743a'], [.06, .2, '#fff1d6'], [.2, .42, '#ffd977'], [.33, .42, '#f2bc55'],
    [.42, .68, '#fffaf0'], [.68, .9, '#ffd977'], [.82, .9, '#f2bc55'], [.9, 1, '#c47a3a'],
];
const BERRY_ROW = .66;
const BERRIES = [-82, 0, 82];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const bodyTop = (x: number) => lerp(BODY.leftTop, BODY.rightTop, (x - BODY.left) / (BODY.right - BODY.left));
const bandY = (x: number, t: number) => lerp(bodyTop(x), BODY.base, t);

type Blob = { x: number; y: number; r: number; drip: boolean };
const BLOBS: readonly Blob[] = [
    ...Array.from({ length: 10 }, (_, i): Blob => ({
        x: lerp(-124, 122, i / 9), y: lerp(-140, -186, i / 9) + (i % 2 ? 6 : 0), r: 26 - ((9 - i) % 3) * 3, drip: false,
    })),
    ...Array.from({ length: 14 }, (_, i): Blob => {
        const x = lerp(-142, 140, i / 13);
        return { x, y: bodyTop(Math.max(BODY.left, Math.min(BODY.right, x))) - 4 + (i % 2 ? 4 : 0), r: 13, drip: true };
    }),
];
const CREAM_BASE: Vector[] = [[BODY.left - 10, BODY.leftTop - 4], [BODY.right + 10, BODY.rightTop - 4], [BODY.right, -186], [BODY.left, -140]];
const ROSETTES = [[30, -190, 17], [88, -176, 15], [-4, -178, 14]] as const;
const WAFERS = [[118, -196, 38], [100, -196, 24]] as const;
const LEAVES = [[132, -176, 25], [70, -214, -30]] as const;
const BERRY = { x: 56, y: -206, scale: 1.55 };
const FLAG = { pole: 46, top: -306, length: 112, width: 146, height: 66 };

/** The cake's local units mapped into the course art's local space. */
type Place = (x: number, y: number) => Vector;

const line = (points: Vector[]): Curve[] => points.slice(1).concat([points[0]]).map(([x, y]): Curve => [x, y, x, y, x, y]);

function strawberryCurves(place: Place, cx: number, cy: number, k: number): [Vector, Curve[]] {
    const p = (x: number, y: number) => place(cx + x * k, cy + y * k);
    const c = (a: Vector, b: Vector, d: Vector): Curve => [...p(...a), ...p(...b), ...p(...d)] as Curve;
    return [p(0, -24), [
        c([-15, -24], [-21, -12], [-18, 0]), c([-14, 12], [-6, 19], [0, 23]),
        c([6, 19], [14, 12], [18, 0]), c([21, -12], [15, -24], [0, -24]),
    ]];
}

function arch(place: Place, x: number, y: number, r: number): [Vector, Curve[]] {
    const k = r * .5523;
    const c = (a: Vector, b: Vector, d: Vector): Curve => [...place(...a), ...place(...b), ...place(...d)] as Curve;
    return [place(x - r, y), [
        c([x - r, y - k], [x - k, y - r], [x, y - r]), c([x + k, y - r], [x + r, y - k], [x + r, y]), c([x + r, y], [x - r, y], [x - r, y]),
    ]];
}

function flag2d(ctx: RenderCtx, place: Place, s: number) {
    const [px, top] = place(FLAG.pole, FLAG.top);
    const bottom = top + FLAG.length * s;
    ctx.rod(px, top, px, bottom, 6 * s, INK);
    ctx.rod(px, top, px, bottom, 3.6 * s, '#f8e4ae');
    ctx.ellipse(px, top - 3 * s, 8 * s, 8 * s, INK);
    ctx.ellipse(px, top - 3 * s, 6 * s, 6 * s, '#ffd36b');
    const w = FLAG.width * s, h = FLAG.height * s, y0 = top + 10 * s;
    const flap = Math.sin(ctx.t * 5.5) * 4 * s;
    const cloth: Vector[] = [[px - 2 * s, y0], [px - w, y0 + 4 * s + flap], [px - w, y0 + h + 4 * s + flap], [px - 2 * s, y0 + h]];
    ctx.polygon(cloth, '#d95e5c');
    ctx.strokePath(cloth[0], line(cloth), { width: 2.6 * s, color: INK }, { closed: true });
    const word = ctx.locale === 'ko' ? '승진' : 'PROMOTED';
    const room = w * .78;
    const size = Math.min(30 * s, 30 * s * room / Math.max(1, ctx.measureText(word, 30 * s)));
    ctx.text(word, px - w / 2 - s, y0 + h / 2 + 2 * s + flap / 2, size, '#fff5d8');
}

/** The shortcake slice and its promotion flag standing on the right half of the finish desk. */
export function promotionCake(ctx: RenderCtx, width: number) {
    const s = .52, cx = width / 2 - 92;
    const place: Place = (x, y) => [cx + x * s, -9 + (y - BODY.base) * s];
    const quad = (x0: number, x1: number, t0: number, t1: number): Vector[] =>
        [place(x0, bandY(x0, t0)), place(x1, bandY(x1, t0)), place(x1, bandY(x1, t1)), place(x0, bandY(x0, t1))];
    const { left, right } = BODY;
    ctx.ellipse(cx, -6, 150 * s, 9 * s, '#46546b33');
    flag2d(ctx, place, s);
    for (const [t0, t1, color] of BANDS) ctx.polygon(quad(left, right, t0, t1), color);
    for (const x of BERRIES) {
        const y = bandY(x, BERRY_ROW);
        const [start, curves] = arch(place, x, y, 24);
        ctx.effectPath(start, curves, '#e2384a');
        ctx.strokePath(start, curves, { width: 2 * s, color: INK }, { closed: true });
        const [inner, innerCurves] = arch(place, x, y, 14);
        ctx.effectPath(inner, innerCurves, '#ffd0d6');
    }
    const body = quad(left, right, 0, 1);
    ctx.strokePath(body[0], line(body), { width: 4.5 * s, color: INK }, { closed: true });
    // An ink pass a little larger than the cream, then the cream itself, so the whipped mass reads as one outline.
    const base = CREAM_BASE.map(([x, y]) => place(x, y));
    ctx.strokePath(base[0], line(base), { width: 9 * s, color: INK }, { closed: true });
    for (const b of BLOBS) { const [x, y] = place(b.x, b.y); ctx.ellipse(x, y, (b.r + 4.5) * s, (b.r + 4.5) * s, INK); }
    ctx.polygon(base, CREAM);
    for (const b of BLOBS) { const [x, y] = place(b.x, b.y); ctx.ellipse(x, y, b.r * s, b.r * s, CREAM); }
    for (const b of BLOBS) {
        const [x, y] = place(b.x, b.y);
        if (b.drip) { ctx.ellipse(x, y + 5 * s, 8 * s, 3 * s, BLUSH + 'b3'); continue; }
        ctx.ellipse(x - 6 * s, y + b.r * .45 * s, b.r * .55 * s, b.r * .28 * s, BLUSH + 'bf');
        ctx.ellipse(x + b.r * .35 * s, y - b.r * .4 * s, b.r * .3 * s, b.r * .18 * s, '#ffffff');
    }
    for (const [x0, y0, angle] of WAFERS) {
        const a = angle * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
        const at = (u: number, v: number) => place(x0 + u * c - v * sn, y0 + u * sn + v * c);
        const stick = [at(-8, -46), at(8, -46), at(8, 12), at(-8, 12)];
        ctx.polygon(stick, '#f6b14a');
        ctx.strokePath(stick[0], line(stick), { width: 3 * s, color: INK }, { closed: true });
        for (const v of [-30, -16, -2]) { const [ax, ay] = at(7, v); const [bx, by] = at(-7, v - 8); ctx.rod(ax, ay, bx, by, 3 * s, '#c9752a'); }
    }
    for (const [x0, y0, angle] of LEAVES) {
        const a = angle * Math.PI / 180;
        const leaf = Array.from({ length: 10 }, (_, i): Vector => {
            const u = i / 10 * Math.PI * 2, ex = Math.cos(u) * 14, ey = Math.sin(u) * 7.5;
            return place(x0 + ex * Math.cos(a) - ey * Math.sin(a), y0 + ex * Math.sin(a) + ey * Math.cos(a));
        });
        ctx.polygon(leaf, '#58b34a');
        ctx.strokePath(leaf[0], line(leaf), { width: 2.4 * s, color: '#2f6b2a' }, { closed: true });
    }
    for (const [x0, y0, r] of ROSETTES) {
        const [x, y] = place(x0, y0);
        ctx.ellipse(x, y, (r + 3) * s, (r + 3) * s, INK);
        ctx.ellipse(x, y, r * s, r * s, CREAM);
        ctx.strokePath([x - r * .6 * s, y], [[x - r * .3 * s, y - r * .9 * s, x + r * .3 * s, y - r * .9 * s, x + r * .6 * s, y]],
            { width: 2.4 * s, color: '#f0a6b2', cap: 'round' });
    }
    const [start, curves] = strawberryCurves(place, BERRY.x, BERRY.y, BERRY.scale);
    ctx.effectPath(start, curves, ctx.radialFill(...place(BERRY.x - 8, BERRY.y - 10), 34 * s,
        [[0, '#ff7a85'], [.6, '#e2384a'], [1, '#b02234']]));
    ctx.strokePath(start, curves, { width: 3.4 * s, color: INK }, { closed: true });
    const k = BERRY.scale;
    const calyx: Vector[] = [[-12, -22], [-5, -31], [0, -23], [6, -32], [12, -22], [4, -19], [-4, -19]]
        .map(([x, y]) => place(BERRY.x + x * k, BERRY.y + y * k));
    ctx.polygon(calyx, '#5aa64a');
    ctx.strokePath(calyx[0], line(calyx), { width: 2.4 * s, color: '#2f6b2a' }, { closed: true });
    for (const [x, y] of [[-8, -7], [6, -9], [-2, 3], [9, 4], [-10, 7], [1, 13]]) {
        const [sx, sy] = place(BERRY.x + x * k, BERRY.y + y * k);
        ctx.ellipse(sx, sy, 1.9 * s, 1.9 * s, '#ffe2a0');
    }
    const [hx, hy] = place(BERRY.x - 7 * k, BERRY.y - 12 * k);
    ctx.ellipse(hx, hy, 5 * s, 8 * s, '#ffffff73');
}

/**
 * The same slice, now solid, on the departing ledge. It turns a little as it drifts away so its depth shows:
 * the flat cake from the course was a real one all along. `place` carries the ledge's retreat.
 */
export function departureCake(ctx: RenderCtx, view: SkyProjection, place: (p: Point3) => Point3, progress: number) {
    const s = .55, cx = 168, floor = -80, z0 = -70, half = 36;
    const turn = -.75 * Math.min(1, progress * 1.8) ** 2 * (3 - 2 * Math.min(1, progress * 1.8));
    const c = Math.cos(turn), sn = Math.sin(turn);
    const at = (x: number, y: number, z = 0): Point3 => {
        const lx = x * s, lz = z;
        return place([cx + lx * c - lz * sn, floor - (y - BODY.base) * s, z0 + lx * sn + lz * c]);
    };
    const yaw = (p: Point3) => at(p[0], p[1], p[2]);
    for (const [t0, t1, color] of BANDS) {
        if (t1 - t0 < .1 && t0 > 0) continue;
        const outline: [number, number][] = [
            [BODY.left, bandY(BODY.left, t0)], [BODY.right, bandY(BODY.right, t0)],
            [BODY.right, bandY(BODY.right, t1)], [BODY.left, bandY(BODY.left, t1)],
        ];
        view.profile(outline, half, color, 0, { bevel: 1, place: yaw });
    }
    for (const x of BERRIES) {
        const y = bandY(x, BERRY_ROW);
        const ring = (r: number, z: number) => Array.from({ length: 9 }, (_, i): Point3 => {
            const a = Math.PI * i / 8;
            return at(x - Math.cos(a) * r, y - Math.sin(a) * r, z);
        });
        view.polygon(ring(24, half + .5), '#e2384aff');
        view.polygon(ring(14, half + .8), '#ffd0d6ff');
    }
    view.profile(CREAM_BASE, half, CREAM, 0, { bevel: 1, place: yaw });
    for (const b of BLOBS) for (const z of [-half * .55, half * .55]) {
        view.oval(at(b.x, b.y, z), [b.r * s, b.r * s, half * .62], b.drip ? '#fbe3e6' : CREAM);
    }
    for (const [x, y, r] of ROSETTES) view.oval(at(x, y, half * .3), [r * s, r * s, r * s], '#fffdfb');
    for (const [x, y, angle] of WAFERS) {
        const a = angle * Math.PI / 180;
        view.rod(at(x - 46 * -Math.sin(a), y - 46 * Math.cos(a), -6), at(x + 12 * -Math.sin(a), y + 12 * Math.cos(a), -6), 8 * s, '#f6b14a');
    }
    for (const [x, y] of LEAVES) view.oval(at(x, y, half * .4), [14 * s, 7 * s, 9 * s], '#58b34a');
    const k = BERRY.scale;
    view.oval(at(BERRY.x, BERRY.y + 6, half * .55), [18 * k * s, 23 * k * s, 18 * k * s], '#e2384a');
    view.oval(at(BERRY.x, BERRY.y - 18 * k, half * .55), [11 * k * s, 4 * k * s, 11 * k * s], '#5aa64a');
    const poleTop = at(FLAG.pole, FLAG.top, 0), poleBottom = at(FLAG.pole, FLAG.top + FLAG.length, 0);
    view.rod(poleBottom, poleTop, 3 * s, '#f8e4ae');
    view.oval(at(FLAG.pole, FLAG.top - 3, 0), [7 * s, 7 * s, 7 * s], '#ffd36b');
    const flap = Math.sin(ctx.t * 5.5) * 4;
    const y0 = FLAG.top + 10;
    const cloth = [
        at(FLAG.pole - 2, y0), at(FLAG.pole - FLAG.width, y0 + 4 + flap),
        at(FLAG.pole - FLAG.width, y0 + FLAG.height + 4 + flap), at(FLAG.pole - 2, y0 + FLAG.height),
    ];
    view.polygon(cloth, '#d95e5cff');
    return () => {
        const [a, b, cc, d] = cloth.map(view.project);
        const centre: Vector = [(a[0] + b[0] + cc[0] + d[0]) / 4, (a[1] + b[1] + cc[1] + d[1]) / 4];
        const across = Math.hypot(b[0] - a[0], b[1] - a[1]), tall = Math.hypot(d[0] - a[0], d[1] - a[1]);
        const word = ctx.locale === 'ko' ? '승진' : 'PROMOTED';
        const size = Math.min(tall * .55, across * .78 / Math.max(.01, ctx.textWidth(word, SIGN_FONT)));
        if (size < 4) return;
        const rotation = Math.atan2(a[1] - b[1], a[0] - b[0]);
        ctx.screenText(word, centre[0], centre[1], size, '#fff5d8', { rotation, opacity: 1 - progress * progress });
    };
}
