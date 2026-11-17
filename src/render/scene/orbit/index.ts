import { endingFade, orbitEnding } from './ending';
import { drawOrbitShot } from './shot';
import { STAGE_FIVE } from '../../../game/stages/orbit/data';
import { REVEAL_DURATION } from '../sky/camera';

import type { RenderCtx } from '../../context';

export const ENTRY_FRAMING = 2.5;
const IGNITION = 1.2;

export function drawOrbit(ctx: RenderCtx): void {
    ctx.commands = [];
    const { orbit, player: p } = ctx.state;
    if (!orbit) {
        return;
    }
    const ending = orbitEnding(orbit);
    if (Math.round(ending.dark * 255) >= 255) {
        endingFade(ctx, ending);
        return;
    }
    drawOrbitShot(ctx, {
        since: orbit.age,
        travel: orbit.z,
        p,
        turn: 1,
        speed: orbit.speed,
        push: ctx.state.spray.burst / 0.24,
        clock: REVEAL_DURATION + orbit.age - ending.still,
        spray: ending.parked
            ? 0.2 * (1 - ending.calm)
            : ctx.state.spray.burst / 0.24,
        rocket: Math.min(1, orbit.age / IGNITION),
        arrival: 0,
        departure: 1,
        basin: 1,
        entry: orbit.age / ENTRY_FRAMING,
        aims: orbit.aims,
        hitStop: orbit.freeze / STAGE_FIVE.satelliteLight.freeze,
        ending,
    });
}
