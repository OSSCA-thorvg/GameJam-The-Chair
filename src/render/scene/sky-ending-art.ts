import { ART } from '../art';
import { PLAYER_OUTLINES } from './player-art';
import type { Vector } from '../types';
import type { Point3, SkyProjection } from './sky-projection';
import { endingHair } from './sky-player-hair';
import { endingGlasses } from './sky-player-glasses';

/**
 * `loose`: seconds since the extinguisher came off the chair at the end of the flight (negative while attached).
 * `rest`: how far the rider's hands have lifted off the keys (0 typing, 1 stopped above them).
 * `rocket`: how far the extinguisher has ignited into stage five's rocket engine (0 the reveal's soft puffs, 1 full).
 */
export function endingChair(view: SkyProjection, elapsed: number, spray = 1, arrival = 0, loose = -1, rest = 0, rocket = 0) {
    const draw = chairDrawing(view, elapsed, arrival);
    chairFrame(draw);
    riderBody(draw);
    riderHead(view, draw);
    riderArms(view, draw, rest);
    if (loose < 0) extinguisher(draw, spray, rocket);
    // Its last puffs set it tumbling as it drifts away.
    else extinguisher(looseDrawing(view, draw, loose), spray * Math.exp(-loose * .6), rocket);
    return draw.bob;
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

export function laptopScreenPoint(u: number, v: number, bob: number, lift = 0): Point3 {
    return [47 + 6.6 * v - .96 * lift, 1 + 24 * v + bob + .26 * lift, -20 + 40 * u];
}

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
    // Ears on the sides; the eyes are behind the glasses on the front of the face (endingGlasses).
    for (const side of [-1, 1]) oval(-7, -81, side * 13, 2.7, 3.4, 1.5, C.skin);
    endingGlasses(view, bob);
}

/**
 * The laptop in 3D: a thin base under the hands with its keyboard and trackpad, and a thin lid hinged at the base's
 * back edge, tipped a little back, its screen towards the rider. Coordinates follow the side-view outlines.
 */
function laptop(view: SkyProjection, { profile, point, bob }: ChairDrawing) {
    const top = (x0: number, z0: number, x1: number, z1: number, y: number, color: string) =>
        view.polygon([point(x0, y, z0), point(x1, y, z0), point(x1, y, z1), point(x0, y, z1)], color + 'ff');
    // The thin chassis has a separate keyboard deck, inset keys and a trackpad.
    profile([[16, -31], [50, -31], [50, -34], [16, -34]], 22, '#667284');
    top(18, -20, 48, 20, -34.2, '#343e4c');
    top(19, -18, 31, 18, -34.35, '#758396');
    top(19.5, -17.5, 30.5, 17.5, -34.4, '#465362');
    top(32, -19, 46, 19, -34.35, '#222c39');
    const keyStart = view.project(point(35, -34.45, -19));
    const keyEnd = view.project(point(35, -34.45, -14));
    const keyWidth = Math.hypot(keyEnd[0] - keyStart[0], keyEnd[1] - keyStart[1]);
    if (keyWidth >= 2) {
        for (let row = 0; row < 3; row++) for (let key = 0; key < 8; key++) {
            const z = -17.5 + key * 4.45;
            top(33 + row * 4.1, z, 36.1 + row * 4.1, z + 3.5, -34.48, row === 0 ? '#78899a' : '#647586');
        }
    }
    const corner = (u: number, v: number, back = 0) => laptopScreenPoint(u, v, bob, -back);
    const face = (u0: number, v0: number, u1: number, v1: number, color: string, lift = 0) =>
        view.polygon([laptopScreenPoint(u0, v0, bob, lift), laptopScreenPoint(u1, v0, bob, lift),
            laptopScreenPoint(u1, v1, bob, lift), laptopScreenPoint(u0, v1, bob, lift)], color);
    face(0, 0, 1, 1, '#243140');
    view.polygon([corner(0, 1, 1.2), corner(1, 1, 1.2), corner(1, 0, 1.2), corner(0, 0, 1.2)], '#566275');
    for (const [a, b] of [[[0, 0], [1, 0]], [[1, 0], [1, 1]], [[1, 1], [0, 1]], [[0, 1], [0, 0]]]) {
        view.polygon([corner(a[0], a[1]), corner(b[0], b[1]), corner(b[0], b[1], 1.2), corner(a[0], a[1], 1.2)], '#657184ff');
    }
    face(.02, .02, .98, .045, '#9caaba', .1);
    face(.02, .955, .98, .98, '#9caaba', .1);
    face(.02, .045, .045, .955, '#9caaba', .1);
    face(.955, .045, .98, .955, '#9caaba', .1);
    face(.49, .965, .51, .975, '#283644', .15);
}

