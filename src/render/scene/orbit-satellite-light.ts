import type { RenderCtx } from '../context';
import type { Player } from '../../game/types';
import type { Color, DrawCommand, LayerSpec, Vector } from '../types';
import { STAGE_FIVE } from '../../game/stages/orbit/data';
import { satelliteLightAlong, satelliteLightArrival, satelliteLightSweep } from '../../game/stages/orbit/course/decide';
import type { RoutePoint } from './orbit-watch';
import type { SkyProjection } from './sky-projection';

type Beam = typeof STAGE_FIVE.satelliteLight.beams[number];

// The course checks each beam as a band on the play plane at the chair's depth. Everything here is drawn from the
// same band, so what lights up on that plane is exactly what touches the chair.

const P = STAGE_FIVE.satelliteLight, B = STAGE_FIVE.bounds;
/** Overhead satellites hang this far above the middle of the plane; side satellites this far out to the side. */
const LENS_UP = 560, LENS_SIDE = 700;
/** The satellite rides this far ahead of the chair while its beam is on, so it stays in view. */
const LEAD = 650;
/** How far past the play area the curtain of light reaches, so it runs off the edges of the screen. */
const REACH = 900;
/** A beam's curtain shows in the distance this many seconds before its warning starts; its satellite earlier still. */
const CURTAIN_LEAD = .8, SATELLITE_LEAD = 2.2;
/** The first satellite is already in sight this far ahead, so it turns up with the other watchers in the reveal. */
const FIRST_SIGHT = 2400;
/** Seconds the band takes to fold away once the chair is through it. */
const FOLD = .35;
/** The last stretch of the warning, when the band fills and the corner brackets close in. */
const CHARGE = .5;

const WARM = '#fff3c4', PALE = '#ffe9a8', GOLD = '#ffd66e', EDGE = '#ffe08a';
const PLANE: LayerSpec = { key: 'orbit-satellite-light-plane' };

const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};

/** Where a beam's satellite is: over (or beside) its band, riding just ahead of the chair while the beam is on. */
export function satelliteSpot(beam: Beam, age: number, travel: number) {
    const centre = satelliteLightSweep(beam, age), z = Math.max(beam.from, Math.min(beam.to, travel + LEAD));
    return beam.axis === 'y' ? { x: (beam.side ?? 1) * LENS_SIDE, y: centre, z } : { x: centre, y: LENS_UP, z };
}

/**
 * The satellites worth drawing: each from a little before its beam is announced until the chair is through it, so
 * only the next one or two are ever up. `speed` turns the distance to each beam into seconds.
 */
export function satelliteSpots(age: number, travel: number, speed: number) {
    return P.beams.filter((b, i) => travel < b.to && (satelliteLightArrival(b, travel, speed) < P.warn + SATELLITE_LEAD || (i === 0 && b.from - travel < FIRST_SIGHT)))
        .map(b => satelliteSpot(b, age, travel));
}

/** A point on a beam's band in route units: `a` along its sweep, `r` along its length (out from the satellite). */
const onBand = (b: Beam, a: number, r: number) => b.axis === 'y' ? { x: r, y: a } : { x: a, y: r };

/** Screen-space convex hull, so the curtain is one soft shape whatever angle it is seen from. */
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

/** The beam's far end on the plane (where it runs off past the play area) and its near end at the satellite. */
function lengthRange(b: Beam) {
    const out = b.axis === 'y' ? -(b.side ?? 1) : -1;
    const lens = b.axis === 'y' ? (b.side ?? 1) * (LENS_SIDE - 40) : LENS_UP - 40;
    return { lens, far: out * ((b.axis === 'y' ? B.x : B.y) + REACH) };
}

/**
 * The curtain of light ahead of the chair, in perspective: from the satellite down past the play area and from the
 * nearer of its start and the chair's depth to its end. It shows where a beam is long before it arrives.
 */
