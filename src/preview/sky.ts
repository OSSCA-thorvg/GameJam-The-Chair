import { recordedScene, capture, stepGame } from './recording';
import { parseState, createGame } from '../game/game';
import { STAGE_FOUR } from '../game/stages/sky/data';
import { createEffects } from '../render/effects';
import { ATTENDANCE } from '../render/scene/shared/attendance-bubble';
import {
    revealGlideStart,
    SKY_DEPARTURE,
    SKY_TURN,
} from '../render/scene/sky/camera';

import type { PreviewScene } from './types';

export function cloudEntry(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const effects = createEffects();
    const frames = [capture(game, effects)];
    for (let i = 0; i < 120; i++) {
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    return recordedScene(
        'cloud-entry',
        'Sky · Stage 4 bread clouds',
        2380,
        [
            { at: 0, label: 'Bread on arrival' },
            { at: 1, label: 'Continuous spray' },
        ],
        frames,
    );
}

export function skyGustCycle(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const w = STAGE_FOUR.wind;
    const start = w.calm - 1;
    const duration = 1 + w.warn + w.blow + w.fall + 2;
    return {
        id: 'sky-gust',
        label: 'Sky · Headwind gust, paper bundles, parrots, rocking desks',
        duration,
        focusX: 3900,
        markers: [
            { at: 0, label: 'Steady headwind' },
            { at: 1, label: 'Warning breeze' },
            { at: 1 + w.warn, label: 'Gust' },
            { at: 1 + w.warn + w.blow, label: 'Gust fades' },
            { at: duration - 1, label: 'Parrot knock' },
        ],
        sample(time) {
            const at = Math.max(0, Math.min(duration, time));
            const knock = Math.max(0, at - (duration - 1));
            return {
                state: {
                    ...base,
                    time: start + at,
                    sky: {
                        ...base.sky,
                        phase: 'course',
                        lift: 1,
                        drawer: 1,
                        signTilt:
                            -0.12 -
                            (1 -
                                Math.min(
                                    1,
                                    Math.max(0, (at - 1 - w.warn) * 3),
                                )) *
                                1.12,
                        airSprays: Math.min(3, Math.floor(at / 2)),
                        knock:
                            knock > 0
                                ? STAGE_FOUR.knock.cooldown * (1 - knock)
                                : 0,
                        knockKind: knock > 0 ? 'bird' : null,
                    },
                    player: { ...base.player, x: 3900, y: -2300 },
                    ground: false,
                },
                effects,
            };
        },
    };
}

export function skyOfficeFacade(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    return {
        id: 'sky-facade',
        label: 'Sky · Floating office facade and its workers',
        duration: 6,
        focusX: 3225,
        markers: [{ at: 0, label: 'Office at work' }],
        sample(time) {
            const at = Math.max(0, Math.min(6, time));
            return {
                state: {
                    ...base,
                    time: at,
                    sky: { ...base.sky, phase: 'course', lift: 1 },
                    player: { ...base.player, x: 3110, y: -1918 },
                    ground: true,
                },
                effects,
            };
        },
    };
}

export function skyOfficeGear(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const duration = 6;
    return {
        id: 'sky-gear',
        label: 'Sky · Floating monitor, keyboard, mouse and tower PC',
        duration,
        focusX: 4100,
        markers: [
            { at: 0, label: 'Drifting gear' },
            { at: duration - 1, label: 'Gear knock' },
        ],
        sample(time) {
            const at = Math.max(0, Math.min(duration, time));
            const knock = Math.max(0, at - (duration - 1));
            return {
                state: {
                    ...base,
                    time: at,
                    sky: {
                        ...base.sky,
                        phase: 'course',
                        lift: 1,
                        drawer: 1,
                        knock:
                            knock > 0
                                ? STAGE_FOUR.knock.cooldown * (1 - knock)
                                : 0,
                        knockKind: knock > 0 ? 'gear' : null,
                    },
                    player: { ...base.player, x: 3960 - knock * 60, y: -2220 },
                    ground: false,
                },
                effects,
            };
        },
    };
}

export function skyWindFeedback(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const w = STAGE_FOUR.wind;
    const gustAt = w.calm + w.warn;
    return {
        id: 'sky-wind-feedback',
        label: 'Sky · Open-air wind response (spray held)',
        duration: w.period,
        focusX: 3900,
        markers: [
            { at: 0, label: 'Calm' },
            { at: w.calm + w.warn * 0.65, label: 'Chair warns' },
            { at: gustAt + w.rise * 0.6, label: 'Gust onset' },
            { at: gustAt + 0.8, label: 'Smoke bends left' },
            { at: gustAt + w.blow + w.fall + 0.1, label: 'Calm returns' },
        ],
        sample(time) {
            const at = Math.max(0, Math.min(w.period, time));
            return {
                state: {
                    ...base,
                    time: at,
                    ground: false,
                    hasExtinguisher: true,
                    lessons: { ...base.lessons, moved: true },
                    player: {
                        ...base.player,
                        x: 3900,
                        y: -3000,
                        a: 0,
                        vx: 0,
                        vy: 0,
                    },
                    sky: { ...base.sky, phase: 'course', airSprays: 1 },
                    spray: { ...base.spray, burst: 0.24, dir: { x: 0, y: 1 } },
                },
                effects,
            };
        },
    };
}

export function skyParrots(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const period = 8.2;
    const passes = 10;
    const duration = period * passes;
    return {
        id: 'sky-parrots',
        label: 'Sky · Parrot colours (one bird per pass)',
        duration,
        focusX: 4150,
        markers: Array.from({ length: passes }, (_, i) => ({
            at: i * period + 3.6,
            label: `Pass ${i + 1}`,
        })),
        sample(time) {
            const at = Math.max(0, Math.min(duration, time));
            return {
                state: {
                    ...base,
                    time: at,
                    sky: { ...base.sky, phase: 'course', lift: 1, drawer: 1 },
                    player: { ...base.player, x: 3980, y: -2330 },
                    ground: false,
                },
                effects,
            };
        },
    };
}

export function skyRobotParrot(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const period = 8.2;
    const start = period * 19;
    const duration = period * 2;
    const hit = 5.3;
    return {
        id: 'sky-robot-parrot',
        label: 'Sky · Robot parrots (liquid metal, black chrome) and gear knock',
        duration,
        focusX: 4150,
        markers: [
            { at: 0, label: 'Liquid metal' },
            { at: hit, label: 'Gear knock' },
            { at: period, label: 'Black chrome' },
            { at: period + hit, label: 'Gear knock' },
        ],
        sample(time) {
            const at = Math.max(0, Math.min(duration, time));
            const knock = (at % period) - hit;
            const knocking = knock > 0 && knock < 1;
            return {
                state: {
                    ...base,
                    time: start + at,
                    sky: {
                        ...base.sky,
                        phase: 'course',
                        lift: 1,
                        drawer: 1,
                        knock: knocking
                            ? STAGE_FOUR.knock.cooldown * (1 - knock)
                            : 0,
                        knockKind: knocking ? 'gear' : null,
                    },
                    player: { ...base.player, x: 3980, y: -2240 },
                    ground: false,
                },
                effects,
            };
        },
    };
}

export function skySignDepth(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const duration = 8;
    return {
        id: 'sky-sign-depth',
        label: 'Sky · Chair and parrot pass in front of the billboard copy',
        duration,
        focusX: 4770,
        markers: [
            { at: 7.3, label: 'Parrot reaches sign' },
            { at: 7.9, label: 'Parrot over copy' },
        ],
        sample(time) {
            const at = Math.max(0, Math.min(duration, time));
            return {
                state: {
                    ...base,
                    time: at,
                    sky: { ...base.sky, phase: 'course', lift: 1, drawer: 1 },
                    player: {
                        ...base.player,
                        x: 4790 - Math.sin(at * 0.8) * 50,
                        y: -2195,
                    },
                    ground: false,
                },
                effects,
            };
        },
    };
}

export function skyPromotionCake(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    return {
        id: 'sky-promotion-cake',
        label: 'Sky · Promotion shortcake on the final desk',
        duration: 5,
        focusX: 5210,
        markers: [
            { at: 0, label: 'Cake visible on approach' },
            { at: 2.5, label: 'Flag in the wind' },
        ],
        sample(time) {
            const at = Math.max(0, Math.min(5, time));
            return {
                state: {
                    ...base,
                    time: at,
                    sky: { ...base.sky, phase: 'course', lift: 1, drawer: 1 },
                    player: { ...base.player, x: 4840, y: -2260 },
                    ground: false,
                },
                effects,
            };
        },
    };
}

export function skyEnding(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const { settle, turn, hold } = STAGE_FOUR.reveal;
    const duration = settle + turn + hold;
    return {
        id: 'sky-ending',
        label: 'Sky · Slow turn among cameras, glide into stage 5 at cruise speed',
        duration,
        focusX: STAGE_FOUR.goal,
        markers: [
            { at: 0, label: 'Leaving the ledge' },
            { at: SKY_DEPARTURE, label: 'Quiet side view' },
            {
                at: settle + SKY_TURN.duration * 0.25,
                label: 'Cameras turning up',
            },
            { at: settle + SKY_TURN.duration / 2, label: 'Three-quarter view' },
            {
                at: revealGlideStart(settle),
                label: 'All cameras watching · glide starts',
            },
            {
                at: settle + SKY_TURN.duration,
                label: 'Rear view · gliding past the cameras',
            },
            { at: duration - ATTENDANCE.lead, label: 'Attendance confirmed' },
            { at: duration, label: 'Stage 5 hand-off' },
        ],
        sample(time) {
            const at = Math.max(0, Math.min(duration, time));
            const depth = at >= settle + turn;
            return {
                state: {
                    ...base,
                    time: at,
                    sky: {
                        ...base.sky,
                        phase: depth ? 'depth' : 'reveal',
                        age: depth ? at - settle - turn : at,
                    },
                    player: { ...base.player, x: 5045, y: -2338 },
                    ground: false,
                },
                effects,
            };
        },
    };
}

export function skyToOrbit(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const start = parseState(game.serialize());
    Object.assign(start.sky, { phase: 'reveal', age: 0 });
    Object.assign(start.p, { x: 5045, y: -2338, vx: 0, vy: 0 });
    start.ground = false;
    game.restore(JSON.stringify(start));
    const effects = createEffects();
    const frames = [capture(game, effects)];
    const markers = [
        { at: 0, label: 'Leaving the ledge' },
        {
            at: revealGlideStart(STAGE_FOUR.reveal.settle),
            label: 'Glide starts',
        },
    ];
    for (let i = 0; i < 60 * 30; i++) {
        const state = game.getSnapshot();
        if (
            state.stage === 5 &&
            !markers.some((marker) => marker.label === 'Stage 5')
        ) {
            markers.push({ at: i / 60, label: 'Stage 5' });
        }
        const age = state.stage === 5 && state.orbit ? state.orbit.age : -1;
        game.setInput(
            ...(age < 0
                ? []
                : age < 1.6
                  ? ['right' as const]
                  : age < 3.2
                    ? ['left' as const, 'forward' as const]
                    : []),
        );
        stepGame(game, effects);
        frames.push(capture(game, effects));
        if (age > 7.5) {
            break;
        }
    }
    return recordedScene(
        'sky-to-orbit',
        'Sky → Orbit · Hand-off, steering fade-in, flying on by itself',
        0,
        markers,
        frames,
    );
}
