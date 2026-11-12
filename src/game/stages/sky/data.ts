import { deepFreeze } from '../../data';
import * as Det from '../../math';

export const STAGE_FOUR = deepFreeze({
    length: 6100,
    goal: 5410,
    arrivalY: -1820,
    reveal: { settle: 1, turn: 7, hold: 2 },
    spawn: { x: 2380, y: -1820 },
    checkpoints: [{ x: 2380, y: -1820 }, { x: 2820, y: -1748 }, { x: 3790, y: -2078 }, { x: 4510, y: -2258 }],
});

export type SkyState = {
    phase: 'arrival' | 'course' | 'reveal' | 'depth';
    age: number;
    lift: number;
    drawer: number;
    deskTilt: number;
    signTilt: number;
    standing: string | null;
    depth: number;
    depthTravel: number;
};
export function createSky(): SkyState {
    return { phase: 'arrival', age: 0, lift: 0, drawer: 0, deskTilt: 0, signTilt: -1.28, standing: null, depth: 0, depthTravel: 0 };
}
export type SkyPlatform = {
    id: string; kind: 'roof' | 'sill' | 'sign' | 'desk' | 'small-desk' | 'finish';
    x: number; y: number; width: number; angle: number;
};
export function skyWind(time: number) {
    // The ribbon and cloud wisps announce each gust before the sign folds down.
    return Det.sin(time * .9) * .5 + .5;
}
export function skyPlatforms(sky: Readonly<SkyState>, time: number): SkyPlatform[] {
    const bob = (phase: number) => Det.sin(time * .72 + phase) * 9;
    return [
        { id: 'arrival-roof', kind: 'roof', x: 2670, y: -1720, width: 390, angle: 0 },
        { id: 'window-one', kind: 'sill', x: 3040, y: -1810 - sky.lift * 80, width: 180, angle: 0 },
        { id: 'window-two', kind: 'sill', x: 3240, y: -1930 - sky.lift * 80, width: 180, angle: 0 },
        { id: 'wind-sign', kind: 'sign', x: 3480, y: -2050, width: 270, angle: sky.signTilt },
        { id: 'wind-recovery', kind: 'sill', x: 3410, y: -1900, width: 460, angle: 0 },
        { id: 'rest', kind: 'desk', x: 3740, y: -2050 + bob(1), width: 210, angle: 0 },
        { id: 'drawer-desk', kind: 'desk', x: 4070, y: -2150 + bob(2), width: 270, angle: sky.deskTilt },
        ...(sky.drawer > .75 ? [{ id: 'little-desk', kind: 'small-desk' as const, x: 4350 + sky.drawer * 60, y: -2230 + bob(3), width: 170, angle: -.04 }] : []),
        { id: 'upper-rest', kind: 'desk', x: 4470, y: -2230 + bob(4), width: 220, angle: 0 },
        { id: 'last-sign', kind: 'sign', x: 4770, y: -2310 + bob(5), width: 230, angle: -.1 },
        { id: 'finish', kind: 'finish', x: 5170, y: -2310 + bob(6), width: 470, angle: 0 },
    ];
}
export function skySurface(platform: Readonly<SkyPlatform>, x: number) {
    return platform.y + (x - platform.x - platform.width / 2) * Det.tan(platform.angle);
}