function curtain(ctx: RenderCtx, view: SkyProjection, point: RoutePoint, b: Beam, age: number, travel: number, speed: number, strength: number): DrawCommand | null {
    const arrival = satelliteLightArrival(b, travel, speed);
    const near = Math.max(b.from, travel + 1);
    if (b.to <= near || arrival > P.warn + CURTAIN_LEAD) return null;
    // Ahead of the chair the curtain stops just past the play area, so it hangs in the distance; once the chair is
    // inside it, it runs on off the screen with the band.
    const c = satelliteLightSweep(b, age), { lens, far } = lengthRange(b);
    const end = arrival > 0 ? Math.sign(far) * ((b.axis === 'y' ? B.x : B.y) + 80) : far;
    const corners: Vector[] = [];
    for (const z of [near, b.to]) for (const a of [c - b.halfWidth, c + b.halfWidth]) for (const r of [lens, end]) {
        const at = onBand(b, a, r), q = point(at.x, at.y, z);
        if (view.depth(q) <= 30) return null;
        corners.push(view.project(q));
    }
    const spot = satelliteSpot(b, age, travel), from = view.project(point(spot.x, spot.y, near));
    const mid = onBand(b, c, end), to = view.project(point(mid.x, mid.y, near));
    // Fades in out of the distance, so the next beam reads first as a faint curtain and then as solid light.
    const fade = strength * smooth((P.warn + CURTAIN_LEAD - arrival) / 1.2) * (arrival > 0 ? .6 : 1);
    const stops: [number, Color][] = [[0, ctx.rgba(WARM, .42 * fade)], [.55, ctx.rgba(PALE, .2 * fade)], [1, ctx.rgba(PALE, .03 * fade)]];
    return { v: hull(corners), c: { from, to, stops }, layer: { key: 'orbit-satellite-light-beam', blend: 'screen' } };
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

/** The satellite's lens blazing as it charges and while its beam is on: a glow and a four-pointed star. */
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
 * How the band on the chair's plane stands right now: `warn` while it is announced (dashed edges), `charge`
 * in its last half second (filling, brackets closing in), `on` while the chair is inside its depths, then `fold`.
 */
export function satelliteLightStage(b: Beam, travel: number, speed: number) {
    const arrival = satelliteLightArrival(b, travel, speed);
    const past = (travel - b.to) / Math.max(STAGE_FIVE.cruise * .4, speed);
    if (past > FOLD || arrival > P.warn) return null;
    if (past > 0) return { kind: 'fold' as const, k: 1 - past / FOLD };
    if (arrival <= 0) return { kind: 'on' as const, k: 1 };
    if (arrival <= CHARGE) return { kind: 'charge' as const, k: 1 - arrival / CHARGE };
    return { kind: 'warn' as const, k: smooth((P.warn - arrival) / .3) };
}

/**
 * The band on the chair's own plane: dashed edges while it is announced, filling with closing corner brackets just
 * before it arrives, solid with light scanning along it while it is on, folding away after. Plain alpha, no Scene.
 */
function band(ctx: RenderCtx, plane: (x: number, y: number) => Vector, b: Beam, age: number, travel: number, speed: number, strength: number) {
    const stage = satelliteLightStage(b, travel, speed);
    if (!stage) return;
    const c = satelliteLightSweep(b, age), { lens, far } = lengthRange(b);
    // Folding pulls both ends in to the middle of the play area.
    const squeeze = stage.kind === 'fold' ? smooth(stage.k) : 1;
    const r0 = lens * squeeze, r1 = far * squeeze;
    const at = (a: number, r: number) => { const q = onBand(b, a, r); return plane(q.x, q.y); };
    const lo = c - b.halfWidth, hi = c + b.halfWidth;
    const edges = (stroke: DrawCommand['stroke']) => {
        for (const a of [lo, hi]) ctx.commands.push({ v: [at(a, r0), at(a, r1)], c: null, open: true, stroke, layer: PLANE });
    };
    const fill = (alpha: number) => ctx.commands.push({ v: [at(lo, r0), at(hi, r0), at(hi, r1), at(lo, r1)], c: hex(GOLD, alpha * strength), layer: PLANE });
    if (stage.kind === 'warn') {
        // A darker line under the dashes keeps them readable over bright clouds as well as dark space.
        edges({ width: 4.5, color: hex('#6b4a12', .35 * stage.k * strength), dash: [10, 8], dashOffset: -ctx.t * 40, cap: 'round' });
        edges({ width: 2.5, color: hex(EDGE, (.75 + .2 * Math.sin(ctx.t * 8)) * stage.k * strength), dash: [10, 8], dashOffset: -ctx.t * 40, cap: 'round' });
        return;
    }
    if (stage.kind === 'charge') {
        const k = stage.k;
        fill(.12 * k);
        edges({ width: 4.5 + 1.5 * k, color: hex('#6b4a12', .35 * strength), dash: [16, 4], dashOffset: -ctx.t * 60, cap: 'round' });
        edges({ width: 2.5 + 1.5 * k, color: hex(EDGE, strength), dash: [16, 4], dashOffset: -ctx.t * 60, cap: 'round' });
        // Corner brackets close in on the band where it meets the edges of the play area.
        const out = (1 - k) * 60, span = (b.axis === 'y' ? B.x : B.y) + 70, L = 40;
        for (const [a, sa] of [[lo - out, 1], [hi + out, -1]] as const) for (const [r, sr] of [[span + out, -1], [-span - out, 1]] as const) {
            ctx.commands.push({ v: [at(a, r + sr * L), at(a, r), at(a + sa * L, r)], c: null, open: true,
                stroke: { width: 3, color: hex(EDGE, strength), cap: 'round' }, layer: PLANE });
        }
        return;
    }
    // On: solid band with light scanning along it, away from the satellite.
    const k = stage.kind === 'fold' ? stage.k : 1;
    fill(.26 * k);
    edges({ width: 2.5, color: hex(EDGE, .95 * k * strength), cap: 'round' });
    const gap = 90, length = r1 - r0, sign = Math.sign(length) || 1;
    for (let d = (ctx.t * 140) % gap; d < Math.abs(length); d += gap) {
        const r = r0 + sign * d;
        ctx.commands.push({ v: [at(lo + 4, r), at(hi - 4, r)], c: null, open: true,
            stroke: { width: 1.2, color: hex(WARM, .4 * k * strength) }, layer: PLANE });
    }
}

const hex = (color: string, alpha: number) => color + Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');

/**
 * Every beam: the curtains far ahead first (screened, one layer), then the lens flares, then each band on the
 * chair's plane. `plane` maps a point on that plane (route x, y at the chair's depth) to the screen.
 */
export function orbitSatelliteLight(ctx: RenderCtx, view: SkyProjection, point: RoutePoint, plane: (x: number, y: number) => Vector,
    age: number, travel: number, speed: number, strength = 1) {
    if (strength <= 0) return;
    const curtains = P.beams.map(b => curtain(ctx, view, point, b, age, travel, speed, strength)).filter(c => c !== null);
    ctx.commands.push(...curtains);
    for (const b of P.beams) {
        const stage = satelliteLightStage(b, travel, speed);
        if (!stage || stage.kind === 'warn' || stage.kind === 'fold') continue;
        const spot = satelliteSpot(b, age, travel), lens = point(spot.x, spot.y - 30, spot.z);
        if (view.depth(lens) > 30) lensFlare(ctx, view.project(lens), strength * (stage.kind === 'charge' ? .4 + .6 * stage.k : 1));
    }
    for (const b of P.beams) band(ctx, plane, b, age, travel, speed, strength);
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
 * How much of a beam's light falls on the chair, by the same bands the course checks: 1 inside one, rising from
 * 0 over `WARN` as it nears an edge. `side` is which way the light lies along the beam's sweep (-1 or 1), and
 * `axis` that sweep.
 */
export function satelliteLightWarmth(age: number, p: Readonly<Pick<Player, 'x' | 'y'>>, z: number) {
    let best = { warmth: 0, side: 1, axis: 'x' as 'x' | 'y' };
    for (const b of P.beams) {
        const along = satelliteLightAlong(b, p), centre = satelliteLightSweep(b, age);
        const across = Math.abs(along - centre) - b.halfWidth - P.chairRadius;
        const ahead = Math.max(b.from - z, z - b.to);
        const out = Math.hypot(Math.max(0, across), Math.max(0, ahead));
        const k = out <= 0 ? 1 : Math.max(0, 1 - out / WARN);
        const warmth = out <= 0 ? 1 : .4 * k * k * (3 - 2 * k);
        if (warmth > best.warmth) best = { warmth, side: centre >= along ? 1 : -1, axis: b.axis };
    }
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
    // A down beam lies to one side across the screen; a side beam above or below.
    const lean: Vector = light.axis === 'y' ? [0, -light.side * radius * .35] : [light.side * radius * .35, 0];
    const at: Vector = [x + lean[0], y + lean[1]];
    const alpha = light.warmth >= 1 ? .55 + .15 * pulse : .35 * light.warmth / .4;
    ctx.commands.push({ v: [[at[0] - radius, at[1] - radius], [at[0] + radius, at[1] - radius], [at[0] + radius, at[1] + radius], [at[0] - radius, at[1] + radius]],
        c: { from: at, to: [at[0] + radius, at[1]], radius, stops: [[0, ctx.rgba('#ffe08a', alpha)], [.55, ctx.rgba('#ffd66e', alpha * .4)], [1, ctx.rgba('#ffd66e', 0)]] } });
}
