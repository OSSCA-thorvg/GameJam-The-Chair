import type { Point } from './types';
export type StageId = 1 | 2 | 3;
export type Furniture = { kind: 'chair' | 'cabinet'; x: number; y: number; width: number; height: number; vx: number };
export const STAGE_TWO = {
    length: 3700, goal: 3520,
    door: { x: 740, period: 5.2, clearance: .72 },
    checkpoints: [{ x: 100, y: 392 }, { x: 960, y: 392 }, { x: 1990, y: 392 }, { x: 2490, y: 282 }, { x: 3420, y: 282 }],
    terrain: [
        [{ x: -400, y: 420 }, { x: 1020, y: 420 }, { x: 1400, y: 500 }, { x: 1580, y: 500 }, { x: 1900, y: 420 }, { x: 2350, y: 420 }, { x: 2350, y: 800 }, { x: -400, y: 800 }],
        [{ x: 2350, y: 310 }, { x: 2700, y: 310 }, { x: 2700, y: 335 }, { x: 2350, y: 335 }],
        [{ x: 2700, y: 500 }, { x: 2850, y: 500 }, { x: 3400, y: 310 }, { x: 4000, y: 310 }, { x: 4000, y: 800 }, { x: 2700, y: 800 }]
    ] satisfies Point[][]
};
export function createFurniture(): Furniture[] {
    return [{ kind: 'chair', x: 380, y: 420, width: 48, height: 40, vx: 0 }, { kind: 'chair', x: 470, y: 420, width: 48, height: 40, vx: 0 }, { kind: 'cabinet', x: 2150, y: 420, width: 100, height: 55, vx: 0 }];
}
export function elevatorAt(time: number) {
    return { x: 2700 + (1 - Math.cos(time * Math.PI / 4)) * 150, y: 310, width: 160, height: 20 };
}

export function doorAt(time: number) {
    const angle = time * Math.PI * 2 / STAGE_TWO.door.period;
    return { ...STAGE_TWO.door, angle, open: Math.abs(Math.cos(angle)) < STAGE_TWO.door.clearance };
}

export function chairFloorAt(x: number) {
    if (x <= 1020) return 420;
    if (x < 1400) return 420 + (x - 1020) * 80 / 380;
    if (x <= 1580) return 500;
    if (x < 1900) return 500 - (x - 1580) * 80 / 320;
    if (x < 2350) return 420;
    if (x <= 2850) return 500;
    if (x < 3400) return 500 - (x - 2850) * 190 / 550;
    return 310;
}
