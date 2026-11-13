import { STAGE_FOUR } from '../../game/stages/sky/data';
import { STAGE_FIVE } from '../../game/stages/orbit/data';

// The reveal turns the chair camera from the chair's side to its back. Halfway through the turn the chair starts
// gliding forward past the watching cameras, and it reaches stage five's start already at stage five's cruise speed.
export const SKY_TURN = { duration: STAGE_FOUR.reveal.turn, rear: 1, glideFrom: .5 };

/** Seconds the last ledge takes to drift away behind the chair, inside the settle before the turn. */
export const SKY_DEPARTURE = .7 / .3;

/** Seconds from the start of the reveal to the hand-off into stage five. */
export const REVEAL_DURATION = STAGE_FOUR.reveal.settle + STAGE_FOUR.reveal.turn + STAGE_FOUR.reveal.hold;

const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};

/** Chair camera orbit (0 side, 1 behind) at `elapsed` seconds into the reveal. */
export function revealChairOrbit(elapsed: number, settle: number) {
    return smooth((elapsed - settle) / SKY_TURN.duration) * SKY_TURN.rear;
}

/** Seconds into the reveal when the glide begins, partway through the turn. */
export const revealGlideStart = (settle: number) => settle + SKY_TURN.duration * SKY_TURN.glideFrom;

/**
 * Route distance still ahead of stage five's start. The glide eases out of rest and reaches 0 at the hand-off
 * moving at stage five's cruise speed (a cubic Hermite curve), so the flight carries on without a hitch.
 */
export function revealTravel(elapsed: number, settle: number, distance: number) {
    const start = revealGlideStart(settle), span = REVEAL_DURATION - start;
    const u = Math.max(0, Math.min(1, (elapsed - start) / span));
    return -distance + distance * (3 * u * u - 2 * u * u * u) + span * STAGE_FIVE.cruise * (u * u * u - u * u);
}
