import type { Vector } from '../types';


export type Fill = (points: Vector[], color: string) => void;
export type Roof = 'flat' | 'antenna' | 'setback';

const box = (left: number, top: number, right: number, bottom: number): Vector[] => [[left, top], [right, top], [right, bottom], [left, bottom]];

export function roofFor(seed: number): Roof {
    const k = Math.abs(seed) % 5;
    return k === 0 ? 'antenna' : k === 2 ? 'setback' : 'flat';
}

export function roofShape(fill: Fill, left: number, top: number, width: number, roof: Roof, color: string) {
    if (roof === 'setback') fill(box(left + width * .25, top - width * .3, left + width * .75, top), color);
    if (roof === 'antenna') fill(box(left + width * .47, top - width * .6, left + width * .53, top), color);
}
