import { deepFreeze } from '../../data';

type SatelliteLightBeam = {
    from: number;
    to: number;
    half: { x: number; y: number };
    shape?: 'rect' | 'circle';
    lead?: number;
};

export const STAGE_FIVE = deepFreeze({
    length: 10000,
    goal: 9600,
    entryTime: 1,
    cruise: 145,
    thrust: 160,
    gears: [
        { from: 0, maxSpeed: 260, lock: 1, track: 5 },
        { from: 2800, maxSpeed: 330, lock: 0.9, track: 7 },
        { from: 5600, maxSpeed: 400, lock: 0.8, track: 9 },
    ],
    restarts: [5650],
    steer: { speed: 170, response: 7, release: 4.5, edge: 5, overshoot: 30 },
    bankSlide: 0.0013,
    bankResponse: 5,
    ringClearance: 40,
    approachSpeed: 55,
    autopilot: { from: 8800, response: 1.5, landing: 70, brake: 0.45 },
    bounds: { x: 330, y: 150 },
    rings: [] as Array<{ x: number; y: number; z: number; radius: number }>,
    satelliteLight: {
        slowSpeed: 45,
        slowResponse: 2.4,
        shove: 260,
        chairRadius: 34,
        warn: 2.2,
        freeze: 0.2,
        beams: [
            { from: 600, to: 1150, half: { x: 95, y: 75 } },
            { from: 1700, to: 2250, half: { x: 95, y: 75 } },
            { from: 2650, to: 3150, half: { x: 200, y: 55 } },
            { from: 3800, to: 4250, half: { x: 95, y: 80 } },
            { from: 4400, to: 4850, half: { x: 60, y: 150 } },
            { from: 5050, to: 5450, half: { x: 90, y: 70 } },
            { from: 5170, to: 5570, half: { x: 90, y: 70 } },
            { from: 6250, to: 6600, half: { x: 100, y: 65 }, lead: 0.5 },
            { from: 6850, to: 7250, half: { x: 210, y: 55 } },
            { from: 6850, to: 7250, half: { x: 60, y: 140 }, lead: 0.5 },
            { from: 7450, to: 7800, half: { x: 80, y: 60 } },
            { from: 7550, to: 7900, half: { x: 80, y: 60 } },
            { from: 7650, to: 8000, half: { x: 80, y: 60 } },
            { from: 8100, to: 8250, half: { x: 65, y: 65 }, shape: 'circle' },
            { from: 8240, to: 8390, half: { x: 65, y: 65 }, shape: 'circle' },
            { from: 8380, to: 8500, half: { x: 65, y: 65 }, shape: 'circle' },
        ] as SatelliteLightBeam[],
    },
    heights: { air: 3300, space: 6800, shadow: 8800 },
    door: {
        x: 0,
        y: 0,
        z: 9600,
        width: 240,
        height: 340,
        clearance: 2000,
        stopDistance: 220,
    },
    checkpoint: { x: 0, y: 0, z: 9400 },
});

export type OrbitState = {
    phase: 'entry' | 'rings' | 'door' | 'parked';
    age: number;
    z: number;
    speed: number;
    rings: number;
    aims: ReadonlyArray<{ readonly x: number; readonly y: number }>;
    freeze: number;
    // Starts at 1 on arrival; subsequent values count ending seconds.
    settled: number;
};
