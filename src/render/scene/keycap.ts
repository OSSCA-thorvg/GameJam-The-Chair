import type { RenderCtx } from '../context';
import type { Vector } from '../types';
import { LABEL_FONT } from '../fonts';
import { PathBuilder, push } from './opening/shapes';

export type KeyFace = 'left' | 'right' | 'up' | { text: string };

const hex = (a: number) => Math.round(a * 255).toString(16).padStart(2, '0');
const INK = '#2b2f3a';

function keyPath([x, y]: Vector, w: number, h: number, r: number) {
    return new PathBuilder(x + r, y)
        .line(x + w - r, y).corner(x + w, y, x + w, y + r)
        .line(x + w, y + h - r).corner(x + w, y + h, x + w - r, y + h)
        .line(x + r, y + h).corner(x, y + h, x, y + h - r)
        .line(x, y + r).corner(x, y, x + r, y);
}

export function keycapSize(ctx: RenderCtx, face: KeyFace, size: number) {
    const h = size * 1.9;
    const w = typeof face === 'string' ? h : ctx.measureText(face.text, size, LABEL_FONT) + size * 2.6;
    return { w, h, depth: size * .35 };
}

export function keycapPress(age: number) {
    const beat = (age * 1.1) % 1;
    return beat < .1 || (beat > .2 && beat < .3) ? 1 : 0;
}

export function keycapPop(age: number, pop = .25) {
    const u = Math.max(0, Math.min(1, age / pop));
    return { alpha: u, scale: 1 + .25 * Math.sin(u * Math.PI) };
}

function arrow(ctx: RenderCtx, face: 'left' | 'right' | 'up', [cx, cy]: Vector, s: number, color: string) {
    const angle = face === 'left' ? Math.PI : face === 'up' ? -Math.PI / 2 : 0;
    const shape: Vector[] = [[-.5, -.12], [.05, -.12], [.05, -.4], [.5, 0], [.05, .4], [.05, .12], [-.5, .12]];
    const c = Math.cos(angle), sn = Math.sin(angle);
    const [first, ...rest] = shape.map(([x, y]): Vector => [cx + (x * c - y * sn) * s, cy + (x * sn + y * c) * s]);
    const path = rest.reduce((b, [x, y]) => b.line(x, y), new PathBuilder(first[0], first[1]));
    push(ctx, path.line(first[0], first[1]).command(color));
}

export function keycap(ctx: RenderCtx, face: KeyFace, at: Vector, size: number, alpha: number, press: number) {
    const { w, h, depth } = keycapSize(ctx, face, size);
    const [x, y] = at, top = y + depth * press;
    push(ctx, keyPath([x, y + depth], w, h, size * .45).command('#7c8597' + hex(alpha)));
    push(ctx, keyPath([x, top], w, h, size * .45).command('#f4f1ea' + hex(alpha), { width: 2, color: INK + hex(alpha), cap: 'round' }));
    if (typeof face === 'string') arrow(ctx, face, [x + w / 2, top + h / 2], size * 1.05, INK + hex(alpha));
    else ctx.screenText(face.text, x + w / 2, top + h / 2, size, INK, { font: LABEL_FONT, opacity: alpha });
}
