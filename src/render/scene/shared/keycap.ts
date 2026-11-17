import { LABEL_FONT } from '../../fonts';
import { PathBuilder, push } from '../opening/shapes';

import type { RenderCtx } from '../../context';
import type { Vector } from '../../types';
export type KeyFace = 'left' | 'right' | 'up' | { text: string };
const hex = (a: number) =>
    Math.round(a * 255)
        .toString(16)
        .padStart(2, '0');
const INK = '#2b2f3a';
function keyPath([x, y]: Vector, w: number, h: number, r: number) {
    return new PathBuilder(x + r, y)
        .line(x + w - r, y)
        .corner(x + w, y, x + w, y + r)
        .line(x + w, y + h - r)
        .corner(x + w, y + h, x + w - r, y + h)
        .line(x + r, y + h)
        .corner(x, y + h, x, y + h - r)
        .line(x, y + r)
        .corner(x, y, x + r, y);
}
export function keycapSize(
    ctx: RenderCtx,
    face: KeyFace,
    size: number,
): {
    w: number;
    h: number;
    depth: number;
} {
    const h = size * 1.9;
    const w =
        typeof face === 'string'
            ? h
            : ctx.measureText(face.text, size, LABEL_FONT) + size * 2.6;
    return { w, h, depth: size * 0.35 };
}
export function keycapPress(age: number): 1 | 0 {
    const beat = (age * 1.1) % 1;
    return beat < 0.1 || (beat > 0.2 && beat < 0.3) ? 1 : 0;
}
export function keycapPop(
    age: number,
    pop = 0.25,
): {
    alpha: number;
    scale: number;
} {
    const u = Math.max(0, Math.min(1, age / pop));
    return { alpha: u, scale: 1 + 0.25 * Math.sin(u * Math.PI) };
}
function arrow(
    ctx: RenderCtx,
    face: 'left' | 'right' | 'up',
    [cx, cy]: Vector,
    s: number,
    color: string,
) {
    const angle = face === 'left' ? Math.PI : face === 'up' ? -Math.PI / 2 : 0;
    const shape: Vector[] = [
        [-0.5, -0.12],
        [0.05, -0.12],
        [0.05, -0.4],
        [0.5, 0],
        [0.05, 0.4],
        [0.05, 0.12],
        [-0.5, 0.12],
    ];
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    const [first, ...rest] = shape.map(([x, y]): Vector => [
        cx + (x * c - y * sn) * s,
        cy + (x * sn + y * c) * s,
    ]);
    const path = rest.reduce(
        (b, [x, y]) => b.line(x, y),
        new PathBuilder(first[0], first[1]),
    );
    push(ctx, path.line(first[0], first[1]).command(color));
}
export function keycap(
    ctx: RenderCtx,
    face: KeyFace,
    at: Vector,
    size: number,
    {
        alpha,
        press,
    }: {
        alpha: number;
        press: number;
    },
): void {
    const { w, h, depth } = keycapSize(ctx, face, size);
    const [x, y] = at;
    const top = y + depth * press;
    push(
        ctx,
        keyPath([x, y + depth], w, h, size * 0.45).command(
            '#7c8597' + hex(alpha),
        ),
    );
    push(
        ctx,
        keyPath([x, top], w, h, size * 0.45).command('#f4f1ea' + hex(alpha), {
            width: 2,
            color: INK + hex(alpha),
            cap: 'round',
        }),
    );
    if (typeof face === 'string') {
        arrow(
            ctx,
            face,
            [x + w / 2, top + h / 2],
            size * 1.05,
            INK + hex(alpha),
        );
    } else {
        ctx.screenText(face.text, x + w / 2, top + h / 2, size, {
            fill: INK,
            opts: {
                font: LABEL_FONT,
                opacity: alpha,
            },
        });
    }
}
