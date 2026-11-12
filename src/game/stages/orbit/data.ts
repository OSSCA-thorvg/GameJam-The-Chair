import { deepFreeze } from '../../data';

export const STAGE_FIVE = deepFreeze({
    length: 6200, goal: 5400,
    entryTime: 2.5, cruise: 145, thrust: 100, maxSpeed: 330,
    acceleration: 250, drag: 1.8, braking: 5.5, stopSpeed: 24, settleTime: .7,
    bankSpeed: 650, bankResponse: 5, cruiseRecovery: .6,
    ringClearance: 40, drawerClearance: 65, approachSpeed: 55, cushionDepth: 160, cushionDrag: 7,
    bounds: { x: 680, y: 430 },
    rings: [{ x: 0, y: 0, z: 1500, radius: 260 }, { x: 240, y: 160, z: 3100, radius: 260 }],
    drawer: { x: 0, y: 40, z: 4800, width: 1080, height: 720, depth: 1000 },
    checkpoint: { x: 0, y: 40, z: 5350 },
});

export type OrbitState = {
    phase: 'entry' | 'rings' | 'drawer' | 'parked';
    age: number;
    z: number;
    speed: number;
    rings: number;
    settled: number;
};
