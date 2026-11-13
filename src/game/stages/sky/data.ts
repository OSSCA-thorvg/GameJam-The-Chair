import { deepFreeze } from '../../data';
import * as Det from '../../math';

export const STAGE_FOUR = deepFreeze({
    length: 6100,
    goal: 5410,
    arrivalY: -1820,
    reveal: { settle: 1, turn: 7, hold: 2 },
    spawn: { x: 2380, y: -1820 },
    // One flag halfway: the start, then the floating desk after the gusty sign.
    checkpoints: [{ x: 2380, y: -1820 }, { x: 3790, y: -2078 }],
    // Falling below this line returns the chair to its last flag.
    fallY: -1480,
    // Bursts per time in the air; touching down refills them.
    airSprayLimit: 3,
    // A steady headwind (px/s²) with a gust every `period` seconds: calm, then a warning breeze, then the blow.
    wind: { base: 55, gust: 205, period: 7.5, calm: 3, warn: 1.5, rise: .35, blow: 2.2, fall: .45, ground: .55 },
    // Desks rock back and forth on the gusts, so standing still on one takes steering.
    rock: { tilt: .2, sway: 26, slide: 520, speed: 1.55 },
    knock: { cooldown: .7, reach: 34 },
});

export type SkyHazardKind = 'paper' | 'bird' | 'gear';
export type SkyGearItem = 'monitor' | 'keyboard' | 'mouse' | 'tower';
export type SkyRobot = 'liquid' | 'black';
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
    airSprays: number;
    knock: number;
    knockKind: SkyHazardKind | null;
};
export function createSky(): SkyState {
    return {
        phase: 'arrival', age: 0, lift: 0, drawer: 0, deskTilt: 0, signTilt: -1.28, standing: null, depth: 0, depthTravel: 0,
        airSprays: 0, knock: 0, knockKind: null,
    };
}
export type SkyPlatform = {
    id: string; kind: 'roof' | 'sill' | 'sign' | 'desk' | 'small-desk' | 'finish';
    x: number; y: number; width: number; angle: number;
};

function cycle(time: number, period: number) {
    return time - Math.floor(time / period) * period;
}

/** `warn` rises before each gust (0..1) and `strength` is the gust itself (0..1). */
export function skyGust(time: number) {
    const w = STAGE_FOUR.wind;
    const t = cycle(time, w.period);
    const start = w.calm + w.warn;
    const warn = t < w.calm ? 0 : t < start ? (t - w.calm) / w.warn : t < start + w.blow ? 1 : Math.max(0, 1 - (t - start - w.blow) / w.fall);
    let strength = 0;
    if (t >= start && t < start + w.blow + w.fall) {
        const u = t - start;
        const ramp = u < w.rise ? u / w.rise : u < w.blow ? 1 : 1 - (u - w.blow) / w.fall;
        strength = ramp * ramp * (3 - 2 * ramp);
    }
    return { warn, strength };
}

/** Leftward push against the course in px/s². */
export function skyHeadwind(time: number) {
    return STAGE_FOUR.wind.base + STAGE_FOUR.wind.gust * skyGust(time).strength;
}

export function skyWind(time: number) {
    // 0 in the steady breeze, 1 at the height of a gust. Ribbons, wisps and the sign follow it.
    return skyGust(time).strength;
}

const desks: Record<string, number> = { rest: 1, 'drawer-desk': 2, 'little-desk': 3, 'upper-rest': 4 };
function rock(id: string, time: number) {
    const phase = desks[id] ?? 0;
    const r = STAGE_FOUR.rock;
    return {
        tilt: Det.sin(time * r.speed + phase * 1.9) * r.tilt,
        sway: Det.sin(time * r.speed * .6 + phase * 2.3) * r.sway,
    };
}

export function skyPlatforms(sky: Readonly<SkyState>, time: number): SkyPlatform[] {
    const bob = (phase: number) => Det.sin(time * .72 + phase) * 9;
    const desk = (id: string, x: number, y: number, width: number, extra = 0) => {
        const r = rock(id, time);
        return { id, kind: 'desk' as const, x: x + r.sway, y, width, angle: r.tilt + extra };
    };
    const little = rock('little-desk', time);
    return [
        { id: 'arrival-roof', kind: 'roof', x: 2670, y: -1720, width: 390, angle: 0 },
        { id: 'window-one', kind: 'sill', x: 3040, y: -1810 - sky.lift * 80, width: 180, angle: 0 },
        { id: 'window-two', kind: 'sill', x: 3240, y: -1930 - sky.lift * 80, width: 180, angle: 0 },
        { id: 'wind-sign', kind: 'sign', x: 3480, y: -2050, width: 270, angle: sky.signTilt },
        { id: 'wind-recovery', kind: 'sill', x: 3410, y: -1900, width: 460, angle: 0 },
        desk('rest', 3740, -2050 + bob(1), 210),
        desk('drawer-desk', 4070, -2150 + bob(2), 270, sky.deskTilt),
        ...(sky.drawer > .75 ? [{ id: 'little-desk', kind: 'small-desk' as const, x: 4350 + sky.drawer * 60 + little.sway, y: -2230 + bob(3), width: 170, angle: -.04 + little.tilt }] : []),
        desk('upper-rest', 4470, -2230 + bob(4), 220),
        { id: 'last-sign', kind: 'sign', x: 4770, y: -2310 + bob(5), width: 230, angle: -.1 },
        { id: 'finish', kind: 'finish', x: 5170, y: -2310 + bob(6), width: 470, angle: 0 },
    ];
}
export function skySurface(platform: Readonly<SkyPlatform>, x: number) {
    return platform.y + (x - platform.x - platform.width / 2) * Det.tan(platform.angle);
}

