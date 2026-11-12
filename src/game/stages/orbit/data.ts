import { deepFreeze } from '../../data';

export const STAGE_FIVE = deepFreeze({
    length: 6200, goal: 5100,
    entryTime: 2.5, cruise: 145, thrust: 100, maxSpeed: 270,
    acceleration: 250, drag: 1.8,
    bankSpeed: 650, bankResponse: 5, cruiseRecovery: .6,
    ringClearance: 40, approachSpeed: 55, arrivalSpeed: 45, arrivalDistance: 600,
    bounds: { x: 680, y: 430 },
    rings: [{ x: 0, y: 0, z: 1400, radius: 400 }, { x: 100, y: 45, z: 3000, radius: 340 }],
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
