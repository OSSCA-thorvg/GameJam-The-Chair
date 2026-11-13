import { STAGE_FOUR } from '../../game/stages/sky/data';

// The reveal turns the chair camera slowly and steadily from the chair's side to its back over the whole
// turn phase. Only then does the chair glide forward past the watching cameras to where stage five starts.
export const SKY_TURN = { duration: STAGE_FOUR.reveal.turn, rear: 1, glide: 4.6 };

/** Seconds the last ledge takes to drift away behind the chair, inside the settle before the turn. */
export const SKY_DEPARTURE = .7 / .3;

const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};

/** Chair camera orbit (0 side, 1 behind) at `elapsed` seconds into the reveal. */
export function revealChairOrbit(elapsed: number, settle: number) {
    return smooth((elapsed - settle) / SKY_TURN.duration) * SKY_TURN.rear;
}

/** Seconds into the reveal when the camera is fully behind the chair and the glide begins. */
export const revealGlideStart = (settle: number) => settle + SKY_TURN.duration;

/** Route distance still ahead of stage five's start: the chair glides forward through the watchers, arriving at 0. */
export function revealTravel(elapsed: number, settle: number, distance: number) {
    return distance * (smooth((elapsed - revealGlideStart(settle)) / SKY_TURN.glide) - 1);
}
