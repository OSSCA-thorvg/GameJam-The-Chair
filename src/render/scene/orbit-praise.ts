import type { RenderCtx } from '../context';
import type { Player } from '../../game/types';
import type { Vector } from '../types';
import { STAGE_FIVE } from '../../game/stages/orbit/data';
import { praiseBeamX, praiseSheltered } from '../../game/stages/orbit/course/decide';

type Beam = typeof STAGE_FIVE.praise.beams[number];
import { breadCloud, CLOUD_TONES, puffCloud } from './cloud-art';
import type { RoutePoint } from './orbit-watch';
import type { SkyProjection } from './sky-projection';

// Every satellite's beam sweeps across the route and showers whatever it lights with praise (unseen: the beam is the hazard).
// Scenery reads the same pure checks the course uses, so what is drawn is what pushes the chair.

const P = STAGE_FIVE.praise;
// Down-shining beams reach below the play area; side beams reach across to beyond its far edge.
const FLOOR = -(STAGE_FIVE.bounds.y + 60);
const FAR_SIDE = STAGE_FIVE.bounds.x + 60;

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

function beam(ctx: RenderCtx, view: SkyProjection, point: RoutePoint, b: Beam, age: number, travel: number, strength: number) {
    const near = Math.max(b.from, travel + 60);
    if (near >= b.to || b.from - travel > DRAW_AHEAD) return;
    const c = praiseBeamX(b, age), apex = point(b.satellite.x, b.satellite.y - 40, b.satellite.z);
    const far = -Math.sign(b.satellite.x) * FAR_SIDE;
    // A down beam lights a strip of the floor; a side beam a band of the far wall.
    const at = (offset: number, z: number) => b.axis === 'y' ? point(far, c + offset, z) : point(c + offset, FLOOR, z);
    const corners = [at(-b.halfWidth, near), at(b.halfWidth, near), at(b.halfWidth, b.to), at(-b.halfWidth, b.to)];
    const visible = [apex, ...corners].filter(p => view.depth(p) > 30).map(view.project);
    if (visible.length < 3) return;
    const top = view.project(apex), bottom = view.project(at(0, (near + b.to) / 2));
    ctx.commands.push({ v: hull(visible), c: { from: top, to: bottom,
        // Fading out toward its far end, so the light never reads as a sheet laid over the Earth below.
        stops: [[0, ctx.rgba('#fff3c4', .55 * strength)], [.6, ctx.rgba('#ffe9a8', .24 * strength)], [1, ctx.rgba('#ffe9a8', 0)]] },
    layer: { key: 'orbit-praise-beam', blend: 'screen' } });
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
export function orbitPraiseShelters(ctx: RenderCtx, view: SkyProjection, point: RoutePoint) {
    inScreenSpace(ctx, () => P.shelters.forEach((s, i) => {
        const center = point(s.x, s.y - P.shelterSize.y * .4, s.z);
        // Close up, the chair is inside the cloud: the veil over the chair takes over.
        if (view.depth(center) < 750) return;
        const [x, y] = view.project(center), edge = view.project(point(s.x + P.shelterSize.x * 1.2, s.y, s.z));
        breadCloud(ctx, x, y, Math.abs(edge[0] - x) / 170, 7300 + i, false);
    }));
}

/** Every beam and the shelter clouds, all ahead of the chair. `strength` fades the beams in. */
export function orbitPraise(ctx: RenderCtx, view: SkyProjection, point: RoutePoint, age: number, travel: number, strength = 1) {
    if (strength > 0) for (const b of P.beams) beam(ctx, view, point, b, age, travel, strength);
    orbitPraiseShelters(ctx, view, point);
}

/** Over the chair: a cloud veil while it hides in a shelter cloud. */
export function orbitPraiseOnChair(ctx: RenderCtx, chairAt: Vector, p: Readonly<Pick<Player, 'x' | 'y'>>, travel: number) {
    if (!praiseSheltered(p, travel)) return;
    inScreenSpace(ctx, () => puffCloud(ctx, chairAt[0], chairAt[1] + ctx.H * .16, ctx.W / 1400, 7400, CLOUD_TONES.bread, { alpha: .8, fade: true }));
}