function riderArms(view: SkyProjection, draw: ChairDrawing, rest = 0) {
    const { C, elapsed, profile } = draw;
    laptop(view, draw);
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

function extinguisher({ elapsed, rod, oval }: ChairDrawing, spray: number, rocket: number) {
    rod([-39, -49, 0], [-45, -13, 0], 2, '#394657');
    rod([-46, -48, 0], [-46, -9, 0], 8, '#b75f4a');
    oval(-46, -48, 0, 8, 5, 8, '#c7765c');
    oval(-46, -9, 0, 8, 3, 8, '#b75f4a');
    rod([-46, -37, 0], [-46, -26, 0], 8.2, '#eee5cd');
    rod([-46, -52, 0], [-46, -59, 0], 2, '#394657');
    rod([-49, -59, 0], [-35, -59, 0], 1.5, '#394657');
    for (let i = 0; rocket < 1 && spray > 0 && i < 5; i++) {
        const age = (elapsed * 1.5 + i * .19) % 1;
        oval(-46 - age * 4, -7 + age * 50 * spray, 0, 3 + age * 7, 4 + age * 9, 3 + age * 6, '#f6e6df' + hex(100 / 255 * (1 - age) * (1 - rocket)));
    }
    if (rocket <= 0) return;
    // Flared nozzle bell.
    rod([-46, -9, 0], [-46, -4, 0], 5.5, '#2f3540');
    if (spray > 0) rocketExhaust(oval, elapsed, spray * rocket);
}

const hex = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0');

/**
 * The extinguisher fires like a rocket engine: a white-hot core with shock diamonds straight out of the nozzle,
 * then a long billowing column of foam that swells and tumbles away behind the chair.
 */
function rocketExhaust(oval: ChairDrawing['oval'], elapsed: number, spray: number) {
    const power = Math.min(1.8, spray);
    const flicker = 1 + Math.sin(elapsed * 47) * .08 + Math.sin(elapsed * 83) * .05;
    const reach = (120 + 230 * power) * flicker;
    oval(-46, -3.5, 0, 6.5, 1.2, 6.5, '#ffe9b0' + hex(Math.min(1, power * 2)));
    // Billowing foam: puffs flow down the column, swelling and drifting apart as they go.
    const puffs = Math.round(14 + 18 * Math.min(1, power));
    for (let i = 0; i < puffs; i++) {
        const age = (elapsed * 2.6 + i / puffs) % 1;
        const swirl = i * 2.39 + elapsed * 3;
        const spread = age * age * 50 * power;
        const size = 7 + age * 55 * (.6 + .4 * power);
        const tone = age < .25 ? '#fff4d6' : age < .6 ? '#f6efe4' : '#dcdcd8';
        // The column trails back behind the chair as well as down, like a launch seen from the chase plane.
        oval(-46 - age * reach * .55 + Math.cos(swirl) * spread, -2 + age * reach, Math.sin(swirl) * spread,
            size, size * (1.1 + .5 * (1 - age)), size, tone + hex(Math.min(1, age / .18) * (1 - age) * (1 - age) * .9 * Math.min(1, power + .3)));
    }
    // The white-hot core and its shock diamonds, along the same tilted thrust line as the foam.
    const core = (40 + 50 * power) * flicker;
    oval(-46 - 8, 6, 0, 16 * power, 18 * power, 16 * power, '#fff1c4' + hex(.35 * Math.min(1, power)));
    for (let k = 0; k < 6; k++) {
        const along = (k + .5) / 6 * core, r = 8 * (1 - k / 8);
        oval(-46 - along * .55, -2 + along, 0, r, r * 1.5, r, (k < 2 ? '#ffe28a' : '#ffb347') + hex(.85 * (1 - k / 7)));
    }
    for (let k = 1; k <= 3; k++) {
        const along = core * k * .26, r = 5.5 - k * .9;
        oval(-46 - along * .55, -2 + along, 0, r, r * 1.6, r, '#ffffff' + hex(.95 - k * .2));
    }
}
