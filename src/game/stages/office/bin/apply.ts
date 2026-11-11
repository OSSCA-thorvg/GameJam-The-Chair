// Writes the decisions from ./decide into game state. The only place this system changes state.
import { setPlayer, type GameState } from '../../../state';
import type { GameEvent } from '../../../types';
import { BIN_REST } from './decide';
export function applyBinFall(s: GameState, out: GameEvent[]) {
    if (s.mode !== 'play') return;
    s.office.inBin = true;
    s.office.dirty = true;
    s.office.binFalls++;
    s.deaths++;
    s.lossReason = 'bin';
    setPlayer(s, BIN_REST);
    s.keys = [];
    s.mode = 'dead';
    out.push({ type: 'cue', id: 'bin-fall' });
    out.push({ type: 'cue', id: 'bin-comment' });
    out.push({ type: 'cue', id: 'bin-game-over' });
}
