import { translate, type Message } from '../../i18n';
import type { RenderCtx } from '../context';
import { SPEECH_FONT } from '../fonts';
import type { Vector } from '../types';

/** The chairs' own slate, shared with the opening: every bubble a chair speaks is this colour with light words. */
export const CHAIR_SLATE = '#4c5368';
const CHAIR_INK = '#f4f1ea';

/** A rounded bubble body, or a spiky burst, centred on (x, y). */
function body(ctx: RenderCtx, x: number, y: number, width: number, spiky: boolean, fill: string, gradient: [string, string] | null, alpha: number) {
    if (spiky) {
        const points: Vector[] = [];
        for (let i = 0; i < 32; i++) {
            const a = i / 32 * Math.PI * 2, r = i % 2 ? .84 : 1;
            points.push([x + Math.cos(a) * width / 2 * r, y + Math.sin(a) * 32 * r]);
        }
        ctx.polygon(points, fill);
        return;
    }
    ctx.effectPath([x - width / 2 + 12, y - 22], [
        [x + width / 2, y - 22, x + width / 2, y - 22, x + width / 2, y - 10],
        [x + width / 2, y + 22, x + width / 2, y + 22, x + width / 2 - 12, y + 22],
        [x - width / 2, y + 22, x - width / 2, y + 22, x - width / 2, y + 10],
        [x - width / 2, y - 22, x - width / 2, y - 22, x - width / 2 + 12, y - 22],
    ], gradient ? ctx.gradientFill(x, y - 22, x, y + 22, [[0, gradient[0]], [1, gradient[1]]], alpha) : fill);
}

/** A person's bubble: pale, with a pointed tail. */
export function bubble(ctx: RenderCtx, text: Message, x: number, y: number, width: number, spiky = false, alpha = 1, tail: boolean | 'right' = true) {
    const fill = ctx.tint(spiky ? '#fff1b2' : '#e2e8df', alpha);
    body(ctx, x, y, width, spiky, fill, ['#ffffff', '#e2e8df'], alpha);
    if (tail) ctx.polygon([[x - 8, y + 20], [x + 9, y + 20], [x + (tail === 'right' ? 18 : -10), y + 36]], fill);
    ctx.label(translate(text, ctx.locale), x, y + 5, 13, ctx.tint('#344955', alpha), SPEECH_FONT);
}

/**
 * A chair's bubble, drawn like the opening's: slate with light words, and a trail of small bubbles in place of
 * a tail. `to` is the point the trail runs down to (the speaking chair); omitted, a short trail drops below.
 */
export function chairBubble(ctx: RenderCtx, text: Message, x: number, y: number, width: number,
    { spiky = false, alpha = 1, side = -1, to, dots = 3 }: { spiky?: boolean; alpha?: number; side?: number; to?: Vector; dots?: number } = {}) {
    const fill = ctx.tint(CHAIR_SLATE, alpha * .92);
    body(ctx, x, y, width, spiky, fill, null, alpha);
    // The trail leaves the edge that faces the chair: the bottom, or the top when the chair sits above the bubble.
    const edge = spiky ? 30 : 22, above = to !== undefined && to[1] < y;
    const start: Vector = [to ? Math.max(x - width / 2 + 16, Math.min(x + width / 2 - 16, to[0])) : x + side * 6, above ? y - edge : y + edge];
    chairTrail(ctx, start, to ?? [x + side * 20, y + 50], fill, dots);
    ctx.label(translate(text, ctx.locale), x, y + 5, 13, ctx.tint(CHAIR_INK, alpha), SPEECH_FONT);
}

/** `dots` shrinking bubbles from a bubble's edge toward the chair that is talking (three by default). */
export function chairTrail(ctx: RenderCtx, from: Vector, to: Vector, fill: string, dots = 3) {
    const steps = dots === 3 ? [[.25, 5], [.58, 3.6], [.88, 2.4]]
        : Array.from({ length: dots }, (_, i) => [.12 + .82 * i / (dots - 1), 5 - 2.8 * i / (dots - 1)]);
    for (const [k, r] of steps) {
        ctx.ellipse(from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, r, r, fill);
    }
}
