import type { RenderCtx } from '../context';
import type { Player } from '../../game/types';
import type { Color, DrawCommand, Vector } from '../types';
import { STAGE_FIVE } from '../../game/stages/orbit/data';
import { satelliteLightApex, satelliteLightSection } from '../../game/stages/orbit/course/decide';

type Beam = typeof STAGE_FIVE.satelliteLight.beams[number];
import type { RoutePoint } from './orbit-watch';
import type { SkyProjection } from './sky-projection';

// Scenery reads the same pure checks the course uses, so what is drawn is what pushes the chair.

const P = STAGE_FIVE.satelliteLight;
// The light reaches past every spot the chair can be pushed to: down to below the play area, or across beyond its far edge.
const FLOOR = -(STAGE_FIVE.bounds.y + STAGE_FIVE.steer.overshoot + 40);
const FAR_SIDE = STAGE_FIVE.bounds.x + STAGE_FIVE.steer.overshoot + 40;

/** Screen-space convex hull, so the beam is one soft shape whatever angle it is seen from. */
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

// Beams this far ahead are not drawn yet; their satellite still is.
const DRAW_AHEAD = 4200;

/** A point of the beam: across its sweep, out from the satellite, and route depth. */
type BeamPoint = { a: number; r: number; z: number };
const lerp = (p: BeamPoint, q: BeamPoint, k: number): BeamPoint => ({ a: p.a + (q.a - p.a) * k, r: p.r + (q.r - p.r) * k, z: p.z + (q.z - p.z) * k });

/** The beam's screen outline at `width` times its real half width (1 is exactly what the course checks). */
type BeamShape = { hull: Vector[]; from: Vector; to: Vector; start: number };

/**
 * The light is the tent the course checks (`satelliteLightSection`): from the satellite's lens out to the far end of the
 * light. Whatever of it lies nearer the camera than the chair is cut away, so it never hangs between the two:
 * `point` maps into the camera's frame, whose first axis is how far ahead of the chair a point lies.
 */
function beamShape(view: SkyProjection, point: RoutePoint, b: Beam, age: number, travel: number, width: number): BeamShape | null {
    const lens = satelliteLightApex(b);
    const reach = b.axis === 'y' ? -Math.sign(b.satellite.x) * FAR_SIDE : FLOOR;
    const end = satelliteLightSection(b, age, reach);
    if (Math.min(end.from, lens.z) - travel > DRAW_AHEAD) return null;
    const apex: BeamPoint = { a: lens.across, r: lens.reach, z: lens.z };
    const corner = (side: number, z: number): BeamPoint => ({ a: end.centre + side * end.halfWidth * width, r: reach, z });
    const corners = [corner(-1, end.from), corner(1, end.from), corner(1, end.to), corner(-1, end.to)];
    const edges: [BeamPoint, BeamPoint][] = [...corners.map(c => [apex, c] as [BeamPoint, BeamPoint]), ...corners.map((c, i) => [c, corners[(i + 1) % 4]] as [BeamPoint, BeamPoint])];
    const place = (q: BeamPoint) => b.axis === 'y' ? point(q.r, q.a, q.z) : point(q.a, q.r, q.z);
    const depth = (q: BeamPoint) => place(q)[0];
    const ahead = (q: BeamPoint) => depth(q) >= 0;
    const kept = [apex, ...corners].filter(ahead);
    for (const [p, q] of edges) if (ahead(p) !== ahead(q)) kept.push(lerp(p, q, depth(p) / (depth(p) - depth(q))));
    const placed = kept.map(place);
    if (placed.length < 3 || placed.some(q => view.depth(q) <= 30)) return null;
    const middle: BeamPoint = { a: end.centre, r: reach, z: (end.from + end.to) / 2 };
    const start = ahead(apex) ? 0 : Math.min(.98, depth(apex) / (depth(apex) - depth(middle)));
    return { hull: hull(placed.map(view.project)), from: view.project(place(lerp(apex, middle, start))), to: view.project(place(middle)), start };
}

/** Gradient along the beam from its lens: `[at, colour, alpha]` stops, rescaled to the part that is drawn. */
function along(ctx: RenderCtx, shape: BeamShape, stops: [number, string, number][], strength: number) {
    const k = (at: number) => (at - shape.start) / (1 - shape.start);
    const kept = stops.filter(([at]) => at > shape.start);
    const first = stops.find(([at]) => at >= shape.start) ?? stops[stops.length - 1];
    return { from: shape.from, to: shape.to, stops: [[0, ctx.rgba(first[1], first[2] * strength)] as [number, Color],
        ...kept.map(([at, c, a]) => [k(at), ctx.rgba(c, a * strength)] as [number, Color])] };
}

/**
 * A recording-red laser: a hot white-red blade down its middle inside a red haze that covers exactly what the
 * course checks, outlined in red. It flickers like a ray that is about to burn something.
 */
