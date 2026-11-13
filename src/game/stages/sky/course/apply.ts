import { startStage, setPlayer, type GameState } from '../../../state';
import type { GameEvent, Input } from '../../../types';
import { STAGES } from '../../index';
import { skyStep } from './decide';
import { FOCUS_DAMAGE } from '../../../level';
import { applyFocusHit, applyFocusRecovery } from '../../../systems/focus/apply';
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
    if (r.reached) {
        // Like every flag, the halfway desk clears the head.
        s.focus = 100;
        s.focusClock = 0;
        out.push({ type: 'cue', id: 'checkpoint' });
    }
    if (r.hit) {
        if (r.hit.kind === 'paper') out.push({ type: 'cue', id: 'paper-hit' });
        // Each bundle or bird costs focus once per pass; running out ends the attempt like any distraction.
        const damage = r.hit.kind === 'paper' ? FOCUS_DAMAGE.skyPaper : FOCUS_DAMAGE.bird;
        if (!applyFocusHit(s, out, { kind: r.hit.kind, id: r.hit.focusId, damage })) return;
    }
    // The takeover skips the shared tick, so focus comes back here while the course is under way.
    if (s.sky.phase === 'course') applyFocusRecovery(s, dt);
    if (r.fell) s.deaths++;
    if (r.won) {
        s.completedStage = 4;
        const time = s.time;
        startStage(s, 5, out);
        s.time = time;
    }
}
