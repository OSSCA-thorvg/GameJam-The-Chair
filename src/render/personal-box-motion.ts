import type { Point } from '../game/types';

const BOX_SCALE = .68;
const BOX_X = 1254;
export const PERSONAL_BOX = {
    x: BOX_X, y: 396 - 56 * BOX_SCALE, scale: BOX_SCALE,
    plantX: BOX_X + 95 * BOX_SCALE,
    left: BOX_X - 16 * BOX_SCALE, right: BOX_X + 140 * BOX_SCALE,
    chairRadius: 110, farewellDelay: .2,
};
export type PersonalBoxReaction = { kind: 'idle' }
    | { kind: 'approaching'; side: -1 | 1 }
    | { kind: 'farewell'; side: -1 | 1; passed: number };
export type PersonalBoxInput = { stage: number; deaths: number; time: number; player: Readonly<Point> };

function advance(reaction: PersonalBoxReaction, input: PersonalBoxInput): PersonalBoxReaction {
    const dx = input.player.x - PERSONAL_BOX.plantX;
    const dy = Math.abs(input.player.y - PERSONAL_BOX.y);
    if (reaction.kind === 'idle') {
        if (Math.abs(dx) < 190 && dy < 130) return { kind: 'approaching', side: dx > 0 ? 1 : -1 };
    } else if (reaction.kind === 'approaching' && dy < 150) {
        // A radius enclosing the rider, chair and laptop also covers a tilted chair.
        const cleared = reaction.side < 0
            ? input.player.x - PERSONAL_BOX.chairRadius > PERSONAL_BOX.right
            : input.player.x + PERSONAL_BOX.chairRadius < PERSONAL_BOX.left;
        if (cleared) return { ...reaction, kind: 'farewell', passed: input.time };
    }
    return reaction;
}

// Observes fixed-step presentation inputs only; it never writes back into the game.
export function createPersonalBoxObserver() {
    let reaction: PersonalBoxReaction = { kind: 'idle' };
    let previous: PersonalBoxInput | null = null;
    return {
        observe(input: PersonalBoxInput) {
            if (previous && (input.stage !== previous.stage || input.deaths !== previous.deaths || input.time < previous.time)) reaction = { kind: 'idle' };
            if (input.stage === 3) reaction = advance(reaction, input);
            previous = input;
        },
        snapshot: () => reaction,
        restore(next: PersonalBoxReaction) {
            reaction = next;
            previous = null;
        },
    };
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function personalBoxPose(reaction: PersonalBoxReaction, time: number) {
    const elapsed = reaction.kind === 'farewell' ? time - reaction.passed - PERSONAL_BOX.farewellDelay : -1;
    if (reaction.kind !== 'farewell' || elapsed <= 0) return { bend: 0, leaf: 0, badgeTurn: 0, badgeSwing: 0 };
    const bow = clamp(elapsed / 1.4);
    const bend = bow === 1 ? 0 : -(Math.sin(bow * Math.PI) ** 2) * .55 * reaction.side;
    const flip = clamp(elapsed / .9);
    const badgeTurn = flip * flip * (3 - 2 * flip) * Math.PI;
    const badgeSwing = elapsed >= 2 ? 0 : Math.sin(elapsed * 10) * Math.exp(-elapsed * 2) * .18 * reaction.side;
    return { bend, leaf: 0, badgeTurn, badgeSwing };
}
