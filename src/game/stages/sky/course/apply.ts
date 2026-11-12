// Writes the decisions from ./decide into game state. The only place this system changes state.
import { startStage, setPlayer, type GameState } from '../../../state';
import type { GameEvent, Input } from '../../../types';
import { STAGES } from '../../index';
import { skyStep } from './decide';
export function applySky(s: GameState, out: GameEvent[], dt: number) {
    const held = (input: Input) => s.keys.includes(input) ? 1 : 0;
    const r = skyStep({
        sky: s.sky, p: s.p, ground: s.ground, coyote: s.coyote, jumpQ: s.jumpQ, checkpoint: s.checkpoint, time: s.time,
        direction: held('right') - held('left'),
        length: STAGES[s.stage].length, sprayBurst: s.sprayBurst, sprayDir: s.sprayDir,
    }, dt);
    s.sky = r.sky;
    setPlayer(s, r.p);
    s.ground = r.ground;
    s.coyote = r.coyote;
    s.jumpQ = r.jumpQ;
    s.checkpoint = r.checkpoint;
    s.sprayBurst = r.sprayBurst;
    s.sprayDir = r.sprayDir;
    if (r.speed !== null) s.actualSpeed = r.speed;
    if (r.reached) out.push({ type: 'cue', id: 'checkpoint' });
    if (r.fell) s.deaths++;
    if (r.won) {
        s.completedStage = 4;
        const time = s.time;
        startStage(s, 5, out);
        s.time = time;
    }
}
