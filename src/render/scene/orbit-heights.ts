import type { RenderCtx } from '../context';
import type { Curve, LayerSpec, Vector } from '../types';
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

const screen = (ctx: RenderCtx): Vector[] => [[0, 0], [ctx.W, 0], [ctx.W, ctx.H], [0, ctx.H]];

/** The sky darkens to indigo, then to the black of space, and the stars come out. */
export function orbitHighSky(ctx: RenderCtx, h: Heights) {
    if (h.air > 0) ctx.commands.push({ v: screen(ctx), c: { from: [0, 0], to: [0, ctx.H],
        stops: [[0, ctx.rgba('#1b2550', h.air)], [.55, ctx.rgba('#43578a', h.air)], [1, ctx.rgba('#8090b4', h.air)]] } });
    if (h.space > 0) ctx.commands.push({ v: screen(ctx), c: { from: [0, 0], to: [0, ctx.H],
        stops: [[0, ctx.rgba('#060a1a', h.space)], [1, ctx.rgba('#121c3e', h.space)]] } });
    const stars = Math.max(h.air * .5, h.space);
    if (stars <= 0) return;
    for (const star of STARS) {
        const twinkle = .55 + .45 * Math.sin(ctx.t * 1.3 + star.phase);
        const x = star.x * ctx.W, y = star.y * ctx.H, r = star.r * (ctx.W / 1000);
        ctx.commands.push({ v: [[x - r, y], [x, y - r], [x + r, y], [x, y + r]], c: '#ffffff' + alpha(stars * twinkle) });
    }
}

const alpha = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0');

function circle(cx: number, cy: number, r: number): { v: Vector[]; curves: Curve[] } {
    const k = .5522847498 * r;
    return { v: [[cx + r, cy]], curves: [
        [cx + r, cy + k, cx + k, cy + r, cx, cy + r], [cx - k, cy + r, cx - r, cy + k, cx - r, cy],
        [cx - r, cy - k, cx - k, cy - r, cx, cy - r], [cx + k, cy - r, cx + r, cy - k, cx + r, cy],
    ] };
}

/** Where the Earth sits on screen: a low curve under the atmosphere, swinging to a full globe in space. */
function earthDisc(ctx: RenderCtx, h: Heights) {
    const r = ctx.W * (1.05 + .08 * h.space);
    // The top of the globe rises from just under the screen to about two thirds of the way down.
    return { x: ctx.W * (.5 + .28 * h.space), y: ctx.H * (1.04 - .26 * h.air - .12 * h.space) + r, r };
}

/** The Earth's curve, its night side and, deep in its shadow, the first light of sunrise on its rim. */
export function orbitEarth(ctx: RenderCtx, h: Heights) {
    if (h.air <= 0) return;
    const e = earthDisc(ctx, h);
    inOpacity(ctx, { key: 'orbit-earth', opacity: h.air }, () => {
        ctx.commands.push({ ...circle(e.x, e.y, e.r), c: { from: [e.x, e.y - e.r], to: [e.x, e.y],
            stops: [[0, ctx.rgba('#5a9bd8')], [.25, ctx.rgba('#2f6fb5')], [1, ctx.rgba('#1d4c86')]] },
        stroke: { width: Math.max(2, ctx.W / 300), color: '#9fd4ffcc' } });
        for (let i = 0; i < 7; i++) {
            const a = -Math.PI / 2 + (i - 3) * .16, d = e.r * (.93 - (i % 3) * .05);
            const x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d, w = e.r * (.08 + (i % 2) * .05);
            ctx.commands.push({ v: [[x - w, y], [x - w * .4, y - w * .18], [x + w * .5, y - w * .12], [x + w, y], [x + w * .3, y + w * .14]], c: '#eef4fbaa' });
        }
    });
    if (h.space <= 0) return;
    // The night half faces the chair's side of the globe; a few cities glow on it.
    // The left rim, then back down a curved terminator that bulges a little into the day side.
    const rimSide: Vector[] = Array.from({ length: 25 }, (_, i) => {
        const a = Math.PI / 2 + i * Math.PI / 24;
        return [e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r];
    });
    const terminator: Vector[] = Array.from({ length: 23 }, (_, i) => {
        const a = -Math.PI / 2 + (i + 1) * Math.PI / 24;
        return [e.x + Math.cos(a) * e.r * .28, e.y + Math.sin(a) * e.r];
    });
    const night = [...rimSide, ...terminator];
    inOpacity(ctx, { key: 'orbit-earth-night', opacity: h.space * .85 }, () => {
        ctx.commands.push({ v: night, c: '#0b1226' });
        for (let i = 0; i < 14; i++) {
            const a = Math.PI + (i - 7) * .07, d = e.r * (.9 - (i % 4) * .04), s = 1.2 + (i % 3) * .6;
            const x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
            ctx.commands.push({ v: [[x - s, y], [x, y - s], [x + s, y], [x, y + s]], c: '#ffd88a' });
        }
    });
}

/** Inside the Earth's shadow everything darkens, and the sun starts to rise over the globe's far rim. */
export function orbitShadow(ctx: RenderCtx, h: Heights) {
    if (h.shadow <= 0) return;
    const e = earthDisc(ctx, h);
    ctx.commands.push({ v: screen(ctx), c: '#050914' + alpha(.55 * h.shadow), layer: { key: 'orbit-earth-shadow' } });
    // Just left of the top of the globe, so the first light shows on screen.
    const rim: Vector = [e.x + Math.cos(-Math.PI / 2 - .12) * e.r, e.y + Math.sin(-Math.PI / 2 - .12) * e.r];
    const glow = ctx.W * .22 * h.shadow;
    ctx.commands.push({ v: [[rim[0] - glow, rim[1] - glow], [rim[0] + glow, rim[1] - glow], [rim[0] + glow, rim[1] + glow], [rim[0] - glow, rim[1] + glow]],
        c: { from: rim, to: [rim[0] + glow, rim[1]], radius: glow, stops: [[0, ctx.rgba('#ffe2a0', .85 * h.shadow)], [1, ctx.rgba('#ffb86b', 0)]] },
        layer: { key: 'orbit-sunrise', blend: 'screen' } });
}
