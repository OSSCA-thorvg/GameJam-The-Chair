import type { RenderCtx } from '../context';
import type { Player } from '../../game/types';
import type { Color, DrawCommand, LayerSpec, Vector } from '../types';
import { STAGE_FIVE } from '../../game/stages/orbit/data';
import { satelliteLightArrival } from '../../game/stages/orbit/course/decide';
import type { RoutePoint } from './orbit-watch';
import type { SkyProjection } from './sky-projection';

type Beam = typeof STAGE_FIVE.satelliteLight.beams[number];
export type Aim = { x: number; y: number };

// The course checks each beam as a rectangle on the play plane at the chair's depth, aimed where the chair was.
// Everything here is drawn from the same rectangle, so what lights up on that plane is exactly what touches the chair.

const P = STAGE_FIVE.satelliteLight;
/** The satellites hang this far above the middle of the plane. */
const LENS_UP = 560;
/** The satellite rides this far ahead of the chair while its beam is on, so it stays in view. */
const LEAD = 650;
/** A beam's shaft shows in the distance this many seconds before its warning starts; its satellite earlier still. */
const SHAFT_LEAD = .8, SATELLITE_LEAD = 2.2;
/** The first satellite is already in sight this far ahead, so it turns up with the other watchers in the reveal. */
const FIRST_SIGHT = 2400;
/** Seconds the rectangle takes to fold away once the chair is through it. */
const FOLD = .35;

const WARM = '#fff3c4', PALE = '#ffe9a8', GOLD = '#ffd66e', EDGE = '#ffe08a', SHADE = '#6b4a12';
const PLANE: LayerSpec = { key: 'orbit-satellite-light-plane' };

const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};
const hex = (color: string, alpha: number) => color + Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');

/** Where a beam's satellite is: over its aim, riding just ahead of the chair while the beam is on. */
export function satelliteSpot(beam: Beam, aim: Aim, travel: number) {
    return { x: aim.x, y: LENS_UP, z: Math.max(beam.from, Math.min(beam.to, travel + LEAD)) };
}

/**
 * The satellites worth drawing: each from a little before it takes aim until the chair is through its beam, so
 * only the next one or two are ever up. `speed` turns the distance to each beam into seconds.
 */
export function satelliteSpots(aims: readonly Aim[], travel: number, speed: number) {
    return P.beams.flatMap((b, i) => travel < b.to && (satelliteLightArrival(b, travel, speed) < P.warn + SATELLITE_LEAD || (i === 0 && b.from - travel < FIRST_SIGHT))
        ? [satelliteSpot(b, aims[i] ?? { x: 0, y: 0 }, travel)] : []);
}

/** Screen-space convex hull, so the shaft is one soft shape whatever angle it is seen from. */
function hull(points: Vector[]) {
    const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o: Vector, a: Vector, b: Vector) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const half = (list: Vector[]) => list.reduce<Vector[]>((out, p) => {
        while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
        out.push(p);
        return out;
    }, []);
    const lower = half(sorted), upper = half([...sorted].reverse());
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * The shaft of light from the satellite down onto its rectangle, running ahead along the beam's depths. It shows
 * where the next beam is coming from before its rectangle shows on the chair's plane.
 */
function shaft(ctx: RenderCtx, view: SkyProjection, point: RoutePoint, b: Beam, aim: Aim, travel: number, speed: number, strength: number): DrawCommand | null {
    const arrival = satelliteLightArrival(b, travel, speed);
    const near = Math.max(b.from, travel + 1);
    if (b.to <= near || arrival > P.warn + SHAFT_LEAD) return null;
    const spot = satelliteSpot(b, aim, travel), points: Vector[] = [];
    for (const z of [near, b.to]) for (const x of [aim.x - b.half.x, aim.x + b.half.x]) for (const y of [aim.y - b.half.y, aim.y + b.half.y]) {
        const q = point(x, y, z);
        if (view.depth(q) <= 30) return null;
        points.push(view.project(q));
    }
    const lens = point(spot.x, spot.y - 30, spot.z);
    if (view.depth(lens) > 30) points.push(view.project(lens));
    const from = view.project(lens), to = view.project(point(aim.x, aim.y - b.half.y, near));
    // Faint while it is still ahead, so a beam yet to come never reads as one already on the chair.
    const fade = strength * smooth((P.warn + SHAFT_LEAD - arrival) / 1.2) * (arrival > 0 ? .55 : .9);
    const stops: [number, Color][] = [[0, ctx.rgba(WARM, .45 * fade)], [.7, ctx.rgba(PALE, .22 * fade)], [1, ctx.rgba(PALE, .08 * fade)]];
    return { v: hull(points), c: { from, to, stops }, layer: { key: 'orbit-satellite-light-beam', blend: 'screen' } };
}

