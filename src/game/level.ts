// Gameplay geometry. Artwork reads these anchors but never writes collision bounds.
export const LEVEL = Object.freeze({
    floor: 420,
    length: 2600,
    goal: 2440,
    monitor: Object.freeze({ wall: 2110, period: 4.8 }),
    copier: Object.freeze({ x: 550 }),
    cleaning: Object.freeze({ x: 945, a: 885, b: 1210 }),
    bin: Object.freeze({ x: 1660, a: 1580, b: 1740, rim: 402 }),
    playerContacts: Object.freeze([
        { x: -26, y: 19, r: 9, wheel: true }, { x: 26, y: 19, r: 9, wheel: true },
        { x: -21, y: -12, r: 10 }, { x: 21, y: -11, r: 10 }, { x: -20, y: -38, r: 11 },
        { x: 33, y: -2, r: 8 }, { x: -7, y: -49, r: 12 }, { x: 0, y: -77, r: 12, head: true }
    ].map(part => Object.freeze(part)))
});
// Rule durations are independent from the visual effect durations in render/effects.ts.
export const RULES = Object.freeze({ paperPenalty: 2.4, lightPenalty: 1.65, waterExposure: 1.3 });
export const FIXED_STEP = 1 / 120;
