import type { RenderCtx } from '../../context';
import type { LayerSpec, Vector } from '../../types';
import { STAGE_FIVE } from '../../../game/stages/orbit/data';
import { seeded } from '../shared/cloud-art';

const H = STAGE_FIVE.heights;
const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};

export function orbitHeights(z: number) {
    return {
        air: smooth((z - H.air) / 2400),
        space: smooth((z - H.space) / 1600),
        shadow: smooth((z - (H.shadow - 500)) / 900),
    };
}
export type Heights = ReturnType<typeof orbitHeights>;

const STARS = (() => {
    const random = seeded(8800);
    return Array.from({ length: 90 }, () => ({
        x: random(),
        y: random() * 0.75,
        r: 0.6 + random() * 1.3,
        phase: random() * 6.3,
    }));
})();

export function inOpacity(ctx: RenderCtx, layer: LayerSpec, draw: () => void) {
    if (layer.opacity !== undefined && layer.opacity <= 0) return;
    const from = ctx.commands.length;
    draw();
    for (let i = from; i < ctx.commands.length; i++) {
        if (!ctx.commands[i].layer) {
            ctx.commands[i] = { ...ctx.commands[i], layer };
        }
    }
}

const screen = (ctx: RenderCtx, bottom = ctx.H): Vector[] => [
    [0, 0],
    [ctx.W, 0],
    [ctx.W, bottom],
    [0, bottom],
];

// Integer screens per turn keep stars aligned after a full rotation.
export const PANORAMA = 5;

export const panoramaX = (x: number, spin: number) => {
    const u = x - (spin / (Math.PI * 2)) * PANORAMA;
    return ((((u + 0.5) % PANORAMA) + PANORAMA) % PANORAMA) - 0.5;
};

export function orbitHighSky(
    ctx: RenderCtx,
    h: Heights,
    yaw = 0,
    spin = 0,
    bottom = ctx.H,
) {
    if (h.air > 0 && h.space < 1) {
        ctx.commands.push({
            kind: 'path',
            points: screen(ctx, bottom),
            fill: {
                from: [0, 0],
                to: [0, ctx.H],
                stops: [
                    [0, ctx.rgba('#1b2550', h.air)],
                    [0.55, ctx.rgba('#43578a', h.air)],
                    [1, ctx.rgba('#8090b4', h.air)],
                ],
            },
        });
    }
    if (h.space > 0) {
        ctx.commands.push({
            kind: 'path',
            points: screen(ctx, bottom),
            fill: {
                from: [0, 0],
                to: [0, ctx.H],
                stops: [
                    [0, ctx.rgba('#060a1a', h.space)],
                    [1, ctx.rgba('#121c3e', h.space)],
                ],
            },
        });
    }
    const stars = Math.max(h.air * 0.5, h.space);
    if (stars <= 0) return;
    for (const star of STARS) {
        const twinkle = 0.55 + 0.45 * Math.sin(ctx.t * 1.3 + star.phase);
        const shift = yaw * 0.35 + (spin / (Math.PI * 2)) * PANORAMA;
        const x = ((((star.x - shift) % 1) + 1) % 1) * ctx.W,
            y = star.y * ctx.H,
            r = star.r * (ctx.W / 1000);
        ctx.commands.push({
            kind: 'path',
            points: [
                [x - r, y],
                [x, y - r],
                [x + r, y],
                [x, y + r],
            ],
            fill: '#ffffff' + alpha(stars * twinkle),
        });
    }
}

const alpha = (value: number) =>
    Math.round(Math.max(0, Math.min(1, value)) * 255)
        .toString(16)
        .padStart(2, '0');

export function orbitShadow(ctx: RenderCtx, h: Heights, sunrise: Vector) {
    const shadow = h.shadow;
    if (shadow <= 0) return;
    ctx.commands.push({
        kind: 'path',
        points: screen(ctx),
        fill: '#050914' + alpha(0.55 * shadow),
        layer: { key: 'orbit-earth-shadow' },
    });
    const rim: Vector = [sunrise[0] - ctx.W * 0.12, sunrise[1]];
    const glow = ctx.W * 0.22 * shadow;
    ctx.commands.push({
        kind: 'path',
        points: [
            [rim[0] - glow, rim[1] - glow],
            [rim[0] + glow, rim[1] - glow],
            [rim[0] + glow, rim[1] + glow],
            [rim[0] - glow, rim[1] + glow],
        ],
        fill: {
            from: rim,
            to: [rim[0] + glow, rim[1]],
            radius: glow,
            stops: [
                [0, ctx.rgba('#ffe2a0', 0.85 * shadow)],
                [1, ctx.rgba('#ffb86b', 0)],
            ],
        },
        layer: { key: 'orbit-sunrise', blend: 'screen' },
    });
}
