import type { RenderCtx } from '../context';
import { aim, cctvModel, type CctvKind } from './cctv-models';
import { createSkyProjection, type Point3 } from './sky-projection';
import { cctvLamp, type LampState } from './orbit-watch';

const CEILING = 57;
const DROP = 14;
const SIZE = 0.62;
const KIND: CctvKind = 'long';
const TOP = 15;
const LENGTH = 60 / 84,
    MIDDLE = -4;
const ACROSS = 260;

export function ceilingCctvs(ctx: RenderCtx, spacing: number, offset = 0) {
    const first = Math.floor((ctx.cam - 80 - offset) / spacing) + 1;
    for (let i = first; i * spacing + offset < ctx.cam + ctx.VW + 80; i++) {
        cctv(ctx, i * spacing + offset, i);
    }
}

function cctv(ctx: RenderCtx, x: number, index: number) {
    const pivotY = CEILING + DROP;
    const [sx, sy] = ctx.screenPoint(x, pivotY);
    const focal = Math.min(ctx.H * 1.65, ctx.W * 0.94);
    const view = createSkyProjection(ctx.W, ctx.H, 0, {
        zoom: (480 * ctx.scale) / focal,
        offsetX: sx - ctx.W / 2,
        centerY: sy / ctx.H,
        eyeY: -30,
    });
    const anchor: Point3 = [0, 15, 0];
    const dx = ctx.player.x - x;
    const dy = ctx.player.y - 45 - pivotY;
    const sway = Math.sin(ctx.t * 0.6 + index) * 0.05;
    const yaw = aim(dx, ACROSS) + sway;
    const tilt = Math.max(
        0.08,
        Math.min(1.1, Math.atan2(dy, Math.hypot(dx, ACROSS))),
    );
    const cy = Math.cos(yaw),
        syaw = Math.sin(yaw),
        ct = Math.cos(tilt),
        st = Math.sin(tilt);
    const place = ([long, v, w]: Point3): Point3 => {
        const u = (long - MIDDLE) * LENGTH;
        const pu = u * ct + (v - TOP) * st,
            pv = -u * st + (v - TOP) * ct;
        return [
            anchor[0] + (pu * cy + w * syaw) * SIZE,
            anchor[1] + pv * SIZE,
            anchor[2] + (w * cy - pu * syaw) * SIZE,
        ];
    };
    view.rod([0, 15 + DROP, 0], anchor, 2.4, '#69738c');
    view.profile(
        [
            [-12, 0],
            [12, 0],
            [12, 3],
            [-12, 3],
        ],
        9,
        '#9aa0b0',
        0,
        { place: ([u, v, w]) => [u, 15 + DROP - 3 + v, w] },
    );
    view.oval(anchor, [3.5, 3.5, 3.5], '#424f6d');
    const lamp = cctvModel(view, KIND, place);
    const state = cctvLamp(x - ctx.player.x, ctx.t);
    view.oval(
        lamp,
        [4.5 * SIZE, 4.5 * SIZE, 4.5 * SIZE],
        state === 'idle' ? '#a8423c' : '#ff5a4a',
    );
    ctx.commands.push(...view.commands());
    glow(ctx, view.project(lamp), state);
}

function glow(ctx: RenderCtx, [x, y]: [number, number], state: LampState) {
    if (state === 'idle') return;
    const radius = (state === 'flash' ? 22 : 9) * ctx.scale;
    ctx.commands.push({
        kind: 'path',
        points: [
            [x - radius, y - radius],
            [x + radius, y - radius],
            [x + radius, y + radius],
            [x - radius, y + radius],
        ],
        fill: {
            from: [x, y],
            to: [x + radius, y],
            radius,
            stops: [
                [0, ctx.rgba('#ff6b57', 0.95)],
                [1, ctx.rgba('#ff6b57', 0)],
            ],
        },
        layer: { key: 'ceiling-cctv-light', blend: 'screen' },
    });
}
