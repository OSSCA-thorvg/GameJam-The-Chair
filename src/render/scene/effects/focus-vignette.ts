import type { Vector } from '../../types';
import type { RenderCtx } from '../../context';
import { FOCUS_LOSS_DURATION } from '../../../game/systems/focus/decide';

const BEAT_RATE = 1;
const TIERS = [
    { below: 20, strength: 0.85, inner: 0.42 },
    { below: 40, strength: 0.62, inner: 0.5 },
    { below: 60, strength: 0.42, inner: 0.57 },
    { below: Infinity, strength: 0.26, inner: 0.64 },
] as const;

const bump = (x: number) => Math.exp(-x * x);
const beat = (phase: number) =>
    bump((phase - 0.08) / 0.07) + 0.6 * bump((phase - 0.3) / 0.08);

export function focusVignetteAlpha(
    focus: number,
    noticeLife: number | null,
    time: number,
) {
    const tier =
        TIERS.find((item) => focus <= item.below) ?? TIERS[TIERS.length - 1];
    let alpha = 0;
    if (noticeLife !== null && noticeLife > 0) {
        const age = FOCUS_LOSS_DURATION - noticeLife;
        const fade = Math.min(1, noticeLife / 0.5);
        alpha = tier.strength * Math.min(1, beat(age * BEAT_RATE)) * fade;
    }
    if (focus <= 20) {
        alpha = Math.max(alpha, 0.16 * (0.5 + 0.5 * beat((time * 1.2) % 1)));
    }
    return { alpha, inner: tier.inner };
}

export function focusVignette(ctx: RenderCtx) {
    const state = ctx.state;
    if (ctx.mode !== 'play') return;
    const { alpha, inner } = focusVignetteAlpha(
        state.focus,
        state.focusNotice?.life ?? null,
        ctx.t,
    );
    if (alpha < 0.01) return;
    const w = ctx.W / ctx.scale,
        h = ctx.H / ctx.scale;
    const left = ctx.cam,
        top = -ctx.vertical;
    const cx = left + w / 2,
        cy = top + h / 2;
    const ix = (w / 2) * inner,
        iy = (h / 2) * inner;
    const fill = ctx.radialFill(
        cx,
        cy,
        Math.hypot(w, h) / 2,
        [
            [inner, '#a3201a00'],
            [1, '#a3201a'],
        ],
        alpha,
    );
    const band: Vector[] = [
        [left, top],
        [left + w, top],
        [left + w, top + h],
        [left, top + h],
        [left, cy],
        [cx - ix, cy],
        [cx - ix, cy + iy],
        [cx + ix, cy + iy],
        [cx + ix, cy - iy],
        [cx - ix, cy - iy],
        [cx - ix, cy],
        [left, cy],
    ];
    ctx.gradientPolygon(band, fill);
}
