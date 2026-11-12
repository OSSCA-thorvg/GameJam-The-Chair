import type { SkyProjection, Point3 } from './sky-projection';
import { STAGE_FIVE } from '../../game/stages/orbit/data';

export function orbitHoop(view: SkyProjection, center: Point3, radius: number, passed: boolean, time: number) {
    const [z, y, x] = center;
    const color = passed ? '#9ab8b06b' : '#b4f2d5';
    for (let i = 0; i < 64; i++) {
        const a = i * Math.PI / 32, b = (i + 1) * Math.PI / 32;
        const point = (angle: number, r: number): Point3 => [z, y + Math.sin(angle) * r, x + Math.cos(angle) * r];
        view.polygon([point(a, radius - 4), point(b, radius - 4), point(b, radius + 4), point(a, radius + 4)], color + (passed ? '' : 'ee'));
        if (!passed && i % 8 === 0) {
            view.oval(point(a, radius), [7, 7, 7], '#e5fff0');
        }
    }
    if (!passed) {
        const r = radius + 17 + Math.sin(time * 2) * 3;
        for (let i = 0; i < 48; i++) {
            const a = i * Math.PI / 24, b = (i + .55) * Math.PI / 24;
            view.polygon([[z, y + Math.sin(a) * r, x + Math.cos(a) * r],
                [z, y + Math.sin(b) * r, x + Math.cos(b) * r],
                [z, y + Math.sin(b) * (r + 2), x + Math.cos(b) * (r + 2)],
                [z, y + Math.sin(a) * (r + 2), x + Math.cos(a) * (r + 2)]], '#d6ffdf55');
        }
    }
}

function box(view: SkyProjection, min: Point3, max: Point3, color: string) {
    const [a, b, c] = min, [d, e, f] = max;
    const faces: Point3[][] = [
        [[a,b,c],[a,e,c],[a,e,f],[a,b,f]], [[d,b,f],[d,e,f],[d,e,c],[d,b,c]],
        [[a,b,f],[a,e,f],[d,e,f],[d,b,f]], [[d,b,c],[d,e,c],[a,e,c],[a,b,c]],
        [[a,e,f],[a,e,c],[d,e,c],[d,e,f]], [[a,b,c],[a,b,f],[d,b,f],[d,b,c]],
    ];
    for (const face of faces) view.polygon(face, color);
}

export function orbitDrawer(view: SkyProjection, center: Point3, parked: boolean, time: number) {
    const [z, y, x] = center;
    const { width, height, depth } = STAGE_FIVE.drawer;
    const left = x - width / 2, right = x + width / 2;
    const floor = y - height / 2, top = y + height / 2;
    box(view, [z, floor - 30, left - 25], [z + depth, floor, right + 25], '#8c9d9f');
    box(view, [z, floor, left - 25], [z + depth, top, left], '#b5c3c0');
    box(view, [z, floor, right], [z + depth, top, right + 25], '#9daeb0');
    box(view, [z + depth - 25, floor, left], [z + depth, top, right], '#b8c1b5');
    box(view, [z - 30, floor - 30, left - 25], [z, floor + 105, right + 25], '#7d8d98');
    view.rod([z - 40, floor + 44, x - 90], [z - 40, floor + 44, x + 90], 10, '#485968');
    for (const side of [-90, 90]) view.rod([z - 40, floor + 44, x + side], [z - 29, floor + 44, x + side], 7, '#647584');
    // Warm paper bundles form a generous, visible cushion at the far wall.
    for (let i = 0; i < 8; i++) {
        const px = left + 80 + i * (width - 160) / 8;
        const pile = 65 + (i % 3) * 32;
        box(view, [z + depth - 170, floor + 6, px], [z + depth - 35, floor + pile, px + 85], '#e8d2a6');
        for (let j = 1; j < 4; j++) view.rod([z + depth - 172, floor + j * 14, px], [z + depth - 172, floor + j * 14, px + 85], 1.4, '#bcae95');
    }
    for (const side of [left, right]) view.rod([z, floor, side], [z + depth, floor, side], 4, '#e6dbbb');
    view.rod([z + 10, floor + 5, left], [z + 10, floor + 5, right], 6, parked ? '#b3f0c5' : '#e9c487');
    view.rod([z + depth, top + 3, left], [z + depth, top + 3, right], 5, '#ead6af');
    view.oval([z + depth - 28, y, x], [2, 180, 280], parked ? '#c3f6bf35' : '#ffd89d27');
    for (let i = 0; i < 5; i++) {
        const drift = (time * 35 + i * 97) % 620;
        const cz = z - 250 + drift, cy = y + 180 + Math.sin(time + i) * 20, cx = x + (i - 2) * 120;
        view.polygon([[cz,cy,cx],[cz+28,cy+4,cx+24],[cz+58,cy+5,cx+24],[cz+30,cy,cx]], '#f6e6dfaa');
    }
}
