import type { RenderCtx } from '../context';
import type { Player } from '../../game/types';
import type { Color, Vector } from '../types';
import { STAGE_FIVE } from '../../game/stages/orbit/data';
import { praiseApex, praiseSection, praiseSheltered } from '../../game/stages/orbit/course/decide';

type Beam = typeof STAGE_FIVE.praise.beams[number];
import { CLOUD_TONES, puffCloud } from './cloud-art';
import type { RoutePoint } from './orbit-watch';
import type { SkyProjection } from './sky-projection';

// Every satellite's beam sweeps across the route and showers whatever it lights with praise (unseen: the beam is the hazard).
// Scenery reads the same pure checks the course uses, so what is drawn is what pushes the chair.

const P = STAGE_FIVE.praise;
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

/**
 * The light is the tent the course checks (`praiseSection`): from the satellite's lens out to the far end of the
 * light. Whatever of it lies nearer the camera than the chair is cut away, so it never hangs between the two:
 * `point` maps into the camera's frame, whose first axis is how far ahead of the chair a point lies.
 */
function beam(ctx: RenderCtx, view: SkyProjection, point: RoutePoint, b: Beam, age: number, travel: number, strength: number) {
    const lens = praiseApex(b);
    const reach = b.axis === 'y' ? -Math.sign(b.satellite.x) * FAR_SIDE : FLOOR;
    const end = praiseSection(b, age, reach);
    if (Math.min(end.from, lens.z) - travel > DRAW_AHEAD) return;
    const apex: BeamPoint = { a: lens.across, r: lens.reach, z: lens.z };
    const corner = (side: number, z: number): BeamPoint => ({ a: end.centre + side * end.halfWidth, r: reach, z });
    const corners = [corner(-1, end.from), corner(1, end.from), corner(1, end.to), corner(-1, end.to)];
    const edges: [BeamPoint, BeamPoint][] = [...corners.map(c => [apex, c] as [BeamPoint, BeamPoint]), ...corners.map((c, i) => [c, corners[(i + 1) % 4]] as [BeamPoint, BeamPoint])];
    const place = (q: BeamPoint) => b.axis === 'y' ? point(q.r, q.a, q.z) : point(q.a, q.r, q.z);
    const depth = (q: BeamPoint) => place(q)[0];
    const ahead = (q: BeamPoint) => depth(q) >= 0;
    // The corners of what is left once the tent is cut at the chair's depth.
    const kept = [apex, ...corners].filter(ahead);
    for (const [p, q] of edges) if (ahead(p) !== ahead(q)) kept.push(lerp(p, q, depth(p) / (depth(p) - depth(q))));
    const placed = kept.map(place);
    if (placed.length < 3 || placed.some(q => view.depth(q) <= 30)) return;
    // The glow runs from the lens to the middle of the far end, starting from wherever the cut leaves it.
    const middle: BeamPoint = { a: end.centre, r: reach, z: (end.from + end.to) / 2 };
    const start = ahead(apex) ? 0 : Math.min(.98, depth(apex) / (depth(apex) - depth(middle)));
    const glow = (k: number) => k < .6 ? .55 + (.24 - .55) * k / .6 : .24 * (1 - (k - .6) / .4);
    const stop = (k: number): [number, Color] => [(k - start) / (1 - start), ctx.rgba(k < .6 ? '#fff3c4' : '#ffe9a8', glow(k) * strength)];
    // Fading out toward its far end, so the light never reads as a sheet laid over the Earth below.
    const stops = [stop(start), ...[.6, 1].filter(k => k > start).map(stop)];
    ctx.commands.push({ v: hull(placed.map(view.project)), c: {
        from: view.project(place(lerp(apex, middle, start))), to: view.project(place(middle)), stops,
    }, layer: { key: 'orbit-praise-beam', blend: 'screen' } });
}

