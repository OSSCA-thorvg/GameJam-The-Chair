import { deepFreeze } from '../../data';

type PraiseBeam = {
    satellite: { x: number; y: number; z: number };
    /**
     * `x`: shines down from above and sweeps from side to side, dodged by steering left and right.
     * `y`: shines in from the side and sweeps up and down, dodged by climbing or diving.
     */
    axis: 'x' | 'y';
    /**
     * The light spreads from the satellite's lens like a tent. These give its slice through the middle of the play
     * area (y = 0 for a down beam, x = 0 for a side beam): the route depths it covers there, how wide it is, and how
     * it sweeps along its axis. Nearer the satellite the slice is smaller, further away larger.
     */
    from: number; to: number; halfWidth: number; amplitude: number; rate: number; phase: number;
};

export const STAGE_FIVE = deepFreeze({
    length: 10000, goal: 9600,
    // The stage four glide hands over at cruise speed; steering fades in over the entry instead of waiting for it.
    // Only the extinguisher drives the chair forward: `thrust` while spraying, otherwise it coasts and `coast` slows it.
    entryTime: 1, cruise: 145, thrust: 140, coast: .45, maxSpeed: 270,
    // The chair flies where it faces: left and right turn it (`turn`, radians per second) up to `heading` either
    // side of the Earth's shadow, so every way it can face still closes in on it; up and down climb and dive
    // (`speed`). Both chase their target rate: quick to answer (`response`), quick to settle (`release`).
    // The company geofence is an invisible wall: past `bounds` across and up it pushes the chair back (`edge` per
    // unit over) and never lets it more than `overshoot` past.
    steer: { speed: 210, turn: 2, heading: 70 * Math.PI / 180, response: 7, release: 4.5, edge: 5, overshoot: 80 },
    bankTurn: .28, bankResponse: 5,
    ringClearance: 40, approachSpeed: 55,
    // Once in the Earth's shadow the company autopilot takes over: it turns the chair to face the goal (`turn`
    // per second of heading), levels it off, and flies it in, slowing from cruise to `landing` speed as it nears.
    autopilot: { from: 8800, turn: 1.8, response: 1.5, landing: 70, brake: .45 },
    // Across either way up to `x`, down to `-y`, and up to a higher ceiling `top`.
    bounds: { x: 680, y: 430, top: 750 },
    // No hoops: after the entry the chair heads straight for the Earth's shadow.
    rings: [] as { x: number; y: number; z: number; radius: number }[],
    // Company satellites sweep beams of praise across the route. Inside one, trophies and certificates shove the
    // chair aside and slow it down. 5-1 has shelter clouds to duck into; 5-2 only the dark gaps between three beams;
    // in 5-3 the last beam stops at the edge of the Earth's shadow.
    // Every beam sweeps slower than the chair can steer (210 per second) at every height, so it can always be dodged.
    // The satellites hang well above (or beside) the play area, so the slices stay close in size across it.
    praise: {
        slowSpeed: 45, slowResponse: 2.4, shove: 380, lens: 40,
        beams: [
            // 5-1: one wide beam over the cloud layer.
            { satellite: { x: 0, y: 1450, z: 2300 }, axis: 'x', from: 1300, to: 3300, halfWidth: 210, amplitude: 430, rate: .28, phase: 0 },
            // 5-2: three narrow beams in the upper atmosphere, overlapping in depth and crossing. The middle one shines
            // in from the right and sweeps up and down, so dodging it takes climbing or diving.
            { satellite: { x: -420, y: 1450, z: 4700 }, axis: 'x', from: 3800, to: 5600, halfWidth: 140, amplitude: 480, rate: .22, phase: 0 },
            { satellite: { x: 1700, y: 0, z: 5300 }, axis: 'y', from: 4400, to: 6200, halfWidth: 120, amplitude: 300, rate: .27, phase: 2.2 },
            { satellite: { x: 0, y: 1600, z: 5900 }, axis: 'x', from: 5000, to: 6800, halfWidth: 140, amplitude: 480, rate: .18, phase: 4.1 },
            // 5-3: the last beam in space, cut off by the Earth's shadow.
            { satellite: { x: 300, y: 1450, z: 8600 }, axis: 'x', from: 7200, to: 8700, halfWidth: 250, amplitude: 380, rate: .3, phase: 1 },
        ] as PraiseBeam[],
        shelters: [{ x: -380, y: -60, z: 1700 }, { x: 340, y: 40, z: 2350 }, { x: -260, y: -20, z: 3000 }],
        shelterSize: { x: 210, y: 170, z: 330 },
    },
    // Where the cloud layer thins into the upper atmosphere, where space begins, and where the Earth's shadow starts.
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
    /** Which way the chair faces, in radians: 0 toward the Earth's shadow, positive turning right. */
    heading: number;
    /** How fast it is turning, radians per second. */
    yaw: number;
    rings: number;
    /** 1 on arriving in the Earth's shadow, then counting up in seconds while the ending plays. */
    settled: number;
};