/** A thin bright spike through `at` at `angle`, `length` long either way: one ray of a lens flare's star. */
function spike(ctx: RenderCtx, at: Vector, angle: number, length: number, width: number, alpha: number): DrawCommand {
    const c = Math.cos(angle), s = Math.sin(angle);
    const tip = (k: number): Vector => [at[0] + c * length * k, at[1] + s * length * k];
    const side = (k: number): Vector => [at[0] - s * width * k, at[1] + c * width * k];
    return { v: [tip(-1), side(1), tip(1), side(-1)], c: { from: at, to: tip(1), radius: length,
        stops: [[0, ctx.rgba('#ffffff', alpha)], [.35, ctx.rgba(WARM, alpha * .45)], [1, ctx.rgba(WARM, 0)]] },
        layer: { key: 'orbit-satellite-light-flare', blend: 'screen' } };
}

/** The satellite's lens blazing once it has locked on and while its beam is on: a glow and a four-pointed star. */
function lensFlare(ctx: RenderCtx, at: Vector, strength: number) {
    if (strength <= .02) return;
    const breathe = 1 + .12 * Math.sin(ctx.t * 5), radius = 70 * breathe * (.5 + .5 * strength);
    ctx.commands.push({ v: [[at[0] - radius, at[1] - radius], [at[0] + radius, at[1] - radius], [at[0] + radius, at[1] + radius], [at[0] - radius, at[1] + radius]],
        c: { from: at, to: [at[0] + radius, at[1]], radius, stops: [[0, ctx.rgba('#ffffff', strength)], [.18, ctx.rgba(WARM, .8 * strength)], [1, ctx.rgba(PALE, 0)]] },
        layer: { key: 'orbit-satellite-light-flare', blend: 'screen' } });
    for (const [angle, length] of [[0, 180], [Math.PI / 2, 130], [Math.PI / 4, 60], [-Math.PI / 4, 60]]) {
        ctx.commands.push(spike(ctx, at, angle + ctx.t * .15, length * breathe * strength, 3.5, .85 * strength));
    }
}

/**
 * How a beam's rectangle on the chair's plane stands right now: `track` while the satellite follows the chair
 * (dashed outline), `lock` once it holds still (filling, brackets closing in), `on` while the chair is inside its
 * depths, then `fold`.
 */
export function satelliteLightStage(b: Beam, travel: number, speed: number) {
    const arrival = satelliteLightArrival(b, travel, speed);
    const past = (travel - b.to) / Math.max(STAGE_FIVE.cruise * .4, speed);
    if (past > FOLD || arrival > P.warn) return null;
    if (past > 0) return { kind: 'fold' as const, k: 1 - past / FOLD };
    if (arrival <= 0) return { kind: 'on' as const, k: 1 };
    if (arrival <= P.lock) return { kind: 'lock' as const, k: 1 - arrival / P.lock };
    return { kind: 'track' as const, k: smooth((P.warn - arrival) / .3) };
}

