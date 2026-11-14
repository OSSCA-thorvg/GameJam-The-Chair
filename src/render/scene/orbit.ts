import type { RenderCtx } from '../context';
import { REVEAL_DURATION } from './sky-camera';
import { endingFade, orbitEnding } from './orbit-ending';
import { drawOrbitShot } from './orbit-shot';

/** Seconds the chair framing takes to pull back from the reveal's close-up once stage five starts. */
export const ENTRY_FRAMING = 2.5;
/** Seconds the extinguisher takes to ignite from the reveal's soft puffs into a full rocket plume. */
const IGNITION = 1.2;

export function drawOrbit(ctx: RenderCtx) {
    ctx.commands = [];
    const { orbit, player: p } = ctx.state;
    if (!orbit) return;
    const ending = orbitEnding(orbit);
    // Once the black card rounds to full alpha it hides everything under it.
    if (Math.round(ending.dark * 255) >= 255) {
        endingFade(ctx, ending);
        return;
    }
    drawOrbitShot(ctx, {
        since: orbit.age, travel: orbit.z, p, turn: 1, speed: orbit.speed, push: ctx.state.spray.burst / .24,
        // The rider's clock carries on from the reveal; once the laptop is dark the rider stops moving altogether.
        clock: REVEAL_DURATION + orbit.age - ending.still,
        // Parked, the spray dies away.
        spray: ending.parked ? .2 * (1 - ending.calm) : ctx.state.spray.burst / .24, rocket: Math.min(1, orbit.age / IGNITION),
        arrival: 0, departure: 1, basin: 1, entry: orbit.age / ENTRY_FRAMING, idle: orbit.idle, ending,
    });
}
