import { deepFreeze } from './data';
// Gameplay geometry. Artwork reads these anchors but never writes collision bounds.
export const LEVEL = Object.freeze({
    floor: 420,
    length: 3400,
    goal: 3240,
    practicePaper: Object.freeze({ x: 225, width: 42, height: 6 }),
    monitors: Object.freeze([
        Object.freeze({ wall: 2110, period: 3.5, offset: 0 }),
        Object.freeze({ wall: 2560, period: 3.5, offset: 2.1 }),
        Object.freeze({ wall: 2980, period: 3.5, offset: 1.0 }),
    ]),
    copier: Object.freeze({ x: 750 }),
    // The executive multifunction printer between the glaring monitors. Once the chair's chaos counts as
    // results, it prints urgent reports: a scan (`scan` s, the warning), then a fixed pattern of shots
    // `shotGap` apart, then `rest`. It only fires while the chair is within `wake` of it.
    // Each urgent volley is 20 sheets' worth (a bundle counts as 8); every sheet that hits costs focus on its
    // own, so taking a whole volley costs half the focus bar. Urgent sheets clear away after `life` seconds.
    urgentCopier: Object.freeze({ x: 2460, wake: 420, scan: .6, shotGap: .13, rest: 1.1, life: 3.5 }),
    cleaning: Object.freeze({ x: 1095, a: 1035, b: 1360 }),
    bin: Object.freeze({ x: 1660, a: 1580, b: 1740, rim: 402 }),
    geysers: Object.freeze([
        Object.freeze({ x: 2600, period: 3.5, offset: 0 }),
        Object.freeze({ x: 2850, period: 3.5, offset: 1.2 }),
        Object.freeze({ x: 3100, period: 3.5, offset: 2.4 }),
    ]),
    playerContacts: Object.freeze([
        { x: -26, y: 19, r: 9, wheel: true }, { x: 26, y: 19, r: 9, wheel: true },
        { x: -21, y: -12, r: 10 }, { x: 21, y: -11, r: 10 }, { x: -20, y: -38, r: 11 },
        { x: 33, y: -2, r: 8 }, { x: -7, y: -49, r: 12 }, { x: 0, y: -77, r: 12, head: true }
    ].map(part => Object.freeze(part)))
});
// Rule durations are independent from the visual effect durations in render/effects.ts.
export const FOCUS_DAMAGE = Object.freeze({ paper: 30, water: 30, light: 30, door: 30, copier: 15, urgentSheet: 2.5, bundle: 20, skyPaper: 15, bird: 20, praise: 7 });
export const RULES = Object.freeze({ paperPenalty: 2.4, lightPenalty: 1.65, waterExposure: 1.3, bucketReset: 2.2 });
export const FIXED_STEP = 1 / 120;
// Chair handling shared by every stage. Changing a value changes CONFIG_VERSION (older replays then warn).
// Units: px, seconds, radians.
export const PHYSICS = deepFreeze({
    gravity: 950,
    lean: { ground: 4.3, air: 6.4 },                         // Q/E (and air steering) spin acceleration
    upright: { pull: 20, damping: 7, tutorialUntilX: 300 },   // self-righting assist
    drive: { ground: 305, slip: 110, air: 55, convoy: 1200, express: 1400 },
    drag: { ground: .55, slip: .015, air: .09 },
    spinDrag: { ground: 1.8, slip: .9, air: .75 },
    limits: { vx: 315, convoyVx: 700, expressVx: 760, rise: 500, fall: 850, spin: 5.8 },
    jump: { speed: 380, spin: .12, coyote: .1, buffer: .14 },
    contact: { iterations: 5, push: .78, bounce: 1.035, inertia: 2500, wheelGround: -.45, headDown: -.25, headDepth: .05 },
    fallDepth: 250,                                           // below the floor: the attempt is lost
});
