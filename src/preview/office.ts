import { createGame, type GameSnapshot } from '../game/game';
import { LEVEL, FIXED_STEP } from '../game/level';
import { deathShotLength } from '../render/death-shot';
import { FOCUS_LOSS_DURATION } from '../game/systems/focus/decide';
import { createEffects } from '../render/effects';
import { CLEANER_RECOVERY_END, CLEANER_RECOVERY_START } from '../render/scene/cleaning';
import { monitorPhase } from '../game/stages/office/monitor/decide';
import { type PreviewScene, type PreviewFrame } from './types';
import { FRAME_TIME, recordedScene, capture, stepGame } from './recording';

export function cleanerRecovery(): PreviewScene {
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

export function bucketPour(): PreviewScene {
    const game = createGame();
    game.reset();
    const base = game.getSnapshot();
    const duration = 2.6;
    const effect = createEffects();
    effect.receive({ type: 'water-splash', x: base.cleaning.x, side: 1 });
    const frames = [structuredClone(effect.snapshot())];
    for (let frame = 1; frame <= Math.ceil(duration / FRAME_TIME); frame++) {
        effect.receive({ type: 'water-step', dt: FRAME_TIME });
        frames.push(structuredClone(effect.snapshot()));
    }
    return {
        id: 'bucket-pour',
        label: 'Bucket · Water pour',
        duration,
        focusX: base.cleaning.x + 110,
        markers: [
            { at: .12, label: 'Rim bulges' },
            { at: .26, label: 'Gush' },
            { at: .5, label: 'Glugs' },
            { at: 1.2, label: 'Dribble' },
            { at: 2.2, label: 'Puddle' },
        ],
        sample(time) {
            const at = Math.max(0, Math.min(duration, time));
            return {
                state: {
                    ...base,
                    mode: 'play',
                    time: at,
                    bucketAge: at,
                    cleaning: { ...base.cleaning, spilled: true, age: at, splashDir: 1 },
                    player: { ...base.player, x: base.cleaning.x + 205, y: LEVEL.floor - 28, vx: 0, vy: 0 },
                    ground: true,
                },
                effects: frames[Math.min(frames.length - 1, Math.round(at / FRAME_TIME))],
            };
        },
    };
}

export function monitorLight(): PreviewScene {
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

export function copierVolley(): PreviewScene {
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

export function headImpact(): PreviewScene {
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
    effects.observe(game.getSnapshot());
    const frames = [capture(game, effects)];
    for (let i = 0; i < Math.ceil(deathShotLength('head') / FRAME_TIME) + 12; i++) {
        if (game.getSnapshot().mode === 'impact') game.advanceImpact(FRAME_TIME);
        effects.observe(game.getSnapshot());
        effects.advance(FRAME_TIME);
        frames.push(capture(game, effects));
    }
    return recordedScene('head-impact', 'Chair · Head impact replay', focusX,
        [{ at: 0, label: 'Impact' }, { at: .5, label: 'Rewind' }, { at: 1.4, label: 'Collision: BONK, close-up' }, { at: 2.25, label: 'Easing back' }, { at: deathShotLength('head'), label: 'Panel' }], frames);
}

export function personalBelongings(): PreviewScene {
    const game = createGame();
    game.startStage(3);
    const base = game.getSnapshot();
    const effects = createEffects();
    const frames: PreviewFrame[] = [];
    for (let tick = 0; tick <= 960; tick++) {
        const time = tick * FIXED_STEP;
        const x = time < 1 ? 1000 : time < 3 ? 1000 + (time - 1) * 265
            : time < 4 ? 1530 + (time - 3) * 170 : time < 5 ? 1700 : 1700 - Math.min(1, (time - 5) / 2) * 700;
        const state: GameSnapshot = { ...base, time, hasExtinguisher: true, rooftopEntrance: { kind: 'ready' },
            player: { ...base.player, x, y: 368 },
        };
        effects.observe(state);
        if (tick % 2 === 0) frames.push(capture(game, effects, state));
    }
    return recordedScene('personal-belongings', 'Rooftop · Plant bow & badge farewell', 1350,
        [{ at: 0, label: 'Blue glasses · Badge front' }, { at: 2.7, label: 'Chair still overlaps' },
            { at: 2.85, label: 'Chair clear · Wait 0.2 seconds' }, { at: 3.6, label: 'Farewell bow & flip' },
            { at: 4, label: 'Blank badge back' }, { at: 5, label: 'Still' },
            { at: 6.5, label: 'Return · No second farewell' }], frames);
}

export function focusLoss(): PreviewScene {
    const game = createGame();
    game.reset();
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const duration = deathShotLength('focus');
    const focusX = 500;
    return {
        id: 'focus-loss',
        label: 'Chair · Focus loss',
        duration,
        focusX,
        markers: [{ at: 0, label: 'Focus depleted' }, { at: .8, label: 'Glance' }, { at: FOCUS_LOSS_DURATION, label: 'Game over' }, { at: duration, label: 'Panel' }],
        sample(time) {
            const at = Math.max(0, Math.min(duration, time));
            return {
                state: {
                    ...base,
                    mode: at < FOCUS_LOSS_DURATION ? 'focuslost' : 'dead',
                    lossReason: 'focus',
                    focus: 0,
                    focusLossTime: at,
                    time: at,
                    player: { ...base.player, x: focusX },
                },
                effects: { ...effects, deathShot: { kind: 'focus', age: at, done: at >= duration } },
            };
        },
    };
}

export function focusTension(): PreviewScene {
    const game = createGame();
    game.reset();
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const duration = 12;
    const focusX = 500;
    const focusAt = (at: number) => Math.max(1, Math.round(100 - at / duration * 105));
    return {
        id: 'focus-tension',
        label: 'Chair · Focus tension',
        duration,
        focusX,
        markers: [{ at: 0, label: '100%' }, { at: 4.6, label: '60% · Drift' }, { at: 6.9, label: '40% · Sweat' }, { at: 9.2, label: '20% · Head up' }],
        sample(time) {
            const at = Math.max(0, Math.min(duration, time));
            return {
                state: { ...base, mode: 'play', focus: focusAt(at), time: at, player: { ...base.player, x: focusX } },
                effects,
            };
        },
    };
}

export function focusHitVignette(): PreviewScene {
    const game = createGame();
    game.reset();
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const levels = [80, 55, 35, 15];
    const hit = 2;
    const focusX = 500;
    return {
        id: 'focus-hit-vignette',
        label: 'Chair · Focus hit vignette',
        duration: levels.length * hit,
        focusX,
        markers: levels.map((focus, i) => ({ at: i * hit, label: `Hit at ${focus}%` })),
        sample(time) {
            const at = Math.max(0, Math.min(levels.length * hit - 1e-6, time));
            const index = Math.floor(at / hit);
            const life = 1.7 - (at - index * hit);
            return {
                state: {
                    ...base, mode: 'play', focus: levels[index], time: at,
                    focusNotice: life > 0 ? { kind: 'paper', life } : null,
                    player: { ...base.player, x: focusX },
                },
                effects,
            };
        },
    };
}

export function extinguisherSpray(): PreviewScene {
    const game = createGame();
    game.startStage(3);
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

export function urgentCopier(volley: number, id: string, label: string): PreviewScene {
    const game = createGame();
    game.startStage(1);
    const saved = JSON.parse(game.serialize());
    saved.lessons = { moved: true, jumped: true };
    saved.p = { ...saved.p, x: LEVEL.urgentCopier.x - 330, y: LEVEL.floor - 28, vx: 0, vy: 0, a: 0, w: 0 };
    saved.ground = true;
    saved.office.urgent = { ...saved.office.urgent, volley: volley - 1 };
    game.restore(JSON.stringify(saved));
    const effects = createEffects();
    const frames = [capture(game, effects)];
    for (let i = 0; i < 150; i++) {
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    return recordedScene(id, label, LEVEL.urgentCopier.x - 150,
        [{ at: 0, label: 'Scan · Tray glows' }, { at: .6, label: 'Volley' }], frames);
}
