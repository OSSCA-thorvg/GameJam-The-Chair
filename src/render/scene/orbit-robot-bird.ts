import type { SkyRobot } from '../../game/stages/sky/data';
import type { Vector } from '../types';
import type { Place } from './cctv-models';
import type { Point3, SkyProjection } from './sky-projection';

// The stage four chrome robot parrots, extruded into 3D to stare at the chair among the floating cameras.
// Like the camera models it looks along local +u and returns where its red lens sits.

const BODY: Vector[] = [[26, 5], [21, 10], [12, 12], [0, 11], [-14, 6], [-22, 2], [-18, -4], [-6, -10], [6, -12], [16, -10], [23, -5], [26, 0]];
const BEAK: Vector[] = [[22, 9], [29, 9], [34, 4], [32, -2], [28, 1], [22, 2]];
const TAIL: Vector[] = [[-12, 3], [-28, 5], [-50, 1], [-40, -3], [-26, -6], [-13, -4]];
const CREST: Vector[] = [[12, 11], [16, 18], [20, 15], [19, 10]];

type Finish = { body: string; shine: string; dark: string; beak: string; rim?: string };
const FINISH: Record<SkyRobot, Finish> = {
    liquid: { body: '#c3ccd6', shine: '#f7f9fb', dark: '#4f5b6b', beak: '#2a313b' },
    black: { body: '#2a2f38', shine: '#a8b2c0', dark: '#0b0d10', beak: '#4a525f', rim: '#ff3a1a' },
};

/** Draws one robot parrot; `flap` beats its wings and `cock` tilts its head while it stares. */
export function robotBirdModel(view: SkyProjection, robot: SkyRobot, place: Place, flap: number, cock: number): Point3 {
    const f = FINISH[robot];
    // The head rolls around the look axis, the way a curious bird tilts its head at something odd.
    const cos = Math.cos(cock), sin = Math.sin(cock);
    const head = ([u, v, w]: Point3): Point3 => place([u, 4 + (v - 4) * cos - w * sin, (v - 4) * sin + w * cos]);
    view.profile(TAIL, 3, f.dark, 0, { place });
    view.profile(BODY, 9, f.body, 0, { place, bevel: .7 });
    view.profile([[-8, 8], [4, 11], [14, 10], [6, 7]], .6, f.shine, 8.6, { place });
    view.profile(BEAK, 3.2, f.beak, 0, { place: head });
    view.profile(CREST, 1.5, f.dark, 0, { place: head });
    if (f.rim) view.profile([[-14, 6], [0, 11], [12, 12], [12, 10], [0, 9]], 2, f.rim, 0, { place });
    // Thin wings drawn from both sides ('ff' alpha skips back-face culling) sweep up and down from the shoulders.
    const lift = Math.sin(flap) * .9, spread = Math.cos(Math.sin(flap) * .9);
    for (const side of [-1, 1]) {
        const wing = ([u, span, thick]: Point3): Point3 => place([u, 2 + span * Math.sin(lift) + thick, side * (8 + span * spread)]);
        view.profile([[8, 0], [-2, 30], [-18, 34], [-14, 14], [-8, 0]], .8, f.body + 'ff', 0, { place: wing });
    }
    let lens: Point3 = place([0, 0, 0]);
    for (const side of [-1, 1]) {
        view.oval(head([16, 4, side * 8]), [4.5, 4.5, 4.5], '#07080a');
        lens = head([17, 4, side * 9.5]);
        view.oval(lens, [3, 3, 3], '#ff3a1a');
        view.oval(head([17.5, 5, side * 10.5]), [1, 1, 1], '#fff3b0');
    }
    return lens;
}