function laser(ctx: RenderCtx, view: SkyProjection, point: RoutePoint, b: Beam, age: number, travel: number, strength: number) {
    const haze = beamShape(view, point, b, age, travel, 1);
    if (!haze) return null;
    const flicker = strength * (.86 + .14 * Math.sin(ctx.t * 47 + b.phase * 5));
    // Fading out toward its far end, so the ray never reads as a sheet laid over the Earth below.
    const hazeFill = along(ctx, haze, [[0, '#ff3a2e', .26], [.6, '#ff2418', .12], [1, '#ff2418', 0]], flicker);
    const edge = along(ctx, haze, [[0, '#ff5a4a', .95], [.6, '#ff2a1c', .6], [1, '#ff2a1c', 0]], flicker);
    const core = beamShape(view, point, b, age, travel, .07);
    return {
        haze: { v: haze.hull, c: hazeFill, stroke: { width: 2, color: edge }, layer: { key: 'orbit-laser-haze' } } as DrawCommand,
        core: core ? { v: core.hull, c: along(ctx, core, [[0, '#ff7a68', 1], [.08, '#ff3020', .95], [.75, '#ff2418', .6], [1, '#ff2418', 0]], flicker),
            layer: { key: 'orbit-laser-core' } } as DrawCommand : null,
        lens: core ? core.from : haze.from, apexShown: haze.start === 0,
    };
}

/** The satellite's lens glowing red where the laser leaves it. */
function lensFlare(ctx: RenderCtx, at: Vector, strength: number) {
    const radius = 26 + 6 * Math.sin(ctx.t * 13);
    ctx.commands.push({ v: [[at[0] - radius, at[1] - radius], [at[0] + radius, at[1] - radius], [at[0] + radius, at[1] + radius], [at[0] - radius, at[1] + radius]],
        c: { from: at, to: [at[0] + radius, at[1]], radius, stops: [[0, ctx.rgba('#ffffff', strength)], [.25, ctx.rgba('#ff4a3a', .9 * strength)], [1, ctx.rgba('#ff2418', 0)]] },
        layer: { key: 'orbit-laser-lens', blend: 'screen' } });
}

/** Every laser ahead of the chair: the hazes first, then the hot cores, so each look is one layer. `strength` fades them in. */
export function orbitSatelliteLight(ctx: RenderCtx, view: SkyProjection, point: RoutePoint, age: number, travel: number, strength = 1) {
    if (strength <= 0) return;
    const lasers = P.beams.map(b => laser(ctx, view, point, b, age, travel, strength)).filter(l => l !== null);
    for (const l of lasers) ctx.commands.push(l.haze);
    for (const l of lasers) if (l.core) ctx.commands.push(l.core);
    for (const l of lasers) if (l.apexShown) lensFlare(ctx, l.lens, strength);
}

/** Outside a beam, the chair starts to catch its light this far from the edge. */
const WARN = 140;

/**
 * How much of a beam's light falls on the chair, by the same slices the course checks: 1 inside one, rising from
 * 0 over `WARN` as it nears an edge. `side` is which way the light lies along
 * the beam's sweep (-1 or 1), and `axis` that sweep.
 */
export function satelliteLightWarmth(age: number, p: Readonly<Pick<Player, 'x' | 'y'>>, z: number) {
    let best = { warmth: 0, side: 1, axis: 'x' as 'x' | 'y' };
    for (const b of P.beams) {
        const along = b.axis === 'y' ? p.y : p.x;
        const slice = satelliteLightSection(b, age, b.axis === 'y' ? p.x : p.y);
        if (slice.scale <= 0) continue;
        const across = Math.abs(along - slice.centre) - slice.halfWidth;
        const ahead = Math.max(slice.from - z, z - slice.to);
        const out = Math.hypot(Math.max(0, across), Math.max(0, ahead));
        const k = out <= 0 ? 1 : Math.max(0, 1 - out / WARN);
        const warmth = out <= 0 ? 1 : .4 * k * k * (3 - 2 * k);
        if (warmth > best.warmth) best = { warmth, side: slice.centre >= along ? 1 : -1, axis: b.axis };
    }
    return best;
}

// Recording red: the chair glows like something the laser is burning.
const RED = [1, .2, .14];

/** The chair as `chair` draws it, lit by the laser: each colour screened with red at `amount` (0 to 1). */
export function satelliteLitChair(chair: SkyProjection, amount: number): SkyProjection {
    if (amount <= 0) return chair;
    const tint = (color: string) => '#' + RED.map((red, i) => {
        const value = parseInt(color.slice(1 + i * 2, 3 + i * 2), 16);
        return Math.round(value + (255 - value) * red * amount).toString(16).padStart(2, '0');
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
        c: { from: at, to: [at[0] + radius, at[1]], radius, stops: [[0, ctx.rgba('#ff5040', alpha)], [.55, ctx.rgba('#ff2a1c', alpha * .4)], [1, ctx.rgba('#ff2a1c', 0)]] } });
}
