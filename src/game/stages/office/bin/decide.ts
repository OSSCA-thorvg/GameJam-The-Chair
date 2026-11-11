import { LEVEL } from '../../../level';
import type { Player } from '../../../types';

// Dropping onto the open office bin while falling catches the chair.
export function fallsIntoBin(p: Readonly<Player>, binCooldown: number) {
    const bin = LEVEL.bin;
    return binCooldown === 0 && p.x > bin.a + 25 && p.x < bin.b - 25 && p.y + 28 >= bin.rim && p.vy >= 0;
}

// Where the chair rests once inside the bin.
export const BIN_REST: Readonly<Player> = Object.freeze({ x: LEVEL.bin.x, y: LEVEL.floor + 66, vx: 0, vy: 0, a: .1, w: 0 });
