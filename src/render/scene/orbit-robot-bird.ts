import type { SkyRobot } from '../../game/stages/sky/data';
import type { Curve, Vector } from '../types';
import type { Place } from './cctv-models';
import type { Point3, SkyProjection } from './sky-projection';

// The stage four chrome robot parrots (sky-robot-parrot.ts) extruded into 3D. The side outlines are sampled
// from the very same 2D paths, mirrored so the bird looks along local +u like the camera models.

type Path = { start: Vector; curves: Curve[] };

/** Samples a 2D bezier path (head to the left, y down) into a side outline (head toward +u, v up). */
function outline({ start, curves }: Path, steps = 6): Vector[] {
    const points: Vector[] = [];
    let [x0, y0] = start;
    for (const [ax, ay, bx, by, x1, y1] of curves) {
        for (let i = 0; i < steps; i++) {
            const t = i / steps, s = 1 - t;
            const x = s * s * s * x0 + 3 * s * s * t * ax + 3 * s * t * t * bx + t * t * t * x1;
            const y = s * s * s * y0 + 3 * s * s * t * ay + 3 * s * t * t * by + t * t * t * y1;
            points.push([-x, -y]);
        }
        [x0, y0] = [x1, y1];
    }
    return points;
}

/** A thin closed band along an open 2D stroke, for the shine and the black chrome's red rim. */
function band(path: Path, width: number): Vector[] {
    const line = outline(path, 8);
    line.push([-path.curves.at(-1)![4], -path.curves.at(-1)![5]]);
    return [...line.map(([u, v]) => [u, v + width / 2] as Vector), ...line.reverse().map(([u, v]) => [u, v - width / 2] as Vector)];
}

const BODY = outline({ start: [-22, -10], curves: [[-14, -18, 2, -12, 14, -5], [22, 0, 16, 10, 4, 11], [-6, 12, -14, 6, -18, 2], [-24, -2, -26, -6, -22, -10]] });
const BEAK = outline({ start: [-22, -8], curves: [[-28, -10, -33, -5, -31, 1], [-28, 0, -25, -1, -22, -1]] });
const TAIL = outline({ start: [12, -3], curves: [[26, -6, 40, -6, 52, -3], [40, 2, 26, 6, 13, 5]] });
// The 2D far wing at the top of its beat, its full swept-back shape; both 3D wings spread it out sideways.
const WING = outline({ start: [2, -3], curves: [[8, -24, 16, -34, 26, -26], [18, -13, 12, -2, 12, 1]] });
// The darker lower half of the 2D chrome gradient.
const BELLY = outline({ start: [16, 3], curves: [[18, 7, 14, 10, 4, 11], [-6, 12, -14, 6, -18, 2], [-6, 2.5, 6, 2.8, 16, 3]] });
const SHINE = band({ start: [-16, -12], curves: [[-8, -15, 4, -11, 12, -6]] }, 1.6);
const RIM = band({ start: [-22, -10], curves: [[-14, -17, 2, -12, 14, -5]] }, 1.4);
const EYE: Vector = [14, 5];
const SHOULDER = 1;

type Finish = { body: string; belly: string; tail: string; wing: string; beak: string; shine: string; eye: number; rim?: string };
const FINISH: Record<SkyRobot, Finish> = {
    liquid: { body: '#cfd8e2', belly: '#7d8ea3', tail: '#dfe6ee', wing: '#8a98aa', beak: '#9aa7b6', shine: '#ffffff', eye: 4 },
    black: { body: '#2f353f', belly: '#0d0f13', tail: '#262b33', wing: '#16191e', beak: '#3a414c', shine: '#6b7584', eye: 4.4, rim: '#ff3a1a' },
};

// The droplet is widest behind the head and thins toward the tail tip and the beak.
const HALF = 8;
const bodyWidth = (u: number) => HALF * Math.max(.35, 1 - Math.max(0, 2 - u) / 24 * .55 - Math.max(0, u - 16) / 10 * .35);

/** The 2D lens eye as stacked discs bulging from the side of the head: chrome ring, black bezel, red lens, glint. */
function lensEye(view: SkyProjection, place: Place, side: number, r: number) {
    // Oval radii are in scene units, so they take the placer's scale.
    const [a, b] = [place([0, 0, 0]), place([1, 0, 0])];
    const scale = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const w = side * (bodyWidth(EYE[0]) * .92);
    const disc = (out: number, radius: number, color: string, du = 0, dv = 0) =>
        view.oval(place([EYE[0] + du, EYE[1] + dv, w + side * out]), [radius * scale, radius * scale, radius * .45 * scale], color);
    disc(0, r * 1.3, '#a9b4c2');
    disc(.5, r * 1.05, '#07080a');
    disc(.9, r * .82, '#d81e10');
    disc(1.2, r * .45, '#ff7a2a');
    disc(1.4, r * .2, '#fff3b0');
    disc(1.6, r * .22, '#ffffff', r * .35, r * .4);
    return place([EYE[0], EYE[1], w + side * 1.6]);
}

/** Draws one robot parrot; `spin` is the 2D hazard's wing beat. Returns both lens eyes and their glow radius. */
export function robotBirdModel(view: SkyProjection, robot: SkyRobot, place: Place, spin: number) {
    const f = FINISH[robot];
    view.profile(TAIL, 3, f.tail, 0, { place });
    view.profile(BODY, HALF, f.body, 0, { place, bevel: .72, widthAt: u => bodyWidth(u) });
    view.profile(BELLY, HALF + .7, f.belly, 0, { place, bevel: .8, widthAt: u => bodyWidth(u) + .7 });
    view.profile(BEAK, 2.6, f.beak, 0, { place });
    view.profile(SHINE, HALF + .4, f.shine, 0, { place, widthAt: u => bodyWidth(u) + .4 });
    if (f.rim) view.profile(RIM, HALF + .5, f.rim, 0, { place, widthAt: u => bodyWidth(u) + .5 });
    // Wings spread wide in a V that beats down to level; the leading edge tips up so the wing faces ahead too.
    const angle = .95 + .55 * Math.sin(spin);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    for (const side of [-1, 1]) {
        const root = side * bodyWidth(-6) * .8;
        const wing = ([u, v, z]: Point3): Point3 => {
            const d = (v - SHOULDER) * 1.6;
            return place([u, SHOULDER + d * cos - z * sin + (u + 8) * .35, root + side * (d * sin + z * cos)]);
        };
        // 'ff' alpha keeps the thin wing visible from both faces.
        view.profile(WING, 1.6, f.wing + 'ff', 0, { place: wing });
        view.profile(WING.map(([u, v]) => [u * .8 - 1, SHOULDER + (v - SHOULDER) * .6] as [number, number]), .6, f.belly + 'ff', 1.8, { place: wing });
    }
    return { eyes: [lensEye(view, place, -1, f.eye), lensEye(view, place, 1, f.eye)], glow: f.eye * 2.6 };
}
