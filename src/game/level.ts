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
export const FOCUS_DAMAGE = Object.freeze({ paper: 30, water: 30, light: 30, door: 30, copier: 15 });
export const RULES = Object.freeze({ paperPenalty: 2.4, lightPenalty: 1.65, waterExposure: 1.3, bucketReset: 2.2 });
export const FIXED_STEP = 1 / 120;
