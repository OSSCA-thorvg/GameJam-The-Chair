import type { RenderCtx } from '../context';
import { REVEAL_DURATION } from './sky-camera';
import { orbitEnding } from './orbit-ending';
import { drawOrbitShot } from './orbit-shot';

/** Seconds the chair framing takes to pull back from the reveal's close-up once stage five starts. */
export const ENTRY_FRAMING = 2.5;

export function drawOrbit(ctx: RenderCtx) {
    ctx.commands = [];
    const { orbit, player: p } = ctx.state;
    if (!orbit) return;
    const ending = orbitEnding(orbit);
    drawOrbitShot(ctx, {
        since: orbit.age, travel: orbit.z, p, turn: 1, speed: orbit.speed, push: ctx.state.spray.burst / .24,
        // The rider's clock carries on from the reveal; once the laptop is dark the rider stops moving altogether.
        clock: REVEAL_DURATION + orbit.age - ending.still,
        // Parked, the spray dies away.
        spray: ending.parked ? .2 * (1 - ending.calm) : ctx.state.spray.burst / .24,
        arrival: 0, departure: 1, basin: 1, entry: orbit.age / ENTRY_FRAMING, ending,
    });
}
