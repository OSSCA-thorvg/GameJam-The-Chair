/** The controls the keycap hints teach. Each hint goes as soon as the player tries its key. */
export type HintKey = 'left' | 'right' | 'jump' | 'spray';
export type KeysTried = Readonly<Record<HintKey, boolean>>;

const NONE: KeysTried = { left: false, right: false, jump: false, spray: false };

/**
 * Remembers which hinted keys the player has pressed in the current stage. Presentation only: it is fed by the
 * live controls, never read by the game, and starts over whenever the stage changes.
 */
export function createKeyHints() {
    let tried = NONE;
    let stage: number | null = null;
    return {
        press(key: HintKey) {
            if (!tried[key]) tried = { ...tried, [key]: true };
        },
        observe(next: { stage: number }) {
            if (stage !== null && next.stage !== stage) tried = NONE;
            stage = next.stage;
        },
        snapshot: () => tried,
    };
}