/** The rectangle on the chair's plane, drawn from the same aim and size the course checks. Plain alpha, no Scene. */
function rectangle(ctx: RenderCtx, plane: (x: number, y: number) => Vector, b: Beam, aim: Aim, travel: number, speed: number, strength: number) {
    const stage = satelliteLightStage(b, travel, speed);
    if (!stage) return;
    const shrink = stage.kind === 'fold' ? smooth(stage.k) : 1;
    const hx = b.half.x * shrink, hy = b.half.y * shrink;
    const corners = [plane(aim.x - hx, aim.y + hy), plane(aim.x + hx, aim.y + hy), plane(aim.x + hx, aim.y - hy), plane(aim.x - hx, aim.y - hy)];
    const outline = (stroke: DrawCommand['stroke']) => ctx.commands.push({ v: corners, c: null, stroke, layer: PLANE });
    const fill = (alpha: number) => ctx.commands.push({ v: corners, c: hex(GOLD, alpha * strength), layer: PLANE });
    if (stage.kind === 'track') {
        // Following the chair: a dashed outline, with a darker line under it so it reads over bright clouds too.
        const k = stage.k * strength;
        outline({ width: 4.5, color: hex(SHADE, .35 * k), dash: [10, 8], dashOffset: -ctx.t * 40, cap: 'round' });
        outline({ width: 2.5, color: hex(EDGE, (.75 + .2 * Math.sin(ctx.t * 8)) * k), dash: [10, 8], dashOffset: -ctx.t * 40, cap: 'round' });
        return;
    }
    if (stage.kind === 'lock') {
        // Locked on: it stops following, fills up, and corner brackets close in on it.
        const k = stage.k;
        fill(.16 * k);
        outline({ width: 4.5 + 1.5 * k, color: hex(SHADE, .35 * strength), dash: [16, 4], dashOffset: -ctx.t * 60, cap: 'round' });
        outline({ width: 2.5 + 1.5 * k, color: hex(EDGE, strength), dash: [16, 4], dashOffset: -ctx.t * 60, cap: 'round' });
        const out = (1 - k) * 50, L = Math.min(hx, hy) * .5;
        for (const [sx, sy] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
            const x = aim.x + sx * (hx + out), y = aim.y + sy * (hy + out);
            ctx.commands.push({ v: [plane(x, y - sy * L), plane(x, y), plane(x - sx * L, y)], c: null, open: true,
                stroke: { width: 3, color: hex(EDGE, strength), cap: 'round' }, layer: PLANE });
        }
        return;
    }
    // On: a solid lit rectangle, folding to its middle once the chair is through.
    const k = stage.kind === 'fold' ? stage.k : 1;
    fill(.3 * k);
    outline({ width: 2.5, color: hex(EDGE, .95 * k * strength), cap: 'round' });
}

/**
 * Every beam: the shafts first (screened, one layer), then the lens flares, then each rectangle on the chair's
 * plane. `plane` maps a point on that plane (route x, y at the chair's depth) to the screen.
 */
export function orbitSatelliteLight(ctx: RenderCtx, view: SkyProjection, point: RoutePoint, plane: (x: number, y: number) => Vector,
    aims: readonly Aim[], travel: number, speed: number, strength = 1) {
    if (strength <= 0) return;
    const aimOf = (i: number) => aims[i] ?? { x: 0, y: 0 };
    ctx.commands.push(...P.beams.map((b, i) => shaft(ctx, view, point, b, aimOf(i), travel, speed, strength)).filter(c => c !== null));
    P.beams.forEach((b, i) => {
        const stage = satelliteLightStage(b, travel, speed);
        if (!stage || stage.kind === 'track' || stage.kind === 'fold') return;
        const spot = satelliteSpot(b, aimOf(i), travel), lens = point(spot.x, spot.y - 30, spot.z);
        if (view.depth(lens) > 30) lensFlare(ctx, view.project(lens), strength * (stage.kind === 'lock' ? .4 + .6 * stage.k : 1));
    });
    P.beams.forEach((b, i) => rectangle(ctx, plane, b, aimOf(i), travel, speed, strength));
}

/**
 * Over the whole picture while the chair is in the light: the screen washes a little toward white round the chair,
 * as if the light shone into the camera. Kept faint, so the next beam can still be read through it.
 */
