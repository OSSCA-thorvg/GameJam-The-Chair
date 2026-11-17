import type { Vector } from '../../types';
export type Fill = (points: Vector[], color: string) => void;
export type Roof = 'flat' | 'antenna' | 'setback';
const box = (
    left: number,
    top: number,
    right: number,
    bottom: number,
): Vector[] => [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
];
export function roofFor(seed: number): Roof {
    const k = Math.abs(seed) % 5;
    return k === 0 ? 'antenna' : k === 2 ? 'setback' : 'flat';
}
export function roofShape(
    fill: Fill,
    left: number,
    top: number,
    width: number,
    {
        roof,
        color,
    }: {
        roof: Roof;
        color: string;
    },
): void {
    if (roof === 'setback') {
        fill(
            box(
                left + width * 0.25,
                top - width * 0.3,
                left + width * 0.75,
                top,
            ),
            color,
        );
    }
    if (roof === 'antenna') {
        fill(
            box(
                left + width * 0.47,
                top - width * 0.6,
                left + width * 0.53,
                top,
            ),
            color,
        );
    }
}
