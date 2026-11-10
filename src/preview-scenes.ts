import { createGame, type Game, type GameState } from './game/game';
import { LEVEL, FIXED_STEP } from './game/level';
import { STAGE_TWO } from './game/stage2';
import { ductTimings } from './game/stage3';
import { createEffects, type EffectsState } from './render/effects';
import { CLEANER_RECOVERY_END, CLEANER_RECOVERY_START } from './render/scene/cleaning';
import { monitorPhase } from './game/systems/monitor';
import { SPLASH_DURATION } from './ui/splash-meta';

export type PreviewScene = {
    id: string;
    label: string;
    duration: number;
    focusX: number;
    markers: readonly { at: number; label: string }[];
    sample(time: number): { state: GameState; effects: EffectsState };
};

type PreviewFrame = { state: GameState; effects: EffectsState };
const FRAME_TIME = 1 / 60;

function recordedScene(id: string, label: string, focusX: number, markers: PreviewScene['markers'], frames: PreviewFrame[]): PreviewScene {
    const duration = (frames.length - 1) * FRAME_TIME;
    return {
        id, label, focusX, markers, duration,
        sample(time) {
            const index = Math.max(0, Math.min(frames.length - 1, Math.round(time / FRAME_TIME)));
            return frames[index];
        },
    };
}

function capture(game: Game, effects: ReturnType<typeof createEffects>, state: GameState = game.getSnapshot()): PreviewFrame {
    return { state, effects: structuredClone(effects.snapshot()) };
}

function stepGame(game: Game, effects: ReturnType<typeof createEffects>) {
    for (let i = 0; i < 2; i++) {
        game.step(FIXED_STEP);
        for (const event of game.drainEvents()) effects.receive(event);
    }
}

function cleanerRecovery(): PreviewScene {
    const game = createGame();
    game.reset();
    const base = game.getSnapshot();
    const effect = createEffects();
    effect.receive({ type: 'water-splash', x: base.cleaning.x, side: -1 });
    const frames = [structuredClone(effect.snapshot())];
    for (let frame = 1; frame <= Math.ceil(CLEANER_RECOVERY_END / FRAME_TIME); frame++) {
        effect.receive({ type: 'water-step', dt: FRAME_TIME });
        frames.push(structuredClone(effect.snapshot()));
    }

    return {
        id: 'cleaner-recovery',
        label: 'Cleaner · Bucket recovery',
        duration: CLEANER_RECOVERY_END,
        focusX: (base.cleaning.x + base.people.find(person => person.id === 'cleaner')!.x) / 2,
        markers: [
            { at: 0, label: 'Spill' },
            { at: CLEANER_RECOVERY_START, label: 'Turn' },
            { at: 1.93, label: 'Mop falls' },
            { at: 2.4, label: 'Pick up bucket' },
            { at: 2.9, label: 'Lift bucket' },
            { at: 3.03, label: 'Walk back' },
            { at: 3.9, label: 'Pick up mop' },
        ],
        sample(time) {
            const at = Math.max(0, Math.min(CLEANER_RECOVERY_END, time));
            return {
                state: {
                    ...base,
                    mode: 'play',
                    time: at,
                    bucketAge: at,
                    cleaning: { ...base.cleaning, spilled: true, age: at, splashDir: -1 },
                    player: { ...base.player, x: base.cleaning.x - 155, y: LEVEL.floor - 28, vx: 0, vy: 0 },
                    ground: true,
                },
                effects: frames[Math.min(frames.length - 1, Math.round(at / FRAME_TIME))],
            };
        },
    };
}

