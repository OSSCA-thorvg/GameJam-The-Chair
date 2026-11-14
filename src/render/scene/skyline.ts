import type { Vector } from '../types';

// The roof shapes of the city's towers, one look everywhere it is seen: through the opening's clock window, the
// stage one office windows and behind the stage three roof.

/** Draws a filled polygon; each caller passes its own (screen-space or world-space). */
export type Fill = (points: Vector[], color: string) => void;
export type Roof = 'flat' | 'antenna' | 'setback';

const box = (left: number, top: number, right: number, bottom: number): Vector[] => [[left, top], [right, top], [right, bottom], [left, bottom]];

/** Mostly flat roofs, with an antenna or a stepped top here and there, picked by a tower's own `seed`. */
export function roofFor(seed: number): Roof {
    const k = Math.abs(seed) % 5;
    return k === 0 ? 'antenna' : k === 2 ? 'setback' : 'flat';
}

/** What sits on a tower's roof: a stepped top or a thin antenna, centred on the roof line at `top`. */
export function roofShape(fill: Fill, left: number, top: number, width: number, roof: Roof, color: string) {
    if (roof === 'setback') fill(box(left + width * .25, top - width * .3, left + width * .75, top), color);
    if (roof === 'antenna') fill(box(left + width * .47, top - width * .6, left + width * .53, top), color);
}
