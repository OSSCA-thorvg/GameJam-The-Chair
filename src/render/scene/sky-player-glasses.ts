import type { Point3, SkyProjection } from './sky-projection';

const point = ([x, y, z]: Point3, bob: number): Point3 => [x, -y - 35 + bob, z];

export function endingGlasses(view: SkyProjection, bob: number) {
    for (const side of [-1, 1]) lens(view, bob, side);
    view.rod(point([15.5, -83, -2], bob), point([15.5, -83, 2], bob), .5, '#50606a');
}

function pane(view: SkyProjection, bob: number, side: number, vertices: Point3[], color: string) {
    const world = vertices.map(p => point(p, bob));
    // Opaque side panes face outwards, so the far lens cannot show through the head.
    view.polygon(side > 0 ? world.reverse() : world, color);
}

function sidePane(view: SkyProjection, bob: number, side: number) {
    const z = side * 13.2;
    pane(view, bob, side, [[3, -86, z], [14, -86, z], [14, -80, z], [3, -80, z]], '#50606a');
    const surface = side * 13.35;
    // Match the ordinary player's 9-by-4 blue lens and its narrow reflection stripe.
    pane(view, bob, side, [[4, -85, surface], [13, -85, surface], [13, -81, surface], [4, -81, surface]], '#83c8e4');
    const glint = side * 13.45;
    pane(view, bob, side, [[5, -85, glint], [7, -85, glint], [7, -81, glint], [5, -81, glint]], '#bfe6ef');
    const pupil = side * 13.5;
    pane(view, bob, side, [[11.5, -84, pupil], [12.7, -84, pupil], [12.7, -82, pupil], [11.5, -82, pupil]], '#446d82');
}

function lens(view: SkyProjection, bob: number, side: number) {
    sidePane(view, bob, side);
    const z = side * 13.2;
    pane(view, bob, side, [[14, -86, z], [15.5, -85, side * 2],
        [15.5, -80, side * 2], [14, -80, z]], '#83c8e4bb');
    const rim: Point3[] = [[3, -86, z], [14, -86, z], [15.5, -85, side * 2],
        [15.5, -80, side * 2], [14, -80, z], [3, -80, z]];
    for (let i = 0; i < rim.length; i++) {
        view.rod(point(rim[i], bob), point(rim[(i + 1) % rim.length], bob), .4, '#50606a');
    }
    view.rod(point([-5, -83, side * 14.8], bob), point([3, -84, z], bob), .55, '#3a414b');
}
