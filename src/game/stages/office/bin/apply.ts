import { BIN_REST } from './decide';
import { setActivity, setPlayer } from '../../../state';

import type { CoreState } from '../../../state';
import type { GameEvent } from '../../../types';
export function applyBinFall(s: CoreState, out: GameEvent[]): void {
    if (s.mode !== 'play') {
        return;
    }
    s.office.inBin = true;
    s.office.dirty = true;
    s.office.binFalls++;
    s.deaths++;
    setPlayer(s, BIN_REST);
    s.keys = [];
    setActivity(s, { mode: 'dead', lossReason: 'bin', impact: null });
    out.push({ type: 'cue', id: 'bin-fall' });
    out.push({ type: 'cue', id: 'bin-comment' });
    out.push({ type: 'cue', id: 'bin-game-over' });
}
