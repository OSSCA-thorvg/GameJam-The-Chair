import { deepFreeze } from '../../data';

type SatelliteLightBeam = {
    /** The route depths it covers. */
    from: number; to: number;
    /** Half the size of its rectangle on the play plane, across (`x`) and up (`y`); a circle's radius is `x`. */
    half: { x: number; y: number };
    /** `circle`: the big lens straight ahead, shining back at the chair. */
    shape?: 'rect' | 'circle';
    /** Aims this many seconds ahead of where the chair is heading instead of where it is. */
    lead?: number;
};

// Stage five is played on one plane facing the camera, at the chair's depth: what overlaps on screen is what hits.
// Depth only says when a beam arrives; the chair always flies straight on toward the Earth's shadow by itself.
export const STAGE_FIVE = deepFreeze({
    length: 10000, goal: 9600,
    // The stage four glide hands over at cruise speed; steering fades in over the entry instead of waiting for it.
    // The extinguisher fires on its own and speeds the chair up by `thrust` per second to its gear's top speed.
    entryTime: 1, cruise: 145, thrust: 160,
    // Three gears: from each depth on the top speed rises, the beams come closer together, and each satellite
    // locks on later (`lock` seconds before its beam arrives) after following the chair more tightly (`track`).
    gears: [
        { from: 0, maxSpeed: 260, lock: 1, track: 5 },
        { from: 2800, maxSpeed: 330, lock: .9, track: 7 },
        { from: 5600, maxSpeed: 400, lock: .8, track: 9 },
    ],
    // Restart flags in the quiet stretches after the first and second gears, at cruise speed.
    restarts: [3200, 5650],
    // The arrow keys move the chair straight across and up the plane (`speed`), chasing that rate: quick to answer
    // (`response`), quick to settle (`release`). Past `bounds` the company geofence (the viewfinder brackets)
    // pushes back (`edge` per unit over) and never lets it more than `overshoot` past.
    steer: { speed: 170, response: 7, release: 4.5, edge: 5, overshoot: 30 },
    bankSlide: .0013, bankResponse: 5,
    ringClearance: 40, approachSpeed: 55,
    // Once in the Earth's shadow the company autopilot takes over: it levels the chair off and flies it in, slowing
    // from cruise to `landing` speed as it nears.
    autopilot: { from: 8800, response: 1.5, landing: 70, brake: .45 },
    bounds: { x: 330, y: 150 },
    rings: [] as { x: number; y: number; z: number; radius: number }[],
    // Each beam's satellite takes aim at the chair `warn` seconds before the beam arrives: its shape follows the
    // chair until its gear's `lock`, then holds still where it was aimed. The moment it locks, the whole flight
    // stops for `freeze` seconds, like a camera shutter. A beam touches the chair once its shape overlaps the chair's
    // `chairRadius`. Every shape can be left in the time between its lock and its arrival.
    satelliteLight: {
        slowSpeed: 45, slowResponse: 2.4, shove: 260, chairRadius: 34, warn: 2.2, freeze: .2,
        beams: [
            // 5-1, first gear: one at a time, with room to breathe between them.
            { from: 600, to: 1150, half: { x: 95, y: 75 } },
            { from: 1700, to: 2250, half: { x: 95, y: 75 } },
            { from: 2650, to: 3150, half: { x: 200, y: 55 } },
            // 5-2, second gear: closer together, then two satellites locking on one after the other.
            { from: 3800, to: 4250, half: { x: 95, y: 80 } },
            { from: 4400, to: 4850, half: { x: 60, y: 150 } },
            { from: 5050, to: 5450, half: { x: 90, y: 70 } },
            { from: 5170, to: 5570, half: { x: 90, y: 70 } },
            // 5-3, third gear: a satellite that aims where the chair is heading; one aiming where it is and one
            // where it is going, together; three in a row; then the big lens ahead firing three times.
            { from: 6250, to: 6600, half: { x: 100, y: 65 }, lead: .5 },
            { from: 6850, to: 7250, half: { x: 210, y: 55 } },
            { from: 6850, to: 7250, half: { x: 60, y: 140 }, lead: .5 },
            { from: 7450, to: 7800, half: { x: 80, y: 60 } },
            { from: 7550, to: 7900, half: { x: 80, y: 60 } },
            { from: 7650, to: 8000, half: { x: 80, y: 60 } },
            { from: 8100, to: 8250, half: { x: 65, y: 65 }, shape: 'circle' },
            { from: 8240, to: 8390, half: { x: 65, y: 65 }, shape: 'circle' },
            { from: 8380, to: 8500, half: { x: 65, y: 65 }, shape: 'circle' },
        ] as SatelliteLightBeam[],
    },
    heights: { air: 3300, space: 6800, shadow: 8800 },
    // The goal is deep inside the Earth's shadow. It keeps the name `door` so saved states stay readable.
    door: { x: 0, y: 0, z: 9600, width: 240, height: 340, clearance: 2000, stopDistance: 220 },
    checkpoint: { x: 0, y: 0, z: 9400 },
});

export type OrbitState = {
    phase: 'entry' | 'rings' | 'door' | 'parked';
    age: number;
    z: number;
    speed: number;
    rings: number;
    /** Where each beam's shape is centred on the play plane: following the chair, then locked. */
    aims: readonly { readonly x: number; readonly y: number }[];
    /** Seconds left of the shutter stop after a satellite locks on; nothing moves meanwhile. */
    freeze: number;
    /** 1 on arriving in the Earth's shadow, then counting up in seconds while the ending plays. */
    settled: number;
};
