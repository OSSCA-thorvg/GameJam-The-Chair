import { ART } from '../art';
import { PLAYER_OUTLINES } from './player-art';
import type { Vector } from '../types';
import type { Point3, SkyProjection } from './sky-projection';

export function endingChair(view: SkyProjection, elapsed: number, spray = 1) {
    const C = ART.palette;
    const bob = Math.sin(elapsed * 1.6) * 1.5;
    const point = (x: number, y: number, z = 0): Point3 => [x, -y - 35 + bob, z];
    const profile = (points: Vector[], width: number, color: string, z = 0) =>
        view.profile(points.map(([x, y]) => [x, -y - 35 + bob]), width, color, z);
    const oval = (x: number, y: number, z: number, rx: number, ry: number, rz: number, color: string) =>
        view.oval(point(x, y, z), [rx, ry, rz], color);
    const rod = (a: Point3, b: Point3, radius: number, color: string) => view.rod(point(...a), point(...b), radius, color);

    rod([0, -4, 0], [0, 16, 0], 3, C.steel);
    for (const [x, z] of [[-27, 22], [27, 22], [-27, -22], [27, -22], [0, -30]]) {
        rod([0, 13, 0], [x, 21, z], 2.5, C.steel);
        oval(x, 23, z, 7, 8, 5, '#3f4650');
        oval(x, 23, z + 4.7, 2.5, 2.5, .5, '#9197a2');
    }
    rod([-24, -10, 0], [-31, -61, 0], 3.5, '#515665');
    profile(PLAYER_OUTLINES.backrest, 24, '#666d80');
    profile([[-30, -15], [32, -15], [32, -3], [-30, -3]], 27, '#6f7687');

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

    // Only the face below the hairline needs skin. Hidden scalp faces can sort over the hair while orbiting.
    const face: Vector[] = [[-10, -77], [-3, -83], [3, -89], [10, -92], ...PLAYER_OUTLINES.head.slice(3)];
    view.profile(face.map(([x, y]) => [x, -y - 35 + bob]), 12, C.skin, 0, { widthAt: (_x, y) => {
        const fullness = Math.max(0, Math.min(1, (y - 31 - bob) / 20));
        return 5 + fullness * 7;
    } });
    const hair: Vector[] = [...PLAYER_OUTLINES.hair.slice(0, 3), [15, -92], [6, -91], [-2, -84], [-10, -77]];
    view.profile(hair.map(([x, y]) => [x, -y - 35 + bob]), 14.2, '#3c424f', 0, { bevel: 1 });
    profile([[-7, -93], [-4, -98], [3, -96]], .4, '#687380', 14.7);
    for (const side of [-1, 1]) {
        oval(-7, -81, side * 13, 2.7, 3.4, 1.5, C.skin);
        oval(10.5, -82.4, side * 12.4, .8, 1.1, .35, '#446d82');
        rod([13.7, -86, side * 5], [13.7, -86, side * 10], .35, '#3c424f');
        // Thin temples stay outside the head; both lenses sit ahead of the face.
        rod([-5, -83, side * 14.8], [15.5, -84, side * 14.8], .55, '#3a414b');
        const lens: Point3[] = [
            [15.5, -86, side * 13.5], [17.5, -86, side * 2],
            [17.5, -80, side * 2], [15.5, -80, side * 13.5],
        ];
        // A translucent pane keeps the eyes visible without adding thickness inside the face.
        const pane = lens.map(p => point(...p));
        view.polygon(pane, '#83c8e499');
        for (let i = 0; i < lens.length; i++) rod(lens[i], lens[(i + 1) % lens.length], .55, '#50606a');
    }
    rod([17.5, -83, -2], [17.5, -83, 2], .5, '#50606a');

    profile(PLAYER_OUTLINES.laptop, 23, '#555f70');
    profile([[35, -55], [59, -55], [51, -35], [27, -35]], .5, '#a8b9c3', 23.8);
    for (const z of [-19, 19]) {
        profile([[-17, -58], [-13, -60], [-9, -57], [-8, -35], [-18, -34]], 4, '#e6e0cc', z);
        profile([[-19, -39], [-8, -39], [-8, -34], [-19, -33]], 4.5, '#fff6de', z);
        profile([[-16, -34], [-9, -35], [23, -36], [25, -32], [-15, -27]], 3, C.skin, z);
        const tap = Math.sin(elapsed * 24) * 1.2;
        profile([[21, -36 + tap], [25, -39 + tap], [30, -38 + tap], [35, -35 + tap], [36, -33 + tap], [29, -35 + tap], [23, -33 + tap]], 2, C.skin, z);
    }

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

