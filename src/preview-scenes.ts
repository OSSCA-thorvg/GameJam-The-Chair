import { createGame, type Game, type GameState } from './game/game';
import type { Input } from './game/types';
import { LEVEL, FIXED_STEP } from './game/level';
import { STAGE_TWO } from './game/stage2';
import { STAGE_THREE, fanStrength } from './game/stage3';
import { createEffects, type EffectsState } from './render/effects';
import { CLEANER_RECOVERY_END, CLEANER_RECOVERY_START } from './render/scene/cleaning';
import { monitorPhase } from './game/systems/monitor';

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
        [{ at: 0, label: 'Ready' }, { at: .75, label: 'First shot' }, { at: .95, label: 'Second shot' }, { at: 1.15, label: 'Third shot' }, { at: 2, label: 'Paper flight' }], frames);
}

function fanRide(): PreviewScene {
    const game = createGame();
    game.startStage(3);
    const base = game.getSnapshot();
    const fan = STAGE_THREE.fans[0];
    const effects = createEffects().snapshot();
    const floorY = fan.y - 28;
    const duration = 2.3;
    let y = floorY;
    let vy = -440;
    const frames: PreviewFrame[] = [];
    for (let i = 0; i <= Math.round(duration / FRAME_TIME); i++) {
        const at = i * FRAME_TIME;
        const power = fanStrength(fan, at);
        if (i > 0) {
            vy += (800 - power) * FRAME_TIME;
            y = Math.min(floorY, y + vy * FRAME_TIME);
            if (y === floorY) vy = 0;
        }
        frames.push({
            state: {
                ...base,
                time: at,
                player: { ...base.player, x: fan.x, y, vy },
                ground: y === floorY && vy === 0,
                onFan: power > 60 && y < floorY,
                fans: STAGE_THREE.fans.map(item => ({ ...item, active: fanStrength(item, at) > 60, power: fanStrength(item, at) })),
            },
            effects,
        });
    }
    return recordedScene('fan-ride', 'Rooftop · Fan wind', fan.x,
        [{ at: 0, label: 'Takeoff' }, { at: fan.period / 4, label: 'Peak wind' }, { at: fan.period / 2, label: 'Wind stops' }, { at: 1.9, label: 'Landing' }], frames);
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

function cartShove(): PreviewScene {
    const game = createGame();
    game.startStage(2);
    game.drainEvents();
    const steer = (state: GameState) => {
        const correction = -state.player.a * 12 - state.player.w * 4;
        const wait = !state.corridor.scanner.approved && state.player.x > 1270;
        const keys: Input[] = wait ? [] : ['right'];
        if (correction < -.4) keys.push('q');
        if (correction > .4) keys.push('e');
        game.setInput(...keys);
    };
    let ready = false;
    for (let i = 0; i < 120 * 30; i++) {
        const state = game.getSnapshot();
        if (state.mode !== 'play') break;
        const gap = state.corridor.cart ? state.corridor.cart.x - state.player.x : undefined;
        if (gap !== undefined && gap > 0 && gap < 240) { ready = true; break; }
        steer(state);
        game.step(FIXED_STEP);
        game.drainEvents();
    }
    if (!ready) throw new Error('Cart preview could not reach the cart.');
    const start = game.getSnapshot();
    const cart = start.corridor.cart;
    if (!cart) throw new Error('Cart preview lost the cart.');
    const effects = createEffects();
    const frames = [capture(game, effects)];
    let hitAt = 0;
    for (let i = 1; i <= 120; i++) {
        const state = game.getSnapshot();
        steer(state);
        stepGame(game, effects);
        const next = game.getSnapshot();
        if (hitAt === 0 && next.corridor.cartHits > 0) hitAt = i * FRAME_TIME;
        frames.push(capture(game, effects, next));
    }
    if (hitAt === 0) throw new Error('Cart preview did not show a collision.');
    return recordedScene('cart-shove', 'Corridor · Cart shove', (start.player.x + cart.x) / 2,
        [{ at: 0, label: 'Approach' }, { at: hitAt, label: 'Cart contact' }, { at: 1.5, label: 'Recover' }], frames);
}

function extinguisherSpray(): PreviewScene {
    const game = createGame();
    game.startStage(3);
    game.drainEvents();
    game.setInput('right');
    game.spray();
    game.setInput();
    const effects = createEffects();
    for (const event of game.drainEvents()) effects.receive(event);
    const shift = 600;
    const frame = () => {
        const state = game.getSnapshot();
        return capture(game, effects, { ...state, player: { ...state.player, x: state.player.x + shift } });
    };
    const frames = [frame()];
    for (let i = 0; i < 54; i++) {
        stepGame(game, effects);
        frames.push(frame());
    }
    return recordedScene('extinguisher-spray', 'Chair · Extinguisher recoil', 700,
        [{ at: 0, label: 'Spray' }, { at: .16, label: 'Recoil' }, { at: .32, label: 'Plume ends' }, { at: .6, label: 'Landing' }], frames);
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
    cleanerRecovery(), monitorLight(), copierVolley(), fanRide(), headImpact(), cartShove(), extinguisherSpray(), officeTyping(),
];
