import { deepFreeze } from '../../data';

type SatelliteLightBeam = {
    /**
     * `x`: a curtain of light from a satellite overhead, sweeping from side to side; dodged by steering left and right.
     * `y`: a curtain from a satellite to one side (`side`), sweeping up and down; dodged by climbing or diving.
     */
    axis: 'x' | 'y';
    side?: 1 | -1;
    /** The route depths it covers. */
    from: number; to: number;
    /** Its half width on the play plane and its sweep: `amplitude * sin(age * rate + phase)`. */
    halfWidth: number; amplitude: number; rate: number; phase: number;
};

// Stage five is played on one plane facing the camera, at the chair's depth: what overlaps on screen is what hits.
// Depth only says when a beam arrives; the chair always flies straight on toward the Earth's shadow.
export const STAGE_FIVE = deepFreeze({
    length: 10000, goal: 9600,
    // The stage four glide hands over at cruise speed; steering fades in over the entry instead of waiting for it.
    // Only the extinguisher drives the chair forward: `thrust` while spraying, otherwise it coasts and `coast` slows it.
    entryTime: 1, cruise: 145, thrust: 160, coast: .45,
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
    // Each beam is announced `warn` seconds before it arrives. A beam touches the chair once it overlaps the chair's
    // `chairRadius`. Every edge sweeps slower than the chair can steer (170 per second), so it can always be dodged.
    satelliteLight: {
        slowSpeed: 45, slowResponse: 2.4, shove: 260, chairRadius: 34, warn: 2.2,
        beams: [
            // 5-1, first gear: one beam at a time, with room to breathe between them.
            { axis: 'x', from: 600, to: 1200, halfWidth: 80, amplitude: 190, rate: .45, phase: 0 },
            { axis: 'x', from: 1750, to: 2350, halfWidth: 80, amplitude: 200, rate: .5, phase: 2.4 },
            { axis: 'y', side: 1, from: 2650, to: 3150, halfWidth: 48, amplitude: 100, rate: .55, phase: 0 },
            // 5-2, second gear: beams follow closer and start to cross.
            { axis: 'x', from: 3550, to: 4150, halfWidth: 75, amplitude: 210, rate: .5, phase: 1.2 },
            { axis: 'y', side: -1, from: 4050, to: 4650, halfWidth: 48, amplitude: 100, rate: .6, phase: 3.1 },
            { axis: 'x', from: 4750, to: 5350, halfWidth: 75, amplitude: 220, rate: .5, phase: 4.4 },
            { axis: 'y', side: 1, from: 5250, to: 5850, halfWidth: 48, amplitude: 100, rate: .6, phase: .7 },
            // 5-3, third gear: quick and close, then a quiet stretch before the shadow.
            { axis: 'x', from: 6150, to: 6700, halfWidth: 70, amplitude: 220, rate: .55, phase: 2 },
            { axis: 'x', from: 6950, to: 7500, halfWidth: 70, amplitude: 220, rate: .55, phase: 5.1 },
            { axis: 'y', side: -1, from: 7350, to: 7900, halfWidth: 46, amplitude: 100, rate: .65, phase: 1.6 },
            { axis: 'x', from: 8000, to: 8450, halfWidth: 75, amplitude: 210, rate: .55, phase: 3.3 },
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
    /** Seconds the player has been flying without spraying; the Space hint shows once this runs long. */
    idle: number;
    /** 1 on arriving in the Earth's shadow, then counting up in seconds while the ending plays. */
    settled: number;
};