function monitorLight(): PreviewScene {
    const game = createGame();
    game.reset();
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const monitor = LEVEL.monitors[0];
    return {
        id: 'monitor-light',
        label: 'Monitor · Light beam',
        duration: monitor.period,
        focusX: monitor.wall,
        markers: [
            { at: 0, label: 'Warning' },
            { at: .9, label: 'Beam on' },
            { at: 2.1, label: 'Beam off' },
        ],
        sample(time) {
            const at = Math.max(0, Math.min(monitor.period, time));
            return {
                state: {
                    ...base,
                    mode: 'play',
                    time: at,
                    player: { ...base.player, x: monitor.wall - 125 },
                    monitors: base.monitors.map(spec => ({ ...spec, ...monitorPhase(spec, at) })),
                },
                effects,
            };
        },
    };
}

function copierVolley(): PreviewScene {
    const game = createGame();
    game.reset();
    game.drainEvents();
    game.setInput('right');
    for (let i = 0; i < 120 * 5 && game.getSnapshot().copier.burst === 0; i++) {
        game.step(FIXED_STEP);
        game.drainEvents();
    }
    if (game.getSnapshot().copier.burst === 0) throw new Error('Copier preview could not reach its first volley.');
    game.setInput();
    const effects = createEffects();
    const frames = [capture(game, effects)];
    for (let i = 0; i < 150; i++) {
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    return recordedScene('copier-volley', 'Copier · Paper volley', game.getSnapshot().copier.x,
        [{ at: 0, label: 'Ready' }, { at: .75, label: 'First shot' }, { at: .95, label: 'Second shot' }, { at: 1.15, label: 'Third shot' }, { at: 2.25, label: 'Fires again' }], frames);
}

function headImpact(): PreviewScene {
    const game = createGame();
    game.startStage(2);
    game.drainEvents();
    game.setInput('right');
    for (let i = 0; i < 120 * 8 && game.getSnapshot().checkpoint < 1; i++) {
        game.step(FIXED_STEP);
        game.drainEvents();
    }
    if (game.getSnapshot().checkpoint < 1) throw new Error('Impact preview could not reach the first checkpoint.');
    game.setInput('e');
    game.jump();
    for (let i = 0; i < 120 * 10 && game.getSnapshot().mode === 'play'; i++) {
        game.step(FIXED_STEP);
        game.drainEvents();
    }
    if (game.getSnapshot().mode !== 'impact') throw new Error('Impact preview could not trigger a head collision.');
    const focusX = game.getSnapshot().player.x;
    const effects = createEffects();
    const frames = [capture(game, effects)];
    for (let i = 0; i < 108; i++) {
        if (game.getSnapshot().mode === 'impact') game.advanceImpact(FRAME_TIME);
        frames.push(capture(game, effects));
    }
    return recordedScene('head-impact', 'Chair · Head impact replay', focusX,
        [{ at: 0, label: 'Impact' }, { at: .5, label: 'Rewind' }, { at: 1.4, label: 'Collision' }, { at: 1.8, label: 'End' }], frames);
}

function rooftopEntrance(): PreviewScene {
    const game = createGame();
    game.startStage(3);
    const effects = createEffects();
    const frames = [capture(game, effects)];
    for (let i = 0; i < 168; i++) {
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    return recordedScene('rooftop-entrance', 'Rooftop · Hinged entrance', 400,
        [{ at: 0, label: 'Closed' }, { at: .4, label: 'Door opens' }, { at: 1.1, label: 'Chair emerges' }, { at: 1.8, label: 'At the block' }, { at: 2.6, label: 'Door closed · Controls ready' }], frames);
}

function extinguisherSpray(): PreviewScene {
    const game = createGame();
    game.startStage(3);
    // Reach the pickup through the real course before recording recoil.
    for (let i = 0; i < 1440 && !game.getSnapshot().hasExtinguisher; i++) {
        const state = game.getSnapshot();
        game.setInput('right');
        if (state.ground && ((state.player.x > 205 && state.player.x < 330) || (state.player.x > 370 && state.player.x < 450))) game.jump();
        game.step(FIXED_STEP);
    }
    if (!game.getSnapshot().hasExtinguisher) throw new Error('Spray preview could not reach the extinguisher.');
    game.drainEvents();
    game.setInput('right');
    game.spray();
    game.setInput();
    const effects = createEffects();
    for (const event of game.drainEvents()) effects.receive(event);
    const frame = () => capture(game, effects);
    const frames = [frame()];
    for (let i = 0; i < 54; i++) {
        stepGame(game, effects);
        frames.push(frame());
    }
    return recordedScene('extinguisher-spray', 'Chair · Extinguisher recoil', 700,
        [{ at: 0, label: 'Spray' }, { at: .16, label: 'Recoil' }, { at: .24, label: 'Plume ends' }, { at: .6, label: 'Landing' }], frames);
}

function cloudEntry(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const effects = createEffects();
    const frames = [capture(game, effects)];
    for (let i = 0; i < 120; i++) {
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    return recordedScene('cloud-entry', 'Sky · Stage 4 hovering start', 2380,
        [{ at: 0, label: 'Arrival' }, { at: 1, label: 'Continuous spray · Hovering' }], frames);
}

function ductSneeze(repeat = false): PreviewScene {
    const game = createGame();
    game.startStage(3);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const kind = repeat ? 'repeat' : 'first';
    const timing = ductTimings(kind);
    return {
        id: repeat ? 'duct-repeat' : 'duct-sneeze', label: repeat ? 'Rooftop · Gentle repeat wind' : 'Rooftop · First sneeze & gloves', duration: 2.2, focusX: 1510,
        markers: [{ at: .05, label: 'Inhale' }, { at: timing.inhale + .02, label: 'Twitch' },
            { at: timing.inhale + timing.twitch + .18, label: 'Sneeze' }, { at: repeat ? .8 : 2.1, label: repeat ? 'Wind fades' : 'Gloves settle' }],
        sample(time) {
            const at = Math.max(0, Math.min(2.2, time));
            const drift = Math.min(1, Math.max(0, at - timing.inhale - timing.twitch));
            return { state: { ...base, time: at, hasExtinguisher: true, checkpoint: 2,
                rooftopEntrance: { kind: 'ready' }, ductReaction: { kind: 'reacting', age: repeat ? 10 + at : at, shots: repeat ? 2 : 1, bursts: [{ kind, age: at }] },
                spray: { ...base.spray, burst: at < timing.inhale ? .24 * (1 - at / timing.inhale) : 0, dir: { x: Math.SQRT1_2, y: Math.SQRT1_2 } },
                player: { ...base.player, x: 1580 - drift * (repeat ? 65 : 145), y: 160 - Math.sin(drift * Math.PI) * 45, a: -.05 }, ground: false,
            }, effects };
        },
    };
}

function officeTyping(): PreviewScene {
    const game = createGame();
    game.startStage(2);
    const base = game.getSnapshot();
    const state = { ...base, player: { ...base.player, x: STAGE_TWO.length } };
    const effects = createEffects().snapshot();
    return {
        id: 'office-typing',
        label: 'Office · Window typing',
        duration: 1,
        focusX: STAGE_TWO.offices[1],
        markers: [{ at: 0, label: 'Ready' }, { at: .25, label: 'Hand raised' }, { at: .5, label: 'Key press' }],
        sample(time) {
            return { state: { ...state, time: Math.max(0, Math.min(1, time)) }, effects };
        },
    };
}

export const previewScenes: readonly PreviewScene[] = [
    {
        id: 'startup-splash', label: 'Intro · ThorVG splash', duration: SPLASH_DURATION,
        focusX: 400,
        markers: [{ at: 0, label: 'Opening' }, { at: 3.5, label: 'Middle' }, { at: 6.9, label: 'End' }],
        sample: () => ({ state: createGame().getSnapshot(), effects: createEffects().snapshot() }),
    },
    cleanerRecovery(), monitorLight(), copierVolley(), headImpact(), rooftopEntrance(), extinguisherSpray(), ductSneeze(), ductSneeze(true), cloudEntry(), officeTyping(),
];