/** Runs `draw` with the world camera reset, so cloud helpers place shapes in canvas pixels. */
function inScreenSpace(ctx: RenderCtx, draw: () => void) {
    const saved = { scale: ctx.scale, cam: ctx.cam, vertical: ctx.vertical, ox: ctx.ox, oy: ctx.oy,
        rotation: ctx.rotation, localScale: ctx.localScale, mirror: ctx.mirror };
    Object.assign(ctx, { scale: 1, cam: 0, vertical: 0, ox: 0, oy: 0, rotation: 0, localScale: 1, mirror: null });
    draw();
    Object.assign(ctx, saved);
}

/** The clouds the chair can duck into, drawn like the basin's bread clouds. They are there from the stage four ending on. */
export function orbitPraiseShelters(ctx: RenderCtx, view: SkyProjection, point: RoutePoint, travel: number) {
    inScreenSpace(ctx, () => P.shelters.forEach((s, i) => {
        // It thins out as the chair reaches it and is gone before it could come between the chair and the camera;
        // a chair inside it gets the veil instead.
        const center = point(s.x, s.y - P.shelterSize.y * .4, s.z);
        const opacity = Math.min(1, center[0] / P.shelterSize.z);
        if (opacity <= 0 || view.depth(center) <= 30) return;
        const [x, y] = view.project(center), edge = view.project(point(s.x + P.shelterSize.x * 1.2, s.y, s.z));
        puffCloud(ctx, x, y, Math.abs(edge[0] - x) / 170, 7300 + i, CLOUD_TONES.bread, { alpha: .72 * opacity, fade: true });
    }));
}

/** Every beam and the shelter clouds, all ahead of the chair. `strength` fades the beams in. */
export function orbitPraise(ctx: RenderCtx, view: SkyProjection, point: RoutePoint, age: number, travel: number, strength = 1) {
    if (strength > 0) for (const b of P.beams) beam(ctx, view, point, b, age, travel, strength);
    orbitPraiseShelters(ctx, view, point, travel);
}

/** Over the chair: a cloud veil while it hides in a shelter cloud. */
export function orbitPraiseOnChair(ctx: RenderCtx, chairAt: Vector, p: Readonly<Pick<Player, 'x' | 'y'>>, travel: number) {
    if (!praiseSheltered(p, travel)) return;
    inScreenSpace(ctx, () => puffCloud(ctx, chairAt[0], chairAt[1] + ctx.H * .16, ctx.W / 1400, 7400, CLOUD_TONES.bread, { alpha: .8, fade: true }));
}

/** Outside a beam, the chair starts to catch its light this far from the edge. */
const WARN = 140;

/**
 * How much of a beam's light falls on the chair, by the same slices the course checks: 1 inside one, rising from
 * 0 over `WARN` as it nears an edge, 0 while hidden in a shelter cloud. `side` is which way the light lies along
 * the beam's sweep (-1 or 1), and `axis` that sweep.
 */
export function praiseWarmth(age: number, p: Readonly<Pick<Player, 'x' | 'y'>>, z: number) {
    let best = { warmth: 0, side: 1, axis: 'x' as 'x' | 'y' };
    if (praiseSheltered(p, z)) return best;
    for (const b of P.beams) {
        const along = b.axis === 'y' ? p.y : p.x;
        const slice = praiseSection(b, age, b.axis === 'y' ? p.x : p.y);
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

// How strongly each channel is lifted toward white: warm light lifts red most and blue least.
const GOLD = [1, .86, .5];

/** The chair as `chair` draws it, lit by warm light: each colour screened with gold at `amount` (0 to 1). */
export function praiseLitChair(chair: SkyProjection, amount: number): SkyProjection {
    if (amount <= 0) return chair;
    const tint = (color: string) => '#' + GOLD.map((gold, i) => {
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
export function praiseChairGlow(ctx: RenderCtx, chair: SkyProjection, light: ReturnType<typeof praiseWarmth>, pulse: number) {
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
