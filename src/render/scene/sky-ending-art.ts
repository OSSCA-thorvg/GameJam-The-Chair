import { ART } from '../art';
import { PLAYER_OUTLINES } from './player-art';
import type { Vector } from '../types';
import type { Point3, SkyProjection } from './sky-projection';
import { endingHair } from './sky-player-hair';
import { endingGlasses } from './sky-player-glasses';

/**
 * `loose`: seconds since the extinguisher came off the chair at the end of the flight (negative while attached).
 * `rest`: how far the rider's hands have lifted off the keys (0 typing, 1 stopped above them).
 */
export function endingChair(view: SkyProjection, elapsed: number, spray = 1, arrival = 0, loose = -1, rest = 0) {
    const draw = chairDrawing(view, elapsed, arrival);
    chairFrame(draw);
    riderBody(draw);
    riderHead(view, draw);
    riderArms(draw, rest);
    if (loose < 0) extinguisher(draw, spray);
    // Its last puffs set it tumbling as it drifts away.
    else extinguisher(looseDrawing(view, draw, loose), spray * Math.exp(-loose * .6));
}

/**
 * The extinguisher once it has come off: it drifts away up and to the left, turning over slowly, free of the
 * chair's bob. Drawing through this moves every part of it the same way.
 */
function looseDrawing(view: SkyProjection, draw: ChairDrawing, loose: number): ChairDrawing {
    const centre: Point3 = [-46, -5, 0];
    const axis: Point3 = [.3, .5, .81], angle = loose * .9;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const shift: Point3 = [-10 * loose, 9 * loose, -38 * loose - 10 * (1 - Math.exp(-3 * loose))];
    const move = (p: Point3): Point3 => {
        // Rodrigues' rotation about `axis` through the extinguisher's middle.
        const v: Point3 = [p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]];
        const d = v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2];
        const c: Point3 = [axis[1] * v[2] - axis[2] * v[1], axis[2] * v[0] - axis[0] * v[2], axis[0] * v[1] - axis[1] * v[0]];
        return [0, 1, 2].map(i => v[i] * cos + c[i] * sin + axis[i] * d * (1 - cos) + centre[i] + shift[i]) as Point3;
    };
    const point = (x: number, y: number, z = 0): Point3 => move([x, -y - 35, z]);
    return { ...draw, bob: 0, point,
        rod: (a, b, radius, color) => view.rod(point(...a), point(...b), radius, color),
        oval: (x, y, z, rx, ry, rz, color) => view.oval(point(x, y, z), [rx, ry, rz], color) };
}

function chairDrawing(view: SkyProjection, elapsed: number, arrival: number) {
    const C = ART.palette;
    const bob = Math.sin(elapsed * 1.6) * 1.5 + Math.sin(elapsed * 25) * 3 * arrival;
    const point = (x: number, y: number, z = 0): Point3 => [x, -y - 35 + bob, z];
    const profile = (points: Vector[], width: number, color: string, z = 0) =>
        view.profile(points.map(([x, y]) => [x, -y - 35 + bob]), width, color, z);
    const oval = (x: number, y: number, z: number, rx: number, ry: number, rz: number, color: string) =>
        view.oval(point(x, y, z), [rx, ry, rz], color);
    const rod = (a: Point3, b: Point3, radius: number, color: string) => view.rod(point(...a), point(...b), radius, color);

    return { C, bob, point, profile, oval, rod, elapsed };
}

type ChairDrawing = ReturnType<typeof chairDrawing>;

function chairFrame({ C, rod, oval, profile }: ChairDrawing) {
    rod([0, -4, 0], [0, 16, 0], 3, C.steel);
    for (const [x, z] of [[-27, 22], [27, 22], [-27, -22], [27, -22], [0, -30]]) {
        rod([0, 13, 0], [x, 21, z], 2.5, C.steel);
        oval(x, 23, z, 7, 8, 5, '#3f4650');
        oval(x, 23, z + 4.7, 2.5, 2.5, .5, '#9197a2');
    }
    rod([-24, -10, 0], [-31, -61, 0], 3.5, '#515665');
    profile(PLAYER_OUTLINES.backrest, 24, '#666d80');
    profile([[-30, -15], [32, -15], [32, -3], [-30, -3]], 27, '#6f7687');
}

