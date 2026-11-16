import { STAGE_FOUR } from '../../game/stages/sky/data';
import { STAGE_FIVE } from '../../game/stages/orbit/data';

export const SKY_TURN = {
    duration: STAGE_FOUR.reveal.turn,
    rear: 1,
    glideFrom: 0.8,
};

export const SKY_DEPARTURE = 0.7 / 0.3;

export const REVEAL_DURATION =
    STAGE_FOUR.reveal.settle + STAGE_FOUR.reveal.turn + STAGE_FOUR.reveal.hold;

const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};

export function revealChairOrbit(elapsed: number, settle: number) {
    return smooth((elapsed - settle) / SKY_TURN.duration) * SKY_TURN.rear;
}

export const revealGlideStart = (settle: number) =>
    settle + SKY_TURN.duration * SKY_TURN.glideFrom;

export function revealTravel(
    elapsed: number,
    settle: number,
    distance: number,
) {
    const start = revealGlideStart(settle),
        span = REVEAL_DURATION - start;
    const u = Math.max(0, Math.min(1, (elapsed - start) / span));
    return (
        -distance +
        distance * (3 * u * u - 2 * u * u * u) +
        span * STAGE_FIVE.cruise * (u * u * u - u * u)
    );
}

export function revealSpeed(elapsed: number, settle: number, distance: number) {
    const start = revealGlideStart(settle),
        span = REVEAL_DURATION - start;
    const u = (elapsed - start) / span;
    if (u <= 0 || u > 1) return u > 1 ? STAGE_FIVE.cruise : 0;
    return (
        (distance * (6 * u - 6 * u * u) +
            span * STAGE_FIVE.cruise * (3 * u * u - 2 * u)) /
        span
    );
}