export type SkyHazard = { id: string; kind: SkyHazardKind; x: number; y: number; r: number; spin: number; focusId: number; item?: SkyGearItem; robot?: SkyRobot };

// Paper bundles ride each gust in from beyond the right edge, cross their stretch of the course, then drop out
// of sight below. Birds swoop down from above, glide across the upper desks and climb away out of view, so
// nothing ever blinks out on screen. Every path is a pure function of time.
const PAPER_LANES = deepFreeze([
    { from: 3640, to: 2820, y: -1905, lag: 0, speed: 360 },
    { from: 3960, to: 3150, y: -2105, lag: .55, speed: 330 },
    { from: 4520, to: 3700, y: -2150, lag: .2, speed: 370 },
    { from: 5250, to: 4420, y: -2345, lag: .8, speed: 340 },
]);
const PAPER_PATH = { lead: 1.5, drop: 170 };
const BIRD_LANES = deepFreeze([
    { from: 4560, to: 3880, y: -2215, period: 8.2, offset: 0, speed: 150 },
    { from: 5080, to: 4380, y: -2255, period: 8, offset: 3.4, speed: 165 },
    { from: 5560, to: 4700, y: -2450, period: 8.4, offset: 6.1, speed: 185 },
]);
const BIRD_PATH = { swoop: 1.4, reach: 260, height: 950, climb: 240 };
// Office gear adrift over the gaps: each piece bobs and sways on its own slow loop, so every hop has an opening.
const GEAR = deepFreeze([
    { item: 'keyboard', x: 3230, y: -2150, r: 14, ax: 18, ay: 48, period: 4.6, phase: 0 },
    { item: 'mouse', x: 2900, y: -1835, r: 9, ax: 30, ay: 40, period: 3.8, phase: 1.7 },
    { item: 'monitor', x: 3200, y: -2290, r: 17, ax: 40, ay: 30, period: 5.2, phase: 3.1 },
    { item: 'tower', x: 4010, y: -2240, r: 18, ax: 16, ay: 52, period: 5.6, phase: .6 },
    { item: 'keyboard', x: 4400, y: -2450, r: 14, ax: 46, ay: 30, period: 4.9, phase: 2.4 },
    { item: 'monitor', x: 4730, y: -2480, r: 17, ax: 18, ay: 40, period: 5, phase: 4.2 },
    { item: 'mouse', x: 5090, y: -2475, r: 9, ax: 22, ay: 52, period: 4.2, phase: 5.3 },
] as const);

// About one pass in four is a chrome robot parrot instead of a real bird; it hits like office gear.
export function skyBirdRobot(focusId: number): SkyRobot | null {
    let n = Math.imul(focusId + 0x51ed, 0x2c1b3c6d);
    n = Math.imul(n ^ (n >>> 15), 0x297a2d39);
    const pick = ((n ^ (n >>> 15)) >>> 0) % 8;
    return pick === 0 ? 'liquid' : pick === 1 ? 'black' : null;
}

export function skyHazards(time: number): SkyHazard[] {
    const out: SkyHazard[] = [];
    const w = STAGE_FOUR.wind;
    PAPER_LANES.forEach((lane, i) => {
        const shifted = time - w.calm - w.warn - lane.lag + PAPER_PATH.lead;
        const age = cycle(shifted, w.period);
        const glide = PAPER_PATH.lead + (lane.from - lane.to) / lane.speed;
        const falling = Math.max(0, age - glide);
        out.push({
            id: `paper-${i}`, kind: 'paper', r: 24, spin: age * 7 + i, focusId: i * 100000 + Math.floor(shifted / w.period),
            x: lane.from + PAPER_PATH.lead * lane.speed - age * lane.speed,
            y: lane.y + Det.sin(age * 5 + i) * 18 + PAPER_PATH.drop * falling * falling,
        });
    });
    BIRD_LANES.forEach((lane, i) => {
        const shifted = time + lane.offset;
        const age = cycle(shifted, lane.period);
        const glide = (lane.from - lane.to) / lane.speed;
        const { swoop, reach, height, climb } = BIRD_PATH;
        let x: number, y = lane.y + Det.sin(age * 2.4 + i) * 26;
        if (age < swoop) {
            const k = 1 - age / swoop;
            x = lane.from + reach * k;
            y -= height * k * k;
        } else {
            const flying = age - swoop;
            const away = Math.max(0, flying - glide);
            x = lane.from - flying * lane.speed;
            y -= climb * away * away;
        }
        const focusId = i * 100000 + Math.floor(shifted / lane.period);
        const robot = skyBirdRobot(focusId);
        out.push({ id: `bird-${i}`, kind: 'bird', x, y, r: 22, spin: age * 11, focusId, ...(robot ? { robot } : {}) });
    });
    GEAR.forEach((gear, i) => {
        const turn = (time / gear.period + gear.phase) * Math.PI * 2;
        out.push({
            id: `gear-${i}`, kind: 'gear', item: gear.item, r: gear.r, spin: Det.sin(turn * .5) * .6 + time * (gear.item === 'mouse' ? .9 : .25),
            x: gear.x + Det.sin(turn * .5) * gear.ax, y: gear.y + Det.sin(turn) * gear.ay,
            focusId: i * 100000 + Math.floor(time / gear.period),
        });
    });
    return out;
}
