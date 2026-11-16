import type { Point3, SkyProjection } from '../shared/projection';

const point = ([x, y, z]: Point3, bob: number): Point3 => [x, -y - 35 + bob, z];

const FRONT = 15.2;
const TOP = -87.6;
const BOTTOM = -79;
const INNER = 1.6;
const OUTER = 10.6;

export function endingGlasses(view: SkyProjection, bob: number): void {
    for (const side of [-1, 1]) {
        lens(view, bob, side);
    }
    view.rod(
        point([FRONT, -84.6, -INNER], bob),
        point([FRONT, -84.6, INNER], bob),
        0.55,
        '#50606a',
    );
}

function facing(
    view: SkyProjection,
    bob: number,
    x: number,
    top: number,
    bottom: number,
    z0: number,
    z1: number,
    color: string,
) {
    const [a, b] = z0 < z1 ? [z0, z1] : [z1, z0];
    view.polygon(
        [
            point([x, top, a], bob),
            point([x, top, b], bob),
            point([x, bottom, b], bob),
            point([x, bottom, a], bob),
        ],
        color,
    );
}

function lens(view: SkyProjection, bob: number, side: number) {
    const inner = side * INNER;
    const outer = side * OUTER;
    facing(view, bob, FRONT, TOP, BOTTOM, inner, outer, '#83c8e4');
    facing(
        view,
        bob,
        FRONT + 0.1,
        TOP + 0.7,
        BOTTOM - 0.7,
        side * (OUTER - 3),
        side * (OUTER - 1.6),
        '#bfe6ef',
    );
    facing(
        view,
        bob,
        FRONT + 0.15,
        -84.6,
        -81.8,
        side * 5.2,
        side * 6.8,
        '#446d82',
    );
    for (const z of [inner, outer]) {
        view.rod(
            point([FRONT, TOP, z], bob),
            point([FRONT, BOTTOM, z], bob),
            0.6,
            '#83c8e4',
        );
    }
    for (const y of [TOP, BOTTOM]) {
        view.rod(
            point([FRONT, y, inner], bob),
            point([FRONT, y, outer], bob),
            0.5,
            '#50606a',
        );
    }
    view.rod(
        point([FRONT, -84.6, outer], bob),
        point([13, -84.6, side * 13.6], bob),
        0.55,
        '#3a414b',
    );
    view.rod(
        point([13, -84.6, side * 13.6], bob),
        point([-5, -83, side * 14.8], bob),
        0.55,
        '#3a414b',
    );
}
