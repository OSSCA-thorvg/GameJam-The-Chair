import type { RenderCtx } from '../context';
import { aim, cctvModel, type CctvKind } from './cctv-models';
import { createSkyProjection, type Point3 } from './sky-projection';
import { cctvLamp, type LampState } from './orbit-watch';

const CEILING = 57;
const DROP = 14;
const SIZE = .62;
// Only the models that sit naturally under a ceiling, with each one's top above its origin so the stem meets the housing.
const HUNG = ['bullet', 'dome', 'long'] as const satisfies readonly CctvKind[];
const TOP: Record<typeof HUNG[number], number> = { bullet: 15, dome: 10, long: 15 };
// How far toward the viewer a camera turns while it looks at the chair, in route units.
const ACROSS = 260;

/**
 * The stage five security cameras, already watching from the office ceiling: the same extruded
 * models hang at an even spacing, turn to follow the chair and blink as it passes underneath.
 */
export function ceilingCctvs(ctx: RenderCtx, spacing: number, offset = 0) {
    const first = Math.floor((ctx.cam - 80 - offset) / spacing) + 1;
    for (let i = first; i * spacing + offset < ctx.cam + ctx.VW + 80; i++) cctv(ctx, i * spacing + offset, i);
}

function kindAt(index: number) {
    const mixed = Math.imul(index ^ 0x5bd1e995, 0x27d4eb2d);
    return HUNG[((mixed ^ (mixed >>> 15)) >>> 0) % HUNG.length];
}

function cctv(ctx: RenderCtx, x: number, index: number) {
    const kind = kindAt(index);
    const pivotY = CEILING + DROP;
    const [sx, sy] = ctx.screenPoint(x, pivotY);
    // A side view looking slightly up at the ceiling, with world units matching the 2D scene.
    const focal = Math.min(ctx.H * 1.65, ctx.W * .94);
    const view = createSkyProjection(ctx.W, ctx.H, 0, {
        zoom: 480 * ctx.scale / focal, offsetX: sx - ctx.W / 2, centerY: sy / ctx.H, eyeY: -30,
    });
    const anchor: Point3 = [0, 15, 0];
    const dx = ctx.p.x - x;
    const dy = ctx.p.y - 45 - pivotY;
    const sway = Math.sin(ctx.t * .6 + index) * .05;
    const yaw = aim(dx, ACROSS) + sway;
    const tilt = Math.max(.08, Math.min(1.1, Math.atan2(dy, Math.hypot(dx, ACROSS))));
    const top = TOP[kind];
    const cy = Math.cos(yaw), syaw = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
    const place = ([u, v, w]: Point3): Point3 => {
        const pu = u * ct + (v - top) * st, pv = -u * st + (v - top) * ct;
        return [anchor[0] + (pu * cy + w * syaw) * SIZE, anchor[1] + pv * SIZE, anchor[2] + (w * cy - pu * syaw) * SIZE];
    };
    view.rod([0, 15 + DROP, 0], anchor, 2.4, '#69738c');
    view.profile([[-12, 0], [12, 0], [12, 3], [-12, 3]], 9, '#9aa0b0', 0, { place: ([u, v, w]) => [u, 15 + DROP - 3 + v, w] });
    view.oval(anchor, [3.5, 3.5, 3.5], '#424f6d');
    const lamp = cctvModel(view, kind, place);
    const state = cctvLamp(x - ctx.p.x, ctx.t);
    view.oval(lamp, [4.5 * SIZE, 4.5 * SIZE, 4.5 * SIZE], state === 'idle' ? '#a8423c' : '#ff5a4a');
    ctx.commands.push(...view.commands());
    glow(ctx, view.project(lamp), state);
}

function glow(ctx: RenderCtx, [x, y]: [number, number], state: LampState) {
    if (state === 'idle') return;
    const radius = (state === 'flash' ? 22 : 9) * ctx.scale;
    ctx.commands.push({ v: [[x - radius, y - radius], [x + radius, y - radius], [x + radius, y + radius], [x - radius, y + radius]], c: {
        from: [x, y], to: [x + radius, y], radius, stops: [[0, ctx.rgba('#ff6b57', .95)], [1, ctx.rgba('#ff6b57', 0)]],
    }, layer: { key: 'ceiling-cctv-light', blend: 'screen' } });
}
