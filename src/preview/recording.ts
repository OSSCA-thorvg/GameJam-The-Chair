import { FIXED_STEP } from '../game/level';

import type { PreviewScene, PreviewFrame } from './types';
import type { Game, GameSnapshot } from '../game/game';
import type { Input } from '../game/types';
import type { createEffects } from '../render/effects';

export const FRAME_TIME = 1 / 60;

export function recordedScene(
    id: string,
    label: string,
    focusX: number,
    markers: PreviewScene['markers'],
    frames: PreviewFrame[],
): PreviewScene {
    const duration = (frames.length - 1) * FRAME_TIME;
    return {
        id,
        label,
        focusX,
        markers,
        duration,
        sample(time) {
            const index = Math.max(
                0,
                Math.min(frames.length - 1, Math.round(time / FRAME_TIME)),
            );
            return frames[index];
        },
    };
}

export function capture(
    game: Game,
    effects: ReturnType<typeof createEffects>,
    state: GameSnapshot = game.getSnapshot(),
): PreviewFrame {
    return { state, effects: structuredClone(effects.snapshot()) };
}

export function stepGame(
    game: Game,
    effects: ReturnType<typeof createEffects>,
): void {
    for (let i = 0; i < 2; i++) {
        game.step(FIXED_STEP);
        effects.observe(game.getSnapshot());
        for (const event of game.drainEvents()) {
            effects.receive(event);
        }
        effects.advance(FIXED_STEP);
    }
}

export function moveToward(p: { x: number; vx: number }, x: number): Input[] {
    const error = x - (p.x + p.vx * 0.25);
    return error > 12 ? ['right'] : error < -12 ? ['left'] : [];
}