export function satelliteGlare(ctx: RenderCtx, chairAt: Vector, warmth: number, pulse: number) {
    if (warmth <= 0) return;
    const inside = warmth >= 1, alpha = inside ? .16 + .05 * pulse : .1 * warmth / .4;
    const radius = Math.hypot(ctx.W, ctx.H) * .6;
    const screen: Vector[] = [[0, 0], [ctx.W, 0], [ctx.W, ctx.H], [0, ctx.H]];
    ctx.commands.push({ v: screen, c: { from: chairAt, to: [chairAt[0] + radius, chairAt[1]], radius,
        stops: [[0, ctx.rgba('#ffffff', alpha)], [.35, ctx.rgba(WARM, alpha * .4)], [1, ctx.rgba(PALE, 0)]] },
        layer: { key: 'orbit-satellite-light-glare', blend: 'screen' } });
}

/** Outside a beam, the chair starts to catch its light this far from the edge. */
const WARN = 140;

/**
 * How much of a beam's light falls on the chair, by the same rectangles the course checks: 1 inside one, rising from
 * 0 over `WARN` as it nears one. `toward` is the way to the rectangle's middle on the plane.
 */
export function satelliteLightWarmth(aims: readonly Aim[], p: Readonly<Pick<Player, 'x' | 'y'>>, z: number) {
    let best = { warmth: 0, toward: { x: 0, y: 0 } };
    P.beams.forEach((b, i) => {
        const aim = aims[i];
        if (!aim) return;
        const dx = Math.abs(p.x - aim.x) - b.half.x - P.chairRadius, dy = Math.abs(p.y - aim.y) - b.half.y - P.chairRadius;
        const ahead = Math.max(b.from - z, z - b.to);
        const out = Math.hypot(Math.max(0, dx), Math.max(0, dy), Math.max(0, ahead));
        const k = out <= 0 ? 1 : Math.max(0, 1 - out / WARN);
        const warmth = out <= 0 ? 1 : .4 * k * k * (3 - 2 * k);
        const len = Math.hypot(aim.x - p.x, aim.y - p.y) || 1;
        if (warmth > best.warmth) best = { warmth, toward: { x: (aim.x - p.x) / len, y: (aim.y - p.y) / len } };
    });
    return best;
}

const TINT = [1, .86, .5];

/** The chair as `chair` draws it, lit by warm light: each colour screened with gold at `amount` (0 to 1). */
export function satelliteLitChair(chair: SkyProjection, amount: number): SkyProjection {
    if (amount <= 0) return chair;
    const tint = (color: string) => '#' + TINT.map((gold, i) => {
        const value = parseInt(color.slice(1 + i * 2, 3 + i * 2), 16);
        return Math.round(value + (255 - value) * gold * amount).toString(16).padStart(2, '0');
    }).join('') + color.slice(7);
    return {
        ...chair,
        polygon: (points, color) => chair.polygon(points, tint(color)),
        profile: (outline, halfWidth, color, z, options) => chair.profile(outline, halfWidth, tint(color), z, options),
        oval: (center, radii, color) => chair.oval(center, radii, tint(color)),
        rod: (a, b, r, color) => chair.rod(a, b, r, tint(color)),
    };
}

/** A soft glow round the chair, leaning toward the light it is catching; painted just before the chair. */
export function satelliteChairGlow(ctx: RenderCtx, chair: SkyProjection, light: ReturnType<typeof satelliteLightWarmth>, pulse: number) {
    if (light.warmth <= 0) return;
    const [x, y] = chair.project([0, 15, 0]);
    const radius = Math.hypot(...[0, 1].map(i => chair.project([0, 95, 0])[i] - chair.project([0, 15, 0])[i])) * 1.8;
    const lean: Vector = [light.toward.x * radius * .35, -light.toward.y * radius * .35];
    const at: Vector = [x + lean[0], y + lean[1]];
    const alpha = light.warmth >= 1 ? .55 + .15 * pulse : .35 * light.warmth / .4;
    ctx.commands.push({ v: [[at[0] - radius, at[1] - radius], [at[0] + radius, at[1] - radius], [at[0] + radius, at[1] + radius], [at[0] - radius, at[1] + radius]],
        c: { from: at, to: [at[0] + radius, at[1]], radius, stops: [[0, ctx.rgba('#ffe08a', alpha)], [.55, ctx.rgba('#ffd66e', alpha * .4)], [1, ctx.rgba('#ffd66e', 0)]] } });
}
