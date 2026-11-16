import { createGame } from '../game/game';
import { FIXED_STEP } from '../game/level';
import { translate } from '../i18n';
import { FRAME_TIME } from './recording';
import { createEffects } from '../render/effects';
import {
    OPENING_BEATS,
    OPENING_DURATION,
    openingFrame,
    openingState,
} from '../render/scene/opening/timeline';
import { REACTION_LIFE, SPEECH_LIFE } from '../ui/types';

import type { PreviewScene } from './types';
import type { GameSnapshot } from '../game/game';

export function sceneTalk(): PreviewScene {
    const game = createGame();
    game.reset();
    const effects = createEffects().snapshot();
    const frames: GameSnapshot[] = [];
    for (let frame = 0; frame * FRAME_TIME <= 4.2; frame++) {
        frames.push(game.getSnapshot());
        for (let i = 0; i < 2; i++) {
            game.step(FIXED_STEP);
        }
        game.drainEvents();
    }
    const REACT = 0.6;
    const SPEAK = 1.4;
    const managerX =
        frames[0].people.find((person) => person.id === 'manager')?.x ?? 320;
    return {
        id: 'scene-talk',
        label: 'Office · Stage title, rider reaction and colleague remark',
        duration: 4.2,
        focusX: 420,
        markers: [
            { at: 0, label: 'Title drops' },
            { at: REACT, label: 'Rider reacts' },
            { at: SPEAK, label: 'Manager speaks' },
            { at: 2.2, label: 'Title gone' },
        ],
        sample(time) {
            return {
                state: frames[
                    Math.max(
                        0,
                        Math.min(
                            frames.length - 1,
                            Math.round(time / FRAME_TIME),
                        ),
                    )
                ],
                effects,
            };
        },
        talk(time, locale) {
            const reactionLife = REACTION_LIFE - (time - REACT);
            const speechLife = SPEECH_LIFE - (time - SPEAK);
            return {
                reaction:
                    time >= REACT && reactionLife > 0
                        ? {
                              text: translate('player.paperHit', locale),
                              life: reactionLife,
                          }
                        : null,
                speech:
                    time >= SPEAK && speechLife > 0
                        ? {
                              name: translate('person.manager', locale),
                              text: translate('npc.manager.leave', locale),
                              x: managerX,
                              life: speechLife,
                          }
                        : null,
            };
        },
    };
}

export function opening(): PreviewScene {
    const game = createGame();
    game.reset();
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const B = OPENING_BEATS;
    return {
        id: 'opening',
        label: 'Intro · Opening: overtime until 9 pm',
        duration: OPENING_DURATION,
        focusX: base.player.x,
        markers: [
            { at: B.sixPm, label: '6 pm' },
            { at: B.irisOpen, label: 'Into the office' },
            { at: B.riderOvertime, label: 'Worker: overtime' },
            { at: B.riderSales, label: 'Worker: sales' },
            { at: B.pushIn, label: 'Push in' },
            { at: B.chairHope, label: 'Chair hopes' },
            { at: B.irisClose, label: 'Back to clock' },
            { at: B.creak, label: '7 pm: creaking' },
            { at: B.spinToEight, label: '7 → 8 pm' },
            { at: B.kick, label: '8 pm: backrest kick' },
            { at: B.spinToNine, label: '8 → 9 pm' },
            { at: B.darkChair, label: 'Dark chair' },
            { at: B.rage, label: 'Rage' },
            { at: B.handoff, label: 'Handoff' },
        ],
        sample: (time) => ({
            state: openingState(base, openingFrame(time)),
            effects,
        }),
        opening: openingFrame,
    };
}

export function titleScreen(): PreviewScene {
    const game = createGame();
    game.reset();
    const state = game.getSnapshot();
    const effects = createEffects().snapshot();
    return {
        id: 'title-screen',
        label: 'Intro · Title screen: dash for the exit',
        duration: 4,
        focusX: state.player.x,
        title: true,
        markers: [
            { at: 0, label: 'Loop' },
            { at: 2, label: 'Sign glow' },
        ],
        sample: () => ({ state, effects }),
    };
}
