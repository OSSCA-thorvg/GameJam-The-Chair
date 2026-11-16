import type { SkyRobot } from '../../../game/stages/sky/data';
import type { Curve, Vector } from '../../types';
import type { Place } from '../shared/cctv-models';
import type { Point3, SkyProjection } from '../shared/projection';

type Path = { start: Vector; curves: Curve[] };

function outline({ start, curves }: Path, steps = 6): Vector[] {
    const points: Vector[] = [];
    let [x0, y0] = start;
    for (const [ax, ay, bx, by, x1, y1] of curves) {
        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const s = 1 - t;
            const x =
                s * s * s * x0 +
                3 * s * s * t * ax +
                3 * s * t * t * bx +
                t * t * t * x1;
            const y =
                s * s * s * y0 +
                3 * s * s * t * ay +
                3 * s * t * t * by +
                t * t * t * y1;
            points.push([-x, -y]);
        }
        [x0, y0] = [x1, y1];
    }
    return points;
}

function band(path: Path, width: number): Vector[] {
    const line = outline(path, 8);
    line.push([-path.curves.at(-1)![4], -path.curves.at(-1)![5]]);
    return [
        ...line.map(([u, v]) => [u, v + width / 2] as Vector),
        ...line.reverse().map(([u, v]) => [u, v - width / 2] as Vector),
    ];
}

const BODY = outline({
    start: [-22, -10],
    curves: [
        [-14, -18, 2, -12, 14, -5],
        [22, 0, 16, 10, 4, 11],
        [-6, 12, -14, 6, -18, 2],
        [-24, -2, -26, -6, -22, -10],
    ],
});
const BEAK = outline({
    start: [-22, -8],
    curves: [
        [-28, -10, -33, -5, -31, 1],
        [-28, 0, -25, -1, -22, -1],
    ],
});
const TAIL = outline({
    start: [12, -3],
    curves: [
        [26, -6, 40, -6, 52, -3],
        [40, 2, 26, 6, 13, 5],
    ],
});
const WING = outline({
    start: [2, -3],
    curves: [
        [8, -24, 16, -34, 26, -26],
        [18, -13, 12, -2, 12, 1],
    ],
});
const BELLY = outline({
    start: [16, 3],
    curves: [
        [18, 7, 14, 10, 4, 11],
        [-6, 12, -14, 6, -18, 2],
        [-6, 2.5, 6, 2.8, 16, 3],
    ],
});
const SHINE = band(
    { start: [-16, -12], curves: [[-8, -15, 4, -11, 12, -6]] },
    1.6,
);
const RIM = band(
    { start: [-22, -10], curves: [[-14, -17, 2, -12, 14, -5]] },
    1.4,
);
const EYE: Vector = [14, 5];
const SHOULDER = 1;

type Finish = {
    body: string;
    belly: string;
    tail: string;
    wing: string;
    beak: string;
    shine: string;
    eye: number;
    rim?: string;
};
const FINISH: Record<SkyRobot, Finish> = {
    liquid: {
        body: '#cfd8e2',
        belly: '#7d8ea3',
        tail: '#dfe6ee',
        wing: '#8a98aa',
        beak: '#9aa7b6',
        shine: '#ffffff',
        eye: 4,
    },
    black: {
        body: '#2f353f',
        belly: '#0d0f13',
        tail: '#262b33',
        wing: '#16191e',
        beak: '#3a414c',
        shine: '#6b7584',
        eye: 4.4,
        rim: '#ff3a1a',
    },
};

const HALF = 8;
const bodyWidth = (u: number) =>
    HALF *
    Math.max(
        0.35,
        1 -
            (Math.max(0, 2 - u) / 24) * 0.55 -
            (Math.max(0, u - 16) / 10) * 0.35,
    );

function lensEye(view: SkyProjection, place: Place, side: number, r: number) {
    const [a, b] = [place([0, 0, 0]), place([1, 0, 0])];
    const scale = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const w = side * (bodyWidth(EYE[0]) * 0.92);
    const disc = (out: number, radius: number, color: string, du = 0, dv = 0) =>
        view.oval(
            place([EYE[0] + du, EYE[1] + dv, w + side * out]),
            [radius * scale, radius * scale, radius * 0.45 * scale],
            color,
        );
    disc(0, r * 1.3, '#a9b4c2');
    disc(0.5, r * 1.05, '#07080a');
    disc(0.9, r * 0.82, '#d81e10');
    disc(1.2, r * 0.45, '#ff7a2a');
    disc(1.4, r * 0.2, '#fff3b0');
    disc(1.6, r * 0.22, '#ffffff', r * 0.35, r * 0.4);
    return place([EYE[0], EYE[1], w + side * 1.6]);
}

export function robotBirdModel(
    view: SkyProjection,
    robot: SkyRobot,
    place: Place,
    spin: number,
): { eyes: Point3[]; glow: number } {
    const f = FINISH[robot];
    view.profile(TAIL, 3, f.tail, 0, { place });
    view.profile(BODY, HALF, f.body, 0, {
        place,
        bevel: 0.72,
        widthAt: (u) => bodyWidth(u),
    });
    view.profile(BELLY, HALF + 0.7, f.belly, 0, {
        place,
        bevel: 0.8,
        widthAt: (u) => bodyWidth(u) + 0.7,
    });
    view.profile(BEAK, 2.6, f.beak, 0, { place });
    view.profile(SHINE, HALF + 0.4, f.shine, 0, {
        place,
        widthAt: (u) => bodyWidth(u) + 0.4,
    });
    if (f.rim) {
        view.profile(RIM, HALF + 0.5, f.rim, 0, {
            place,
            widthAt: (u) => bodyWidth(u) + 0.5,
        });
    }
    const angle = 0.95 + 0.55 * Math.sin(spin);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (const side of [-1, 1]) {
        const root = side * bodyWidth(-6) * 0.8;
        const wing = ([u, v, z]: Point3): Point3 => {
            const d = (v - SHOULDER) * 1.6;
            return place([
                u,
                SHOULDER + d * cos - z * sin + (u + 8) * 0.35,
                root + side * (d * sin + z * cos),
            ]);
        };
        view.profile(WING, 1.6, f.wing + 'ff', 0, { place: wing });
        view.profile(
            WING.map(
                ([u, v]) =>
                    [u * 0.8 - 1, SHOULDER + (v - SHOULDER) * 0.6] as [
                        number,
                        number,
                    ],
            ),
            0.6,
            f.belly + 'ff',
            1.8,
            { place: wing },
        );
    }
    return {
        eyes: [lensEye(view, place, -1, f.eye), lensEye(view, place, 1, f.eye)],
        glow: f.eye * 2.6,
    };
}
