import { SPEECH_FONT } from '../../fonts';
import { PathBuilder, push } from '../opening/shapes';

import type { RenderCtx } from '../../context';
import type { Vector } from '../../types';
const MARKS = ['!', '✓', '…'];
const INK = '#2b2f3a';
export function orbitReaction(
    ctx: RenderCtx,
    head: Vector,
    age: number,
    lit: boolean,
): void {
    if (!lit) {
        return;
    }
    const beat = age - Math.floor(age);
    const u = Math.min(1, beat / 0.18);
    const scale = 0.55 + 0.45 * (1 + 2.4 * (u - 1) ** 3 + 1.4 * (u - 1) ** 2);
    const size = ctx.clamp(ctx.H * 0.05, 16, 28);
    const tip: Vector = [head[0] + size * 0.8, head[1] - size * 0.65];
    const cx = ctx.clamp(
        head[0] + size * 2.45,
        size * 1.35,
        ctx.W - size * 1.35,
    );
    const cy = ctx.clamp(head[1] - size * 1.15, size, ctx.H - size);
    const rx = size * 1.05;
    const ry = size * 0.83;
    const { path, at } = orbitReactionDetails(tip, scale, cx, cy, {
        ry,
        rx,
        size,
    });
    ctx.beginLayer({
        key: 'orbit-reaction-shadow',
        blur: size * 0.28,
        opacity: 0.35,
    });
    push(ctx, path.command('#101b32'));
    ctx.endLayer();
    ctx.beginLayer({ key: 'orbit-reaction' });
    push(ctx, path.command('#ffffff', { width: 2, color: INK, cap: 'round' }));
    ctx.screenText(
        MARKS[Math.floor(age) % MARKS.length],
        at(cx, cy + size * 0.04)[0],
        at(cx, cy + size * 0.04)[1],
        size * 1.05 * scale,
        {
            fill: INK,
            opts: { font: SPEECH_FONT },
        },
    );
    ctx.endLayer();
}
function orbitReactionDetails(
    tip: Vector,
    scale: number,
    cx: number,
    cy: number,
    {
        ry,
        rx,
        size,
    }: {
        ry: number;
        rx: number;
        size: number;
    },
) {
    const at = (x: number, y: number): Vector => [
        tip[0] + (x - tip[0]) * scale,
        tip[1] + (y - tip[1]) * scale,
    ];
    const path = new PathBuilder(...at(cx, cy - ry))
        .cubic(
            at(cx + rx * 0.62, cy - ry)[0],
            at(cx + rx * 0.62, cy - ry)[1],
            at(cx + rx, cy - ry * 0.55)[0],
            at(cx + rx, cy - ry * 0.55)[1],
            {
                x: at(cx + rx, cy)[0],
                y: at(cx + rx, cy)[1],
            },
        )
        .cubic(
            at(cx + rx, cy + ry * 0.55)[0],
            at(cx + rx, cy + ry * 0.55)[1],
            at(cx + rx * 0.62, cy + ry)[0],
            at(cx + rx * 0.62, cy + ry)[1],
            {
                x: at(cx, cy + ry)[0],
                y: at(cx, cy + ry)[1],
            },
        )
        .cubic(
            at(cx - rx * 0.38, cy + ry)[0],
            at(cx - rx * 0.38, cy + ry)[1],
            at(cx - rx * 0.72, cy + ry * 0.72)[0],
            at(cx - rx * 0.72, cy + ry * 0.72)[1],
            {
                x: at(cx - rx * 0.9, cy + ry * 0.34)[0],
                y: at(cx - rx * 0.9, cy + ry * 0.34)[1],
            },
        )
        .cubic(
            at(cx - rx * 0.98, cy + ry * 0.42)[0],
            at(cx - rx * 0.98, cy + ry * 0.42)[1],
            at(tip[0] + size * 0.08, tip[1] - size * 0.04)[0],
            at(tip[0] + size * 0.08, tip[1] - size * 0.04)[1],
            {
                x: tip[0],
                y: tip[1],
            },
        )
        .cubic(
            at(tip[0] + size * 0.12, tip[1] - size * 0.16)[0],
            at(tip[0] + size * 0.12, tip[1] - size * 0.16)[1],
            at(cx - rx * 1.02, cy + ry * 0.08)[0],
            at(cx - rx * 1.02, cy + ry * 0.08)[1],
            {
                x: at(cx - rx, cy)[0],
                y: at(cx - rx, cy)[1],
            },
        )
        .cubic(
            at(cx - rx, cy - ry * 0.55)[0],
            at(cx - rx, cy - ry * 0.55)[1],
            at(cx - rx * 0.62, cy - ry)[0],
            at(cx - rx * 0.62, cy - ry)[1],
            {
                x: at(cx, cy - ry)[0],
                y: at(cx, cy - ry)[1],
            },
        );
    return { path, at };
}
