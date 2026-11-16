import { STAGE_FOUR } from '../../game/stages/sky/data';
import { createOrbitState } from '../../game/stages/orbit/state';
import type { RenderCtx } from '../context';
import { REVEAL_DURATION, revealChairOrbit, revealSpeed, revealTravel, SKY_DEPARTURE } from './sky-camera';
import { ORBIT_WATCH } from './orbit-watch';
import { orbitEnding } from './orbit-ending';
import { drawOrbitShot } from './orbit-shot';

const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};

const FLYING = orbitEnding(createOrbitState());

export function drawSkyReveal(ctx: RenderCtx) {
    const { sky } = ctx.state;
    const { settle, turn } = STAGE_FOUR.reveal;
    const elapsed = sky.phase === 'depth' ? settle + turn + sky.age : sky.age;
    const departure = smooth(elapsed / SKY_DEPARTURE);
    drawOrbitShot(ctx, {
        since: elapsed - REVEAL_DURATION,
        travel: revealTravel(elapsed, settle, ORBIT_WATCH.glide),
        p: { x: 0, y: 0, vx: 0, vy: 0, a: 0 },
        speed: revealSpeed(elapsed, settle, ORBIT_WATCH.glide),
        push: 0,
        turn: revealChairOrbit(elapsed, settle),
        clock: elapsed,
        spray: 1 + 1.5 * (1 - departure), arrival: 1 - departure, departure,
        basin: smooth(elapsed / (settle + turn)), entry: 0, ending: FLYING,
    });
}
