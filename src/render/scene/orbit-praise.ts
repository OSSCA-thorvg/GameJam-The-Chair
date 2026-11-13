import type { RenderCtx } from '../context';
import type { Player } from '../../game/types';
import type { Vector } from '../types';
import { STAGE_FIVE } from '../../game/stages/orbit/data';
import { inPraise, praiseBeamX, praiseSheltered } from '../../game/stages/orbit/course/decide';

type Beam = typeof STAGE_FIVE.praise.beams[number];
import { breadCloud, CLOUD_TONES, puffCloud } from './cloud-art';
import type { RoutePoint } from './orbit-watch';
import type { SkyProjection } from './sky-projection';

// Every satellite's beam sweeps across the route and showers whatever it lights with praise.
// Scenery reads the same pure checks the course uses, so what is drawn is what pushes the chair.

const P = STAGE_FIVE.praise;
const FLOOR = -160;
const KINDS = ['trophy', 'certificate', 'star', 'badge'] as const;
type Kind = typeof KINDS[number];
const GOLD = '#f2c14e', GOLD_DARK = '#c9932e', CREAM = '#f7efdc', RED = '#c94a3c';

const SHOWER = Array.from({ length: 40 }, (_, i) => ({
    kind: KINDS[i % KINDS.length], across: ((i * 37) % 40) / 39, along: ((i * 23) % 40) / 39,
    rate: .32 + ((i * 13) % 10) * .03, phase: ((i * 29) % 40) / 40, spin: ((i * 7) % 5 - 2) * .9,
}));

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

function beam(ctx: RenderCtx, view: SkyProjection, point: RoutePoint, b: Beam, age: number, travel: number) {
    const near = Math.max(b.from, travel + 60);
    if (near >= b.to || b.from - travel > DRAW_AHEAD) return;
    const x = praiseBeamX(b, age), apex = point(b.satellite.x, b.satellite.y - 40, b.satellite.z);
    const corners = [[x - b.halfWidth, near], [x + b.halfWidth, near], [x + b.halfWidth, b.to], [x - b.halfWidth, b.to]]
        .map(([cx, cz]) => point(cx, FLOOR, cz));
    const visible = [apex, ...corners].filter(p => view.depth(p) > 30).map(view.project);
    if (visible.length < 3) return;
    const top = view.project(apex), bottom = view.project(point(x, FLOOR, (near + b.to) / 2));
    ctx.commands.push({ v: hull(visible), c: { from: top, to: bottom,
        stops: [[0, ctx.rgba('#fff3c4', .55)], [.7, ctx.rgba('#ffe9a8', .28)], [1, ctx.rgba('#ffe9a8', .12)]] },
    layer: { key: 'orbit-praise-beam', blend: 'screen' } });
}

function item(ctx: RenderCtx, kind: Kind, [x, y]: Vector, size: number, angle: number) {
    const turn = (dx: number, dy: number): Vector =>
        [x + dx * size * Math.cos(angle) - dy * size * Math.sin(angle), y + dx * size * Math.sin(angle) + dy * size * Math.cos(angle)];
    const shape = (points: [number, number][], color: string) => ctx.commands.push({ v: points.map(([dx, dy]) => turn(dx, dy)), c: color });
    if (kind === 'trophy') {
        shape([[-.6, -.8], [.6, -.8], [.4, .1], [-.4, .1]], GOLD);
        shape([[-.12, .1], [.12, .1], [.12, .55], [-.12, .55]], GOLD_DARK);
        shape([[-.45, .55], [.45, .55], [.45, .8], [-.45, .8]], GOLD_DARK);
    } else if (kind === 'certificate') {
        shape([[-.8, -.6], [.8, -.6], [.8, .6], [-.8, .6]], CREAM);
        shape([[-.5, -.25], [.4, -.25], [.4, -.12], [-.5, -.12]], '#c9bfa6');
        shape([[.35, .15], [.6, .15], [.6, .45], [.35, .45]], RED);
    } else if (kind === 'star') {
        shape(Array.from({ length: 10 }, (_, i) => {
            const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? .38 : .9;
            return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
        }), GOLD);
    } else {
        shape([[-.15, .3], [-.45, .95], [-.05, .7]], RED);
        shape([[.15, .3], [.45, .95], [.05, .7]], RED);
        shape(Array.from({ length: 12 }, (_, i) => [Math.cos(i * Math.PI / 6) * .6, Math.sin(i * Math.PI / 6) * .6 - .1] as [number, number]), GOLD);
        shape(Array.from({ length: 12 }, (_, i) => [Math.cos(i * Math.PI / 6) * .35, Math.sin(i * Math.PI / 6) * .35 - .1] as [number, number]), GOLD_DARK);
    }
}

/** Trophies, certificates, star stickers and badges pour down a beam. */
function shower(ctx: RenderCtx, view: SkyProjection, point: RoutePoint, b: Beam, age: number, travel: number) {
    if (b.to < travel || b.from - travel > DRAW_AHEAD) return;
    const x = praiseBeamX(b, age), drop = b.satellite.y - 40 - FLOOR;
    for (const piece of SHOWER) {
        const fall = (ctx.t * piece.rate + piece.phase) % 1;
        const z = b.satellite.z + (b.from + piece.along * (b.to - b.from) - b.satellite.z) * fall;
        if (z < travel + 60) continue;
        const at = point(x + (piece.across * 2 - 1) * b.halfWidth * (.2 + .8 * fall), b.satellite.y - 40 - fall * drop, z);
        if (view.depth(at) < 60) continue;
        item(ctx, piece.kind, view.project(at), ctx.clamp(9000 / view.depth(at), 3, 26), ctx.t * piece.spin + piece.phase * 6);
    }
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

/** Every beam, its shower and the shelter clouds, all ahead of the chair. */
export function orbitPraise(ctx: RenderCtx, view: SkyProjection, point: RoutePoint, age: number, travel: number) {
    for (const b of P.beams) beam(ctx, view, point, b, age, travel);
    orbitPraiseShelters(ctx, view, point);
    for (const b of P.beams) shower(ctx, view, point, b, age, travel);
}

/** Over the chair: a cloud veil while it hides, or praise bouncing off it while the beam has it. */
export function orbitPraiseOnChair(ctx: RenderCtx, chairAt: Vector, age: number, p: Readonly<Player>, travel: number) {
    if (praiseSheltered(p, travel)) {
        inScreenSpace(ctx, () => puffCloud(ctx, chairAt[0], chairAt[1] + ctx.H * .16, ctx.W / 1400, 7400, CLOUD_TONES.bread, { alpha: .8, fade: true }));
        return;
    }
    if (!inPraise(age, p, travel)) return;
    for (let i = 0; i < 8; i++) {
        const a = ctx.t * 3 + i * Math.PI / 4, r = ctx.H * (.1 + .04 * Math.sin(ctx.t * 9 + i));
        item(ctx, KINDS[i % KINDS.length], [chairAt[0] + Math.cos(a) * r, chairAt[1] - ctx.H * .05 + Math.sin(a) * r * .6], ctx.H / 40, a);
    }
}