function riderBody({ C, profile }: ChairDrawing) {
    // Keep the same silhouettes and palette as the ordinary player illustration.
    profile(PLAYER_OUTLINES.farLeg, 5, '#4e5b70', -12);
    profile([[35, 3], [42, 3], [50, 6], [55, 9], [52, 10], [35, 7]], 7, '#383f4e', -12);
    profile(PLAYER_OUTLINES.nearLeg, 5, '#5b6b80', 12);
    profile([[-11, -25], [20, -24], [26, -21], [7, -20], [-10, -21]], .6, '#6d7b8e', 17.5);
    profile([[26, 11], [33, 10], [35, 15], [26, 16]], 7, '#383f4e', 12);

    profile(PLAYER_OUTLINES.shirt, 16, C.shirt);
    profile([[-17, -62], [-11, -61], [-11, -24], [-17, -23]], .6, '#d9d6c5', 16.5);
    profile([[-5, -69], [2, -68], [3, -61], [1, -58], [-4, -62]], 4.2, '#d5b18b');
    profile([[-9, -65], [0, -60], [6, -60], [4, -55], [0, -52], [-6, -57]], .8, '#fff6de', 17);
    profile([[1, -58], [5, -57], [5, -54], [8, -36], [6, -33], [1, -34], [2, -54]], .5, '#a65e44', 17.8);
}

function riderHead(view: SkyProjection, { C, bob, oval }: ChairDrawing) {
    // Only the face below the hairline needs skin. Hidden scalp faces can sort over the hair while orbiting.
    const face: Vector[] = [[-10, -77], [-3, -83], [3, -89], [10, -92], ...PLAYER_OUTLINES.head.slice(3)];
    view.profile(face.map(([x, y]) => [x, -y - 35 + bob]), 12, C.skin, 0, { widthAt: (_x, y) => {
        const fullness = Math.max(0, Math.min(1, (y - 31 - bob) / 20));
        return 5 + fullness * 7;
    } });
    endingHair(view, bob);
    for (const side of [-1, 1]) {
        oval(-7, -81, side * 13, 2.7, 3.4, 1.5, C.skin);
        oval(10.5, -82.4, side * 12.4, .8, 1.1, .35, '#446d82');
    }
    endingGlasses(view, bob);
}

function riderArms({ C, elapsed, profile }: ChairDrawing, rest = 0) {
    profile(PLAYER_OUTLINES.laptop, 23, '#555f70');
    profile([[35, -55], [59, -55], [51, -35], [27, -35]], .5, '#a8b9c3', 23.8);
    for (const z of [-19, 19]) {
        profile([[-17, -58], [-13, -60], [-9, -57], [-8, -35], [-18, -34]], 4, '#e6e0cc', z);
        profile([[-19, -39], [-8, -39], [-8, -34], [-19, -33]], 4.5, '#fff6de', z);
        // Lifting off the keys, the forearms tip up and the fingers hover still.
        const lift = -5 * rest;
        profile([[-16, -34], [-9, -35], [23, -36 + lift], [25, -32 + lift], [-15, -27]], 3, C.skin, z);
        const tap = Math.sin(elapsed * 24) * 1.2 * (1 - rest) + lift;
        profile([[21, -36 + tap], [25, -39 + tap], [30, -38 + tap], [35, -35 + tap], [36, -33 + tap], [29, -35 + tap], [23, -33 + tap]], 2, C.skin, z);
    }
}

function extinguisher({ elapsed, rod, oval }: ChairDrawing, spray: number) {
    rod([-39, -49, 0], [-45, -13, 0], 2, '#394657');
    rod([-46, -48, 0], [-46, -9, 0], 8, '#b75f4a');
    oval(-46, -48, 0, 8, 5, 8, '#c7765c');
    oval(-46, -9, 0, 8, 3, 8, '#b75f4a');
    rod([-46, -37, 0], [-46, -26, 0], 8.2, '#eee5cd');
    rod([-46, -52, 0], [-46, -59, 0], 2, '#394657');
    rod([-49, -59, 0], [-35, -59, 0], 1.5, '#394657');
    for (let i = 0; spray > 0 && i < 5; i++) {
        const age = (elapsed * 1.5 + i * .19) % 1;
        const alpha = Math.round(100 * (1 - age)).toString(16).padStart(2, '0');
        oval(-46 - age * 4, -7 + age * 50 * spray, 0, 3 + age * 7, 4 + age * 9, 3 + age * 6, '#f6e6df' + alpha);
    }
}
