import { LEVEL } from '../level';
import type { GameCore } from '../state';
import type { GameEvent } from '../types';

export function binEnter(s: GameCore, out: GameEvent[]) {
    if (s.mode !== 'play') return;
    const F = LEVEL.floor;
    s.inBin = true;
    s.dirty = true;
    s.binFalls++;
    s.deaths++;
    s.lossReason = 'bin';
    s.p.x = LEVEL.bin.x;
    s.p.y = F + 66;
    s.p.vx = s.p.vy = s.p.w = 0;
    s.p.a = .1;
    s.keys = [];
    s.mode = 'dead';
    out.push({ type: 'cue', id: 'bin-fall' });
    out.push({ type: 'cue', id: 'bin-comment' });
    out.push({ type: 'cue', id: 'bin-game-over' });
}
