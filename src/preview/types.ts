import { type GameSnapshot } from '../game/game';
import { type EffectsState } from '../render/effects';
import { type Locale } from '../i18n';
import type { SceneTalk } from '../render/types';
import { type OpeningFrame } from '../render/scene/opening/timeline';

export type PreviewScene = {
    id: string;
    label: string;
    duration: number;
    focusX: number;
    // Follow the chair with the camera (centred) instead of holding it at `focusX`.
    follow?: boolean;
    markers: readonly { at: number; label: string }[];
    sample(time: number): { state: GameSnapshot; effects: EffectsState };
    // Cutscene frames draw with their own camera and overlays instead of the stage scene.
    opening?(time: number): OpeningFrame;
    // Spoken lines shown over the scene at this time.
    talk?(time: number, locale: Locale): SceneTalk;
    // The title screen draws its own looping scene at this time.
    title?: boolean;
};

export type PreviewFrame = { state: GameSnapshot; effects: EffectsState };
