import type { Vector } from '../types';
import type { RenderCtx } from '../context';
import { FOCUS_LOSS_DURATION } from '../../game/systems/focus/decide';

// Each hit plays a single heartbeat. Lower focus makes it darker and reach further in from the edges.
const BEAT_RATE = 1;
const TIERS = [
    { below: 20, strength: .85, inner: .42 },
    { below: 40, strength: .62, inner: .5 },
    { below: 60, strength: .42, inner: .57 },
    { below: Infinity, strength: .26, inner: .64 },
] as const;

const bump = (x: number) => Math.exp(-x * x);
const beat = (phase: number) => bump((phase - .08) / .07) + .6 * bump((phase - .3) / .08);

export function focusVignetteAlpha(focus: number, noticeLife: number | null, time: number) {
    const tier = TIERS.find(item => focus <= item.below) ?? TIERS[TIERS.length - 1];
    let alpha = 0;
    if (noticeLife !== null && noticeLife > 0) {
        const age = FOCUS_LOSS_DURATION - noticeLife;
        const fade = Math.min(1, noticeLife / .5);
        alpha = tier.strength * Math.min(1, beat(age * BEAT_RATE)) * fade;
    }
    if (focus <= 20) alpha = Math.max(alpha, .16 * (.5 + .5 * beat((time * 1.2) % 1)));
    return { alpha, inner: tier.inner };
}

// A red heartbeat around the screen edges. The inner rectangle, where the gradient is fully transparent,
// is cut out of the path so the renderer only rasterises the border band.
export function focusVignette(ctx: RenderCtx) {
    const state = ctx.state;
    if (ctx.mode !== 'play') return;
    const { alpha, inner } = focusVignetteAlpha(state.focus, state.focusNotice?.life ?? null, ctx.t);
    if (alpha < .01) return;
    const w = ctx.W / ctx.scale, h = ctx.H / ctx.scale;
    const left = ctx.cam, top = -ctx.vertical;
    const cx = left + w / 2, cy = top + h / 2;
    const ix = w / 2 * inner, iy = h / 2 * inner;
    const fill = ctx.radialFill(cx, cy, Math.hypot(w, h) / 2, [[inner, '#a3201a00'], [1, '#a3201a']], alpha);
    const band: Vector[] = [
        [left, top], [left + w, top], [left + w, top + h], [left, top + h], [left, cy],
        [cx - ix, cy], [cx - ix, cy + iy], [cx + ix, cy + iy], [cx + ix, cy - iy], [cx - ix, cy - iy], [cx - ix, cy], [left, cy],
    ];
    ctx.gradientPolygon(band, fill);
}
