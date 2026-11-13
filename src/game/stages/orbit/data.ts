import { deepFreeze } from '../../data';

type PraiseBeam = {
    satellite: { x: number; y: number; z: number };
    /** Route depths the beam covers, how wide it is, and how it sweeps from side to side. */
    from: number; to: number; halfWidth: number; amplitude: number; rate: number; phase: number;
};

export const STAGE_FIVE = deepFreeze({
    length: 10000, goal: 9600,
    entryTime: 2.5, cruise: 145, thrust: 100, maxSpeed: 270,
    acceleration: 250, drag: 1.8,
    bankSpeed: 650, bankResponse: 5, cruiseRecovery: .6,
    ringClearance: 40, approachSpeed: 55, arrivalSpeed: 45, arrivalDistance: 600,
    bounds: { x: 680, y: 430 },
    // No hoops: after the entry the chair heads straight for the Earth's shadow.
    rings: [] as { x: number; y: number; z: number; radius: number }[],
    // Company satellites sweep beams of praise across the route. Inside one, trophies and certificates shove the
    // chair aside and slow it down. 5-1 has shelter clouds to duck into; 5-2 only the dark gaps between three beams;
    // in 5-3 the last beam stops at the edge of the Earth's shadow.
    // Every beam sweeps sideways slower than the chair can steer (about 140 per second), so it can always be dodged.
    praise: {
        slowSpeed: 45, slowResponse: 2.4, shove: 380,
        beams: [
            // 5-1: one wide beam over the cloud layer.
            { satellite: { x: 0, y: 560, z: 2300 }, from: 1300, to: 3300, halfWidth: 210, amplitude: 430, rate: .28, phase: 0 },
            // 5-2: three narrow beams in the upper atmosphere, overlapping in depth and crossing.
            { satellite: { x: -420, y: 620, z: 4700 }, from: 3800, to: 5600, halfWidth: 140, amplitude: 480, rate: .22, phase: 0 },
            { satellite: { x: 380, y: 700, z: 5300 }, from: 4400, to: 6200, halfWidth: 140, amplitude: 480, rate: .27, phase: 2.2 },
            { satellite: { x: 0, y: 760, z: 5900 }, from: 5000, to: 6800, halfWidth: 140, amplitude: 480, rate: .18, phase: 4.1 },
            // 5-3: the last beam in space, cut off by the Earth's shadow.
            { satellite: { x: 300, y: 640, z: 8000 }, from: 7200, to: 8800, halfWidth: 250, amplitude: 380, rate: .3, phase: 1 },
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
    rings: number;
    /** 1 on arriving in the Earth's shadow, then counting up in seconds while the ending plays. */
    settled: number;
};
