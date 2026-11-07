import { LEVEL } from '../level';
import type { GameCore } from '../core';

export function binEnter(s: GameCore) {
    if (s.mode !== 'play') return;
    const F = LEVEL.floor;
    s.inBin = true;
    s.dirty = true;
    s.binFalls++;
    s.deaths++;
    s.lossReason = 'bin';
    s.p.x = s.bin.x;
    s.p.y = F + 66;
    s.p.vx = s.p.vy = s.p.w = 0;
    s.p.a = .1;
    s.keys.clear();
    s.mode = 'dead';
    s.events.push({ type: 'cue', id: 'bin-fall' });
    s.events.push({ type: 'cue', id: 'bin-comment' });
    s.events.push({ type: 'cue', id: 'bin-game-over' });
}
