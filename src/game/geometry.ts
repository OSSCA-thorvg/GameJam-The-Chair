import type { Point } from './types';

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function polyRect(x: number, y: number, w: number, h: number): Point[] {
    return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
}

export function contact(cx: number, cy: number, r: number, poly: Point[]) {
    let best = Infinity;
    let nx = 0;
    let ny = 0;
    let inside = true;
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const ex = b.x - a.x;
        const ey = b.y - a.y;
        const den = ex * ex + ey * ey;
        const u = clamp(((cx - a.x) * ex + (cy - a.y) * ey) / den, 0, 1);
        const dx = cx - a.x - u * ex;
        const dy = cy - a.y - u * ey;
        const d = Math.hypot(dx, dy);
        if (ex * (cy - a.y) - ey * (cx - a.x) < 0) {
            inside = false;
        }
        if (d < best) {
            best = d;
            nx = d > .00001 ? dx / d : ey / Math.sqrt(den);
            ny = d > .00001 ? dy / d : -ex / Math.sqrt(den);
        }
    }
    return inside ? { nx: -nx, ny: -ny, depth: r + best } : best < r ? { nx, ny, depth: r - best } : null;
}
