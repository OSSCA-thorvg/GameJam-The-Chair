import type { Point3, SkyProjection } from './sky-projection';

const point = ([x, y, z]: Point3, bob: number): Point3 => [x, -y - 35 + bob, z];

// The 3D rider's glasses: two lenses on the front of the face only, joined by a bridge, with arms running back
// along the sides of the head to the ears. Lenses face forward and are culled from behind, so the head hides them.
// Coordinates as the side-view outlines: x forward (the face is at about x 13), y up negative, z across.
const FRONT = 15.2, TOP = -86, BOTTOM = -79.6, INNER = 2.2, OUTER = 11.4;

export function endingGlasses(view: SkyProjection, bob: number) {
    for (const side of [-1, 1]) lens(view, bob, side);
    view.rod(point([FRONT + .2, -83.6, -INNER], bob), point([FRONT + .2, -83.6, INNER], bob), .5, '#50606a');
}

/** A forward-facing quad on the lens plane at `x`, from `top` to `bottom` and across from `z0` to `z1`. */
function facing(view: SkyProjection, bob: number, x: number, top: number, bottom: number, z0: number, z1: number, color: string) {
    const [a, b] = z0 < z1 ? [z0, z1] : [z1, z0];
    // Wound so its normal points forward (+x): seen from behind it is culled.
    view.polygon([point([x, top, a], bob), point([x, top, b], bob), point([x, bottom, b], bob), point([x, bottom, a], bob)], color);
}

function lens(view: SkyProjection, bob: number, side: number) {
    const inner = side * INNER, outer = side * OUTER;
    // Frame, then the blue lens, its pale reflection stripe and the eye behind it, each a hair further forward.
    facing(view, bob, FRONT, TOP, BOTTOM, side * (INNER - .8), side * (OUTER + .8), '#50606a');
    facing(view, bob, FRONT + .15, TOP + .9, BOTTOM - .9, inner, outer, '#83c8e4');
    facing(view, bob, FRONT + .25, TOP + .9, BOTTOM - .9, side * (OUTER - 2.6), side * (OUTER - 1.4), '#bfe6ef');
    facing(view, bob, FRONT + .3, -84, -81.6, side * 5.8, side * 7.2, '#446d82');
    // The arm: round the outer corner of the frame and back along the side of the head to the ear.
    view.rod(point([FRONT, -84, side * (OUTER + .8)], bob), point([13, -84, side * 13.6], bob), .55, '#3a414b');
    view.rod(point([13, -84, side * 13.6], bob), point([-5, -83, side * 14.8], bob), .55, '#3a414b');
}
