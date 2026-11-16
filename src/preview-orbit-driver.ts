import type { GameState } from './game/game';
import type { Input } from './game/types';
import { orbitStep, satelliteLightOn } from './game/stages/orbit/course/decide';

const PLAN = { seconds: 1.2, step: .1 };
const TURNS: Input[][] = [['left'], [], ['right']];
const CLIMBS: Input[][] = [['forward'], [], ['back']];

/**
 * Steering for the stage five previews: try every way across and up for a moment with the real flight rules and take
 * the one that stays out of the beams and gets furthest on, spraying all the way.
 */
export function orbitKeys(state: GameState): Input[] {
    const orbit = state.orbit, p = state.player;
    if (!orbit) return [];
    let best = -Infinity, keys: Input[] = [];
    for (const turn of TURNS) for (const climb of CLIMBS) {
        const held = [...turn, ...climb];
        let o = orbit, q = p, lit = 0;
        for (let t = 0; t < PLAN.seconds; t += PLAN.step) {
            ({ orbit: o, p: q } = orbitStep(o, q, held, PLAN.step));
            // Nearer moments count more: those are the ones still certain.
            if (satelliteLightOn(o, q, o.z)) lit += 1.5 - t;
        }
        // Keeping on the way it already moves breaks ties, so it commits to one way out instead of dithering.
        const along = (turn[0] === 'left' ? -p.vx : turn[0] === 'right' ? p.vx : 0) + (climb[0] === 'forward' ? p.vy : climb[0] === 'back' ? -p.vy : 0);
        const score = (o.z - orbit.z) * .05 - lit * 40 - (Math.abs(q.x) + Math.abs(q.y)) * .01 + along * .02;
        if (score > best) { best = score; keys = turn.concat(climb); }
    }
    return keys;
}

