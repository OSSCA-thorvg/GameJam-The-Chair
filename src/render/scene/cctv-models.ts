import type { Vector } from '../types';
import type { Point3, SkyProjection } from './sky-projection';

// Floating security cameras, extruded from side silhouettes like the stage four 3D chair.
// Every model looks along its local +u axis and returns where its red lamp sits.

export const CCTV_KINDS = ['bullet', 'dome', 'ptz', 'webcam', 'long'] as const;
export type CctvKind = typeof CCTV_KINDS[number];

/** Local silhouette space (u across, v up, w out of the face) turned by `yaw` and moved to `anchor`. */
export function placer(anchor: Point3, yaw: number, scale = 1) {
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    return ([u, v, w]: Point3): Point3 =>
        [anchor[0] + (u * cos + w * sin) * scale, anchor[1] + v * scale, anchor[2] + (w * cos - u * sin) * scale];
}
export type Place = ReturnType<typeof placer>;

/** Yaw that turns a silhouette's local `u` axis toward `(ahead, across)` in projection space. */
export const aim = (ahead: number, across: number) => Math.atan2(-across, ahead);
export const rect = (u0: number, v0: number, u1: number, v1: number): Vector[] => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

type Model = (view: SkyProjection, place: Place) => Point3;

function lens(view: SkyProjection, place: Place, u: number, v: number, radius: number) {
    view.oval(place([u, v, 0]), [radius * .6, radius, radius], '#27344d');
    view.oval(place([u + 1, v + radius * .25, 0]), [radius * .25, radius * .35, radius * .35], '#7d9fbb');
}

/** The classic box camera with a sun hood. */
const bullet: Model = (view, place) => {
    view.profile([[-24, -8], [14, -10], [20, -7], [20, 7], [14, 10], [-24, 8], [-28, 4], [-28, -4]], 9, '#dcd7cf', 0, { place });
    view.profile([[-26, 9], [24, 11], [30, 16], [-26, 15]], 11, '#b9b6bb', 0, { place });
    view.profile([[-20, -3], [10, -4], [10, 0], [-20, 1]], .5, '#b1bdc9', 9.5, { place });
    view.profile(rect(-30, -5, -26, 5), 6, '#69738c', 0, { place });
    lens(view, place, 21, 0, 6);
    return place([-14, 21, 0]);
};

/** A ceiling dome with no ceiling: a smoked glass bubble under a round plate. */
const dome: Model = (view, place) => {
    view.profile([[-20, 6], [20, 6], [22, 10], [-22, 10]], 20, '#c9ccd4', 0, { place });
    view.oval(place([0, 0, 0]), [17, 13, 17], '#3a455f');
    view.oval(place([6, -2, 0]), [6, 6, 6], '#27344d');
    view.oval(place([-5, 5, -6]), [4, 3, 3], '#8d9bb4');
    return place([-14, 14, 0]);
};

/** A pan-tilt camera: a ball base with a squat head on top. */
const ptz: Model = (view, place) => {
    view.oval(place([0, -6, 0]), [14, 12, 14], '#f2ede4');
    view.oval(place([0, -16, 0]), [9, 3, 9], '#69738c');
    view.profile([[-10, 2], [16, 2], [20, 6], [20, 14], [16, 18], [-10, 18]], 8, '#dcd7cf', 0, { place });
    view.profile(rect(-8, 15, 14, 17), .4, '#b1bdc9', 8.4, { place });
    lens(view, place, 20, 10, 5);
    return place([-6, 23, 0]);
};

/** A round desk webcam on a little stand, its lamp right beside the lens. */
const webcam: Model = (view, place) => {
    view.profile([[-6, -12], [6, -12], [10, -22], [-10, -22]], 7, '#424f6d', 0, { place });
    view.oval(place([0, 0, 0]), [7, 13, 13], '#3a455f');
    view.oval(place([3, 0, 0]), [4, 10, 10], '#69738c');
    lens(view, place, 7, 0, 6);
    return place([5, 9, 7]);
};

/** A long-range camera with a deep hood. */
const long: Model = (view, place) => {
    view.profile([[-40, -7], [22, -8], [26, -5], [26, 5], [22, 8], [-40, 7]], 8, '#c9ccd4', 0, { place });
    view.profile([[-42, 9], [30, 11], [38, 16], [-42, 14]], 10, '#9aa0b0', 0, { place });
    view.profile(rect(-46, -4, -40, 4), 5, '#424f6d', 0, { place });
    lens(view, place, 27, 0, 6.5);
    return place([-30, 19, 0]);
};

const MODELS: Record<CctvKind, Model> = { bullet, dome, ptz, webcam, long };

/** Draws one camera model; returns where its lamp goes. */
export function cctvModel(view: SkyProjection, kind: CctvKind, place: Place) {
    return MODELS[kind](view, place);
}
