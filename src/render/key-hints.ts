export type HintKey = 'left' | 'right' | 'jump' | 'spray';
export type KeysTried = Readonly<Record<HintKey, boolean>>;

const NONE: KeysTried = { left: false, right: false, jump: false, spray: false };

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
