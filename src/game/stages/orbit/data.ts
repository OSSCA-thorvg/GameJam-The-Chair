import { deepFreeze } from '../../data';

type SatelliteLightBeam = {
    /** The route depths it covers. */
    from: number; to: number;
    /** Half the size of its rectangle on the play plane, across (`x`) and up (`y`). */
    half: { x: number; y: number };
};

// Stage five is played on one plane facing the camera, at the chair's depth: what overlaps on screen is what hits.
// Depth only says when a beam arrives; the chair always flies straight on toward the Earth's shadow by itself.
export const STAGE_FIVE = deepFreeze({
    length: 10000, goal: 9600,
    // The stage four glide hands over at cruise speed; steering fades in over the entry instead of waiting for it.
    // The extinguisher fires on its own and speeds the chair up by `thrust` per second to its gear's top speed.
    entryTime: 1, cruise: 145, thrust: 160,
    // Three gears: from each depth on the top speed rises, and the beams come closer together.
    gears: [{ from: 0, maxSpeed: 260 }, { from: 2800, maxSpeed: 330 }, { from: 5600, maxSpeed: 400 }],
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
    // Each beam's satellite takes aim at the chair `warn` seconds before the beam arrives: its rectangle follows the
    // chair (`track` is how quickly) until `lock` seconds before, then holds still where it was aimed. A beam touches
    // the chair once its rectangle overlaps the chair's `chairRadius`. Locked a full second ahead, every rectangle
    // can be left in time.
    satelliteLight: {
        slowSpeed: 45, slowResponse: 2.4, shove: 260, chairRadius: 34, warn: 2.2, lock: 1, track: 5,
        beams: [
            // 5-1, first gear: one at a time, with room to breathe between them.
            { from: 600, to: 1150, half: { x: 95, y: 75 } },
            { from: 1700, to: 2250, half: { x: 95, y: 75 } },
            { from: 2650, to: 3150, half: { x: 200, y: 55 } },
            // 5-2, second gear: closer together, wide and tall ones in turn.
            { from: 3550, to: 4050, half: { x: 95, y: 80 } },
            { from: 4150, to: 4650, half: { x: 60, y: 150 } },
            { from: 4750, to: 5250, half: { x: 210, y: 55 } },
            { from: 5300, to: 5800, half: { x: 100, y: 80 } },
            // 5-3, third gear: quick and close, two overlapping, then a quiet stretch before the shadow.
            { from: 6150, to: 6600, half: { x: 100, y: 80 } },
            { from: 6850, to: 7300, half: { x: 65, y: 150 } },
            { from: 7150, to: 7600, half: { x: 220, y: 55 } },
            { from: 7900, to: 8400, half: { x: 110, y: 85 } },
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
    /** Where each beam's rectangle is centred on the play plane: following the chair, then locked. */
    aims: readonly { readonly x: number; readonly y: number }[];
    /** 1 on arriving in the Earth's shadow, then counting up in seconds while the ending plays. */
    settled: number;
};
