import { deepFreeze } from '../../data';

export const STAGE_FIVE = deepFreeze({
    length: 6200, goal: 5100,
    entryTime: 2.5, cruise: 145, thrust: 100, maxSpeed: 270,
    acceleration: 250, drag: 1.8,
    bankSpeed: 650, bankResponse: 5, cruiseRecovery: .6,
    ringClearance: 40, approachSpeed: 55, arrivalSpeed: 45, arrivalDistance: 600,
    bounds: { x: 680, y: 430 },
    // No hoops: after the entry the chair heads straight for the office door.
    rings: [] as { x: number; y: number; z: number; radius: number }[],
    // 5-1: one company satellite sweeps a beam of praise across the cloud layer. Inside it, trophies and
    // certificates shove the chair aside and slow it down, unless it is tucked into one of the shelter clouds.
    praise: {
        satellite: { x: 0, y: 560, z: 2300 },
        sweep: { amplitude: 430, rate: .45 },
        halfWidth: 210, from: 1300, to: 3300,
        slowSpeed: 45, slowResponse: 2.4, shove: 380,
        shelters: [{ x: -380, y: -60, z: 1700 }, { x: 340, y: 40, z: 2350 }, { x: -260, y: -20, z: 3000 }],
        shelterSize: { x: 210, y: 170, z: 330 },
    },
    door: { x: 0, y: -150, z: 5100, width: 240, height: 340, clearance: 100, stopDistance: 220 },
    checkpoint: { x: 0, y: -150, z: 4880 },
});

export type OrbitState = {
    phase: 'entry' | 'rings' | 'door' | 'parked';
    age: number;
    z: number;
    speed: number;
    rings: number;
    settled: number;
};
