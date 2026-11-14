import { STAGE_FIVE, type OrbitState } from './data';
export type { OrbitState } from './data';

export function createOrbitState(): OrbitState {
    return { phase: 'entry', age: 0, z: 0, speed: 145, rings: 0, aims: STAGE_FIVE.satelliteLight.beams.map(() => ({ x: 0, y: 0 })), settled: 0 };
}
