import type { Point3, SkyProjection } from './sky-projection';

const point = ([x, y, z]: Point3, bob: number): Point3 => [x, -y - 35 + bob, z];

// The 3D rider's glasses: two large flat lenses on the front of the face, joined by a bridge, with arms running
// back along the sides of the head to the ears. Face on, each lens is a blue surface; side on it is edge-on, so it
// shows as a thin line: the glass edge, drawn as a slim rod, and the frame above and below it.
// Lens faces point forward and are culled from behind, so the head hides them.
// Coordinates as the side-view outlines: x forward (the face is at about x 13), y up negative, z across.
const FRONT = 15.2, TOP = -87.6, BOTTOM = -79, INNER = 1.6, OUTER = 10.6;

export function endingGlasses(view: SkyProjection, bob: number) {
    for (const side of [-1, 1]) lens(view, bob, side);
    view.rod(point([FRONT, -84.6, -INNER], bob), point([FRONT, -84.6, INNER], bob), .55, '#50606a');
}

/** A forward-facing quad on the lens plane at `x`, from `top` to `bottom` and across from `z0` to `z1`. */
function facing(view: SkyProjection, bob: number, x: number, top: number, bottom: number, z0: number, z1: number, color: string) {
    const [a, b] = z0 < z1 ? [z0, z1] : [z1, z0];
    // Wound so its normal points forward (+x): seen from behind it is culled.
    view.polygon([point([x, top, a], bob), point([x, top, b], bob), point([x, bottom, b], bob), point([x, bottom, a], bob)], color);
}

function lens(view: SkyProjection, bob: number, side: number) {
    const inner = side * INNER, outer = side * OUTER;
    // The blue lens face, its pale reflection stripe and the eye behind it.
    facing(view, bob, FRONT, TOP, BOTTOM, inner, outer, '#83c8e4');
    facing(view, bob, FRONT + .1, TOP + .7, BOTTOM - .7, side * (OUTER - 3), side * (OUTER - 1.6), '#bfe6ef');
    facing(view, bob, FRONT + .15, -84.6, -81.8, side * 5.2, side * 6.8, '#446d82');
    // The glass edge: a slim blue line down each side, which is all of the lens that shows side on.
    for (const z of [inner, outer]) view.rod(point([FRONT, TOP, z], bob), point([FRONT, BOTTOM, z], bob), .6, '#83c8e4');
    // The frame along the top and bottom of the lens.
    for (const y of [TOP, BOTTOM]) view.rod(point([FRONT, y, inner], bob), point([FRONT, y, outer], bob), .5, '#50606a');
    // The arm: from the outer edge of the frame back along the side of the head to the ear.
    view.rod(point([FRONT, -84.6, outer], bob), point([13, -84.6, side * 13.6], bob), .55, '#3a414b');
    view.rod(point([13, -84.6, side * 13.6], bob), point([-5, -83, side * 14.8], bob), .55, '#3a414b');
}
