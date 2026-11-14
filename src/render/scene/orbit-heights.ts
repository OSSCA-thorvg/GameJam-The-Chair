import type { RenderCtx } from '../context';
import type { LayerSpec, Vector } from '../types';
import { STAGE_FIVE } from '../../game/stages/orbit/data';
import { seeded } from './cloud-art';

// Stage five climbs out of the clouds (5-1) into the upper atmosphere (5-2) and on into space (5-3), ending in
// the Earth's shadow. Everything here is backdrop: it follows the route depth and never touches play.

const H = STAGE_FIVE.heights;
const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};

/** How far the climb has gone at route depth `z`: out of the clouds, into space, into the Earth's shadow. */
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
    return Array.from({ length: 90 }, () => ({ x: random(), y: random() * .75, r: .6 + random() * 1.3, phase: random() * 6.3 }));
})();

/** Runs `draw`, then puts everything it pushed into one ThorVG scene layer (commands with their own layer keep it). */
export function inOpacity(ctx: RenderCtx, layer: LayerSpec, draw: () => void) {
    if (layer.opacity !== undefined && layer.opacity <= 0) return;
    const from = ctx.commands.length;
    draw();
    for (let i = from; i < ctx.commands.length; i++) if (!ctx.commands[i].layer) ctx.commands[i] = { ...ctx.commands[i], layer };
}

const screen = (ctx: RenderCtx, bottom = ctx.H): Vector[] => [[0, 0], [ctx.W, 0], [ctx.W, bottom], [0, bottom]];

/** Screen widths the backdrop slides by over one full turn of the camera: about one per 72 degree view. */
export const PANORAMA = 5;

/** How far a backdrop drawn at screen position `x` (0 to 1 at no spin) sits after the camera turns by `spin` radians. */
export const panoramaX = (x: number, spin: number) => {
    const u = x - spin / (Math.PI * 2) * PANORAMA;
    return ((u + .5) % PANORAMA + PANORAMA) % PANORAMA - .5;
};

/** The sky darkens to indigo, then to the black of space, and the stars come out. `spin` turns the camera round the chair. */
export function orbitHighSky(ctx: RenderCtx, h: Heights, yaw = 0, spin = 0, bottom = ctx.H) {
    // Opaque Earth covers the lower sky during the ending; keep the gradient's original full-height coordinates.
    if (h.air > 0 && h.space < 1) ctx.commands.push({ v: screen(ctx, bottom), c: { from: [0, 0], to: [0, ctx.H],
        stops: [[0, ctx.rgba('#1b2550', h.air)], [.55, ctx.rgba('#43578a', h.air)], [1, ctx.rgba('#8090b4', h.air)]] } });
    if (h.space > 0) ctx.commands.push({ v: screen(ctx, bottom), c: { from: [0, 0], to: [0, ctx.H],
        stops: [[0, ctx.rgba('#060a1a', h.space)], [1, ctx.rgba('#121c3e', h.space)]] } });
    const stars = Math.max(h.air * .5, h.space);
    if (stars <= 0) return;
    for (const star of STARS) {
        const twinkle = .55 + .45 * Math.sin(ctx.t * 1.3 + star.phase);
        // A whole number of screens per full turn, so the stars line up again after the camera's circle.
        const shift = yaw * .35 + spin / (Math.PI * 2) * PANORAMA;
        const x = (((star.x - shift) % 1 + 1) % 1) * ctx.W, y = star.y * ctx.H, r = star.r * (ctx.W / 1000);
        ctx.commands.push({ v: [[x - r, y], [x, y - r], [x + r, y], [x, y + r]], c: '#ffffff' + alpha(stars * twinkle) });
    }
}

const alpha = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0');

/** Inside the Earth's shadow everything darkens, and the sun starts to rise over the horizon ahead. */
export function orbitShadow(ctx: RenderCtx, h: Heights, sunrise: Vector) {
    const shadow = h.shadow;
    if (shadow <= 0) return;
    ctx.commands.push({ v: screen(ctx), c: '#050914' + alpha(.55 * shadow), layer: { key: 'orbit-earth-shadow' } });
    // A little left of straight ahead, where the sun is about to come up over the rim of the Earth.
    const rim: Vector = [sunrise[0] - ctx.W * .12, sunrise[1]];
    const glow = ctx.W * .22 * shadow;
    ctx.commands.push({ v: [[rim[0] - glow, rim[1] - glow], [rim[0] + glow, rim[1] - glow], [rim[0] + glow, rim[1] + glow], [rim[0] - glow, rim[1] + glow]],
        c: { from: rim, to: [rim[0] + glow, rim[1]], radius: glow, stops: [[0, ctx.rgba('#ffe2a0', .85 * shadow)], [1, ctx.rgba('#ffb86b', 0)]] },
        layer: { key: 'orbit-sunrise', blend: 'screen' } });
}
