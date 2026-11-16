import { translate } from '../../../i18n';
import { SPEECH_FONT } from '../../fonts';

import type { Message } from '../../../i18n';
import type { RenderCtx } from '../../context';
import type { Vector } from '../../types';

export const CHAIR_SLATE = '#4c5368';
const CHAIR_INK = '#f4f1ea';

function body(
    ctx: RenderCtx,
    x: number,
    y: number,
    width: number,
    spiky: boolean,
    fill: string,
    gradient: [string, string] | null,
    alpha: number,
) {
    if (spiky) {
        const points: Vector[] = [];
        for (let i = 0; i < 32; i++) {
            const a = (i / 32) * Math.PI * 2;
            const r = i % 2 ? 0.84 : 1;
            points.push([
                x + ((Math.cos(a) * width) / 2) * r,
                y + Math.sin(a) * 32 * r,
            ]);
        }
        ctx.polygon(points, fill);
        return;
    }
    ctx.effectPath(
        [x - width / 2 + 12, y - 22],
        [
            [
                x + width / 2,
                y - 22,
                x + width / 2,
                y - 22,
                x + width / 2,
                y - 10,
            ],
            [
                x + width / 2,
                y + 22,
                x + width / 2,
                y + 22,
                x + width / 2 - 12,
                y + 22,
            ],
            [
                x - width / 2,
                y + 22,
                x - width / 2,
                y + 22,
                x - width / 2,
                y + 10,
            ],
            [
                x - width / 2,
                y - 22,
                x - width / 2,
                y - 22,
                x - width / 2 + 12,
                y - 22,
            ],
        ],
        gradient
            ? ctx.gradientFill(
                  x,
                  y - 22,
                  x,
                  y + 22,
                  [
                      [0, gradient[0]],
                      [1, gradient[1]],
                  ],
                  alpha,
              )
            : fill,
    );
}

export function bubble(
    ctx: RenderCtx,
    text: Message,
    x: number,
    y: number,
    width: number,
    spiky = false,
    alpha = 1,
    tail: boolean | 'right' = true,
): void {
    const fill = ctx.tint(spiky ? '#fff1b2' : '#e2e8df', alpha);
    body(ctx, x, y, width, spiky, fill, ['#ffffff', '#e2e8df'], alpha);
    if (tail) {
        ctx.polygon(
            [
                [x - 8, y + 20],
                [x + 9, y + 20],
                [x + (tail === 'right' ? 18 : -10), y + 36],
            ],
            fill,
        );
    }
    ctx.label(
        translate(text, ctx.locale),
        x,
        y + 5,
        13,
        ctx.tint('#344955', alpha),
        SPEECH_FONT,
    );
}

export function chairBubble(
    ctx: RenderCtx,
    text: Message,
    x: number,
    y: number,
    width: number,
    {
        spiky = false,
        alpha = 1,
        side = -1,
        to,
        dots = 3,
    }: {
        spiky?: boolean;
        alpha?: number;
        side?: number;
        to?: Vector;
        dots?: number;
    } = {},
): void {
    const fill = ctx.tint(CHAIR_SLATE, alpha * 0.92);
    body(ctx, x, y, width, spiky, fill, null, alpha);
    const edge = spiky ? 30 : 22;
    const above = to !== undefined && to[1] < y;
    const start: Vector = [
        to
            ? Math.max(x - width / 2 + 16, Math.min(x + width / 2 - 16, to[0]))
            : x + side * 6,
        above ? y - edge : y + edge,
    ];
    chairTrail(ctx, start, to ?? [x + side * 20, y + 50], fill, dots);
    ctx.label(
        translate(text, ctx.locale),
        x,
        y + 5,
        13,
        ctx.tint(CHAIR_INK, alpha),
        SPEECH_FONT,
    );
}

export function chairTrail(
    ctx: RenderCtx,
    from: Vector,
    to: Vector,
    fill: string,
    dots = 3,
): void {
    const steps =
        dots === 3
            ? [
                  [0.25, 5],
                  [0.58, 3.6],
                  [0.88, 2.4],
              ]
            : Array.from({ length: dots }, (_, i) => [
                  0.12 + (0.82 * i) / (dots - 1),
                  5 - (2.8 * i) / (dots - 1),
              ]);
    for (const [k, r] of steps) {
        ctx.ellipse(
            from[0] + (to[0] - from[0]) * k,
            from[1] + (to[1] - from[1]) * k,
            r,
            r,
            fill,
        );
    }
}
