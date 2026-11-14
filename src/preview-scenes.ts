import { createGame, type Game, type GameState } from './game/game';
import type { Input } from './game/types';
import { LEVEL, FIXED_STEP } from './game/level';
import { STAGE_FIVE } from './game/stages/orbit/data';
import { orbitStep, satelliteLightOn } from './game/stages/orbit/course/decide';
import { STAGE_FOUR } from './game/stages/sky/data';
import { revealGlideStart, SKY_DEPARTURE, SKY_TURN } from './render/scene/sky-camera';
import { ATTENDANCE } from './render/scene/attendance-bubble';
import { ORBIT_ENDING } from './render/scene/orbit-ending';
import { STAGE_TWO } from './game/stages/building/data';
import { ductTimings, STAGE_THREE, GRAPH_CORNERS } from './game/stages/rooftop/data';
import { deathShotLength } from './render/death-shot';
import { FOCUS_LOSS_DURATION } from './game/systems/focus/decide';
import { createEffects, type EffectsState } from './render/effects';
import { CLEANER_RECOVERY_END, CLEANER_RECOVERY_START } from './render/scene/cleaning';
import { monitorPhase } from './game/stages/office/monitor/decide';
import { SPLASH_DURATION } from './ui/splash-meta';
import { REACTION_LIFE, SPEECH_LIFE } from './ui/types';
import { translate, type Locale } from './i18n';
import type { SceneTalk } from './render/types';
import { OPENING_BEATS, OPENING_DURATION, openingFrame, openingState, type OpeningFrame } from './render/scene/opening/timeline';

export type PreviewScene = {
    id: string;
    label: string;
    duration: number;
    focusX: number;
    // Follow the chair with the camera (centred) instead of holding it at `focusX`.
    follow?: boolean;
    markers: readonly { at: number; label: string }[];
    sample(time: number): { state: GameState; effects: EffectsState };
    // Cutscene frames draw with their own camera and overlays instead of the stage scene.
    opening?(time: number): OpeningFrame;
    // Spoken lines shown over the scene at this time.
    talk?(time: number, locale: Locale): SceneTalk;
    // The title screen draws its own looping scene at this time.
    title?: boolean;
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
        effects.observe(game.getSnapshot());
        for (const event of game.drainEvents()) effects.receive(event);
        effects.advance(FIXED_STEP);
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

function bucketPour(): PreviewScene {
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
    effects.observe(game.getSnapshot());
    const frames = [capture(game, effects)];
    // Long enough for the slow-motion replay, the BONK and the close-up easing back.
    for (let i = 0; i < Math.ceil(deathShotLength('head') / FRAME_TIME) + 12; i++) {
        if (game.getSnapshot().mode === 'impact') game.advanceImpact(FRAME_TIME);
        effects.observe(game.getSnapshot());
        effects.advance(FRAME_TIME);
        frames.push(capture(game, effects));
    }
    return recordedScene('head-impact', 'Chair · Head impact replay', focusX,
        [{ at: 0, label: 'Impact' }, { at: .5, label: 'Rewind' }, { at: 1.4, label: 'Collision: BONK, close-up' }, { at: 2.25, label: 'Easing back' }, { at: deathShotLength('head'), label: 'Panel' }], frames);
}

function rooftopEntrance(): PreviewScene {
    const game = createGame();
    game.startStage(3);
    const effects = createEffects();
    const frames = [capture(game, effects)];
    for (let i = 0; i < 300; i++) {
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    return recordedScene('rooftop-entrance', 'Rooftop · Entrance & slipping portrait', 400,
        [{ at: 0, label: 'Closed · Portrait straight' }, { at: .4, label: 'Door opens' },
            { at: 1.1, label: 'Chair emerges · Portrait straight' }, { at: 1.8, label: 'At the block' },
            { at: 2.6, label: 'Door shuts · Portrait jolts' }, { at: 2.8, label: 'Portrait drops' },
            { at: 2.96, label: 'Caught · Swinging' }, { at: 3.9, label: 'Swing overshoot' },
            { at: 4.2, label: 'Settled at 40 degrees' }], frames);
}

function personalBelongings(): PreviewScene {
    const game = createGame();
    game.startStage(3);
    const base = game.getSnapshot();
    const effects = createEffects();
    const frames: PreviewFrame[] = [];
    for (let tick = 0; tick <= 960; tick++) {
        const time = tick * FIXED_STEP;
        const x = time < 1 ? 1000 : time < 3 ? 1000 + (time - 1) * 265
            : time < 4 ? 1530 + (time - 3) * 170 : time < 5 ? 1700 : 1700 - Math.min(1, (time - 5) / 2) * 700;
        const state: GameState = { ...base, time, hasExtinguisher: true, rooftopEntrance: { kind: 'ready' },
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

function focusLoss(): PreviewScene {
    const game = createGame();
    game.reset();
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    // The focus-loss glance (1.7 s), then the close-up on the eyes easing back before the game-over panel.
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

function focusTension(): PreviewScene {
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

function focusHitVignette(): PreviewScene {
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

function rooftopTakeoff(): PreviewScene {
    const game = createGame();
    game.startStage(3);
    const saved = JSON.parse(game.serialize());
    saved.checkpoint = STAGE_THREE.checkpoints.length - 1;
    game.restore(JSON.stringify(saved));
    game.reset();
    const parked = JSON.parse(game.serialize());
    parked.p = { ...parked.p, x: 2150, y: -172, vx: 0, vy: 0, a: 0, w: 0 };
    parked.ground = true;
    parked.hasExtinguisher = true;
    game.restore(JSON.stringify(parked));
    const effects = createEffects();
    const frames = [capture(game, effects)];
    game.setInput('right');
    for (let i = 0; i < 600 && game.getSnapshot().stage === 3; i++) {
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    const markers = [
        { at: 0, label: 'Run-up' }, { at: 1.65, label: 'Boards the graph · Surge' },
        ...graphTargetMarkers(frames), { at: 3, label: 'Breaks out of the sign' },
        { at: 3.4, label: 'Short arrow · Chair keeps climbing · White clouds' },
        { at: 4.5, label: 'Colour changing' }, { at: 5.6, label: 'Bread at sky' },
    ].sort((a, b) => a.at - b.at);
    return { ...recordedScene('rooftop-takeoff', 'Rooftop · Sales graph ride & bread cloud ascent', 2500,
        markers, frames), follow: true };
}

function graphTargetMarkers(frames: PreviewFrame[]): PreviewScene['markers'] {
    return [
        { distance: GRAPH_CORNERS[1] + 24, label: 'First peak · Green check' },
        { distance: GRAPH_CORNERS[1] + 100, label: 'Target starts moving · Rail stays fixed' },
        { distance: GRAPH_CORNERS[1] + 220, label: 'Target higher · Check becomes an empty circle' },
    ].map(marker => ({
        at: Math.max(0, frames.findIndex(frame => frame.state.firstFlight.kind === 'ride'
            && frame.state.firstFlight.dist >= marker.distance)) * FRAME_TIME,
        label: marker.label,
    }));
}

// `startTime` shifts the attempt clock so the vents' cycle begins where the scene wants it.
function shaftHazards(id: string, label: string, at: { x: number; y: number }, startTime: number, markers: PreviewScene['markers']): PreviewScene {
    const game = createGame();
    game.startStage(3);
    const saved = JSON.parse(game.serialize());
    saved.checkpoint = STAGE_THREE.checkpoints.findIndex(mark => mark.x === 1310);
    game.restore(JSON.stringify(saved));
    game.reset();
    const parked = JSON.parse(game.serialize());
    parked.p = { ...parked.p, x: at.x, y: at.y, vx: 0, vy: 0, a: 0, w: 0 };
    parked.ground = true;
    parked.time = startTime;
    game.restore(JSON.stringify(parked));
    const effects = createEffects();
    const frames = [capture(game, effects)];
    for (let i = 0; i < 400; i++) {
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    return recordedScene(id, label, at.x, markers, frames);
}

// A stage two game with the rider carried in the convoy at `x`, about to say orientation `line`.
function convoyRide(x: number, line: number, said = false): Game {
    const game = createGame();
    game.startStage(2);
    const saved = JSON.parse(game.serialize());
    const cruise = STAGE_TWO.orientation.cruise;
    saved.checkpoint = 2;
    saved.lessons = { moved: true, jumped: true };
    saved.p = { ...saved.p, x, y: 392, vx: cruise, vy: 0, a: 0, w: 0 };
    saved.ground = true;
    saved.building.furniture = saved.building.furniture.map((chair: object, i: number) => ({ ...chair, x: x + 90 - i * 130, vx: cruise, released: true, cheer: 0 }));
    Object.assign(saved.building.corridor, {
        dispatchStarted: true, dispatchAge: 10, convoy: 'carried', lesson: line,
        chat: { kind: 'orientation', age: said ? 9 : -1, line },
    });
    game.restore(JSON.stringify(saved));
    return game;
}

// Hop when the jump will peak over the next orientation obstacle.
function orientationHop(state: GameState) {
    if (!state.ground) return false;
    const p = state.player;
    return STAGE_TWO.orientation.obstacles.some(obstacle => {
        const time = (obstacle.x - p.x) / Math.max(1, p.vx);
        return time > .36 && time < .44;
    });
}

// Rides the orientation convoy from `x`, the chairs about to say `line`.
function orientationRun(id: string, label: string, x: number, line: number, hop: boolean, frameCount: number, markers: PreviewScene['markers']): PreviewScene {
    const game = convoyRide(x, line);
    const effects = createEffects();
    const frames = [capture(game, effects)];
    for (let i = 0; i < frameCount; i++) {
        const state = game.getSnapshot();
        if (hop && orientationHop(state)) game.jump();
        game.setInput(...(state.corridor.convoy === 'carried' ? [] : ['right'] satisfies Input[]));
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    return { ...recordedScene(id, label, x, markers, frames), follow: true };
}

function expressRun(id: string, label: string, rampJump: boolean, markers: PreviewScene['markers']): PreviewScene {
    const game = convoyRide(STAGE_TWO.express.start - 10, STAGE_TWO.orientation.lines.length - 1, true);
    const { pit } = STAGE_TWO.express;
    const effects = createEffects();
    const frames = [capture(game, effects)];
    let off = false;
    for (let i = 0; i < 300; i++) {
        const state = game.getSnapshot(), p = state.player, c = state.corridor;
        let keys: Input[] = [];
        if (off || c.convoy === 'free') keys = ['right'];
        else if (c.convoy === 'carried' && state.ground) {
            if (rampJump && pit.left - p.x > 0 && pit.left - p.x < 35) game.jump();
            if (p.x > pit.right + 120) { game.jump(); off = true; keys = ['right']; }
        }
        game.setInput(...keys);
        stepGame(game, effects);
        frames.push(capture(game, effects));
        if (game.getSnapshot().deaths > 0) break;
    }
    return { ...recordedScene(id, label, STAGE_TWO.express.ramp.start, markers, frames), follow: true };
}

function urgentCopier(volley: number, id: string, label: string): PreviewScene {
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

function cloudEntry(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const effects = createEffects();
    const frames = [capture(game, effects)];
    for (let i = 0; i < 120; i++) {
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    return recordedScene('cloud-entry', 'Sky · Stage 4 bread clouds', 2380,
        [{ at: 0, label: 'Bread on arrival' }, { at: 1, label: 'Continuous spray' }], frames);
}

function skyGustCycle(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const w = STAGE_FOUR.wind;
    const start = w.calm - 1;
    const duration = 1 + w.warn + w.blow + w.fall + 2;
    return {
        id: 'sky-gust', label: 'Sky · Headwind gust, paper bundles, parrots, rocking desks', duration, focusX: 3900,
        markers: [{ at: 0, label: 'Steady headwind' }, { at: 1, label: 'Warning breeze' }, { at: 1 + w.warn, label: 'Gust' },
            { at: 1 + w.warn + w.blow, label: 'Gust fades' }, { at: duration - 1, label: 'Parrot knock' }],
        sample(time) {
            const at = Math.max(0, Math.min(duration, time));
            const knock = Math.max(0, at - (duration - 1));
            return { state: { ...base, time: start + at,
                sky: { ...base.sky, phase: 'course', lift: 1, drawer: 1, signTilt: -.12 - (1 - Math.min(1, Math.max(0, (at - 1 - w.warn) * 3))) * 1.12,
                    airSprays: Math.min(3, Math.floor(at / 2)), knock: knock > 0 ? STAGE_FOUR.knock.cooldown * (1 - knock) : 0, knockKind: knock > 0 ? 'bird' : null },
                player: { ...base.player, x: 3900, y: -2300 }, ground: false,
            }, effects };
        },
    };
}

function skyOfficeFacade(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    return {
        id: 'sky-facade', label: 'Sky · Floating office facade and its workers', duration: 6, focusX: 3225,
        markers: [{ at: 0, label: 'Office at work' }],
        sample(time) {
            const at = Math.max(0, Math.min(6, time));
            return { state: { ...base, time: at, sky: { ...base.sky, phase: 'course', lift: 1 },
                player: { ...base.player, x: 3110, y: -1918 }, ground: true }, effects };
        },
    };
}

function skyOfficeGear(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const duration = 6;
    return {
        id: 'sky-gear', label: 'Sky · Floating monitor, keyboard, mouse and tower PC', duration, focusX: 4100,
        markers: [{ at: 0, label: 'Drifting gear' }, { at: duration - 1, label: 'Gear knock' }],
        sample(time) {
            const at = Math.max(0, Math.min(duration, time));
            const knock = Math.max(0, at - (duration - 1));
            return { state: { ...base, time: at,
                sky: { ...base.sky, phase: 'course', lift: 1, drawer: 1,
                    knock: knock > 0 ? STAGE_FOUR.knock.cooldown * (1 - knock) : 0, knockKind: knock > 0 ? 'gear' : null },
                player: { ...base.player, x: 3960 - knock * 60, y: -2220 }, ground: false,
            }, effects };
        },
    };
}

function skyWindFeedback(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const w = STAGE_FOUR.wind;
    const gustAt = w.calm + w.warn;
    return {
        id: 'sky-wind-feedback', label: 'Sky · Open-air wind response (spray held)',
        duration: w.period, focusX: 3900,
        markers: [{ at: 0, label: 'Calm' }, { at: w.calm + w.warn * .65, label: 'Chair warns' },
            { at: gustAt + w.rise * .6, label: 'Gust onset' }, { at: gustAt + .8, label: 'Smoke bends left' },
            { at: gustAt + w.blow + w.fall + .1, label: 'Calm returns' }],
        sample(time) {
            const at = Math.max(0, Math.min(w.period, time));
            return { state: { ...base, time: at, ground: false, hasExtinguisher: true,
                lessons: { ...base.lessons, moved: true },
                player: { ...base.player, x: 3900, y: -3000, a: 0, vx: 0, vy: 0 },
                sky: { ...base.sky, phase: 'course', airSprays: 1 },
                spray: { ...base.spray, burst: .24, dir: { x: 0, y: 1 } },
            }, effects };
        },
    };
}

function skyParrots(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const period = 8.2, passes = 10, duration = period * passes;
    return {
        id: 'sky-parrots', label: 'Sky · Parrot colours (one bird per pass)', duration, focusX: 4150,
        markers: Array.from({ length: passes }, (_, i) => ({ at: i * period + 3.6, label: `Pass ${i + 1}` })),
        sample(time) {
            const at = Math.max(0, Math.min(duration, time));
            return { state: { ...base, time: at,
                sky: { ...base.sky, phase: 'course', lift: 1, drawer: 1 },
                player: { ...base.player, x: 3980, y: -2330 }, ground: false,
            }, effects };
        },
    };
}

function skyRobotParrot(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const period = 8.2, start = period * 19, duration = period * 2, hit = 5.3;
    return {
        id: 'sky-robot-parrot', label: 'Sky · Robot parrots (liquid metal, black chrome) and gear knock', duration, focusX: 4150,
        markers: [{ at: 0, label: 'Liquid metal' }, { at: hit, label: 'Gear knock' },
            { at: period, label: 'Black chrome' }, { at: period + hit, label: 'Gear knock' }],
        sample(time) {
            const at = Math.max(0, Math.min(duration, time));
            const knock = (at % period) - hit;
            const knocking = knock > 0 && knock < 1;
            return { state: { ...base, time: start + at,
                sky: { ...base.sky, phase: 'course', lift: 1, drawer: 1,
                    knock: knocking ? STAGE_FOUR.knock.cooldown * (1 - knock) : 0, knockKind: knocking ? 'gear' : null },
                player: { ...base.player, x: 3980, y: -2240 }, ground: false,
            }, effects };
        },
    };
}

function skySignDepth(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const duration = 8;
    return {
        id: 'sky-sign-depth', label: 'Sky · Chair and parrot pass in front of the billboard copy', duration, focusX: 4770,
        markers: [{ at: 7.3, label: 'Parrot reaches sign' }, { at: 7.9, label: 'Parrot over copy' }],
        sample(time) {
            const at = Math.max(0, Math.min(duration, time));
            return { state: { ...base, time: at,
                sky: { ...base.sky, phase: 'course', lift: 1, drawer: 1 },
                player: { ...base.player, x: 4790 - Math.sin(at * .8) * 50, y: -2195 }, ground: false,
            }, effects };
        },
    };
}

function skyPromotionCake(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    return {
        id: 'sky-promotion-cake', label: 'Sky · Promotion shortcake on the final desk', duration: 5, focusX: 5210,
        markers: [{ at: 0, label: 'Cake visible on approach' }, { at: 2.5, label: 'Flag in the wind' }],
        sample(time) {
            const at = Math.max(0, Math.min(5, time));
            return { state: { ...base, time: at,
                sky: { ...base.sky, phase: 'course', lift: 1, drawer: 1 },
                player: { ...base.player, x: 4840, y: -2260 }, ground: false,
            }, effects };
        },
    };
}

function skyEnding(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const { settle, turn, hold } = STAGE_FOUR.reveal;
    const duration = settle + turn + hold;
    return {
        id: 'sky-ending', label: 'Sky · Slow turn among cameras, glide into stage 5 at cruise speed', duration, focusX: STAGE_FOUR.goal,
        markers: [{ at: 0, label: 'Leaving the ledge' }, { at: SKY_DEPARTURE, label: 'Quiet side view' },
            { at: settle + SKY_TURN.duration * .25, label: 'Cameras turning up' },
            { at: settle + SKY_TURN.duration / 2, label: 'Three-quarter view' },
            { at: revealGlideStart(settle), label: 'All cameras watching · glide starts' },
            { at: settle + SKY_TURN.duration, label: 'Rear view · gliding past the cameras' },
            { at: duration - ATTENDANCE.lead, label: 'Attendance confirmed' },
            { at: duration, label: 'Stage 5 hand-off' }],
        sample(time) {
            const at = Math.max(0, Math.min(duration, time));
            const depth = at >= settle + turn;
            return { state: { ...base, time: at,
                sky: { ...base.sky, phase: depth ? 'depth' : 'reveal', age: depth ? at - settle - turn : at },
                player: { ...base.player, x: 5045, y: -2338 }, ground: false,
            }, effects };
        },
    };
}

function skyToOrbit(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const start = JSON.parse(game.serialize());
    Object.assign(start.sky, { phase: 'reveal', age: 0 });
    Object.assign(start.p, { x: 5045, y: -2338, vx: 0, vy: 0 });
    start.ground = false;
    game.restore(JSON.stringify(start));
    const effects = createEffects();
    const frames = [capture(game, effects)];
    const markers = [{ at: 0, label: 'Leaving the ledge' }, { at: revealGlideStart(STAGE_FOUR.reveal.settle), label: 'Glide starts' }];
    for (let i = 0; i < 60 * 30; i++) {
        const state = game.getSnapshot();
        if (state.stage === 5 && !markers.some(marker => marker.label === 'Stage 5')) markers.push({ at: i / 60, label: 'Stage 5' });
        const age = state.stage === 5 && state.orbit ? state.orbit.age : -1;
        // The chair flies on by itself: steer right, then left and up, then let go.
        game.setInput(...(age < 0 ? [] : age < 1.6 ? ['right' as const] : age < 3.2 ? ['left' as const, 'forward' as const] : []));
        stepGame(game, effects);
        frames.push(capture(game, effects));
        if (age > 7.5) break;
    }
    return recordedScene('sky-to-orbit', 'Sky → Orbit · Hand-off, steering fade-in, flying on by itself', 0, markers, frames);
}

/** Moves the chair across toward `x`. */
function moveToward(p: { x: number; vx: number }, x: number): Input[] {
    const error = x - (p.x + p.vx * .25);
    return error > 12 ? ['right'] : error < -12 ? ['left'] : [];
}

const PLAN = { seconds: 1.2, step: .1 };
const TURNS: Input[][] = [['left'], [], ['right']];
const CLIMBS: Input[][] = [['forward'], [], ['back']];

/**
 * Steering for the stage five previews: try every way across and up for a moment with the real flight rules and take
 * the one that stays out of the beams and gets furthest on, spraying all the way.
 */
export function orbitKeys(state: ReturnType<ReturnType<typeof createGame>['getSnapshot']>): Input[] {
    const orbit = state.orbit, p = state.player;
    if (!orbit) return [];
    let best = -Infinity, keys: Input[] = [];
    for (const turn of TURNS) for (const climb of CLIMBS) {
        const held = [...turn, ...climb];
        let o = orbit, q = p, lit = 0;
        for (let t = 0; t < PLAN.seconds; t += PLAN.step) {
            ({ orbit: o, p: q } = orbitStep(o, q, held, PLAN.step));
            // Nearer moments count more: those are the ones still certain.
            if (satelliteLightOn(o, q, o.z)) lit += 1.5 - t;
        }
        // Keeping on the way it already moves breaks ties, so it commits to one way out instead of dithering.
        const along = (turn[0] === 'left' ? -p.vx : turn[0] === 'right' ? p.vx : 0) + (climb[0] === 'forward' ? p.vy : climb[0] === 'back' ? -p.vy : 0);
        const score = (o.z - orbit.z) * .05 - lit * 40 - (Math.abs(q.x) + Math.abs(q.y)) * .01 + along * .02;
        if (score > best) { best = score; keys = turn.concat(climb); }
    }
    return keys;
}

function orbitRoute(): PreviewScene {
    const game = createGame();
    game.startStage(5);
    const effects = createEffects();
    const frames = [capture(game, effects)];
    const markers = [{ at: 0, label: 'Stage 4 rear view' }];
    const { air, space, shadow } = STAGE_FIVE.heights;
    let previous = '';
    for (let i = 0; i < 9000; i++) {
        const state = game.getSnapshot(), orbit = state.orbit;
        if (!orbit) break;
        game.setInput(...orbitKeys(state));
        stepGame(game, effects);
        frames.push(capture(game, effects));
        const section = orbit.phase === 'parked' ? 'Ending' : orbit.z < air ? '5-1 clouds'
            : orbit.z < space ? '5-2 atmosphere' : orbit.z < shadow ? '5-3 space' : 'Earth shadow';
        if (section !== previous) { markers.push({ at: i / 60, label: section }); previous = section; }
        // Keep recording through the whole ending, so the hand-off from 5-3 can be watched in one go.
        if (orbit.phase === 'parked' && i / 60 - (markers.at(-1)?.at ?? 0) > ORBIT_ENDING.end + 1) break;
    }
    return recordedScene('orbit-route', 'Orbit · 5-1 to 5-3 and the ending', 0, markers, frames);
}

function orbitEndingScene(aside = false): PreviewScene {
    const game = createGame();
    game.startStage(5);
    const parked = JSON.parse(game.serialize());
    Object.assign(parked.orbit, { phase: 'parked', z: STAGE_FIVE.checkpoint.z, speed: 0, settled: 1, age: 76 });
    // The whole shadow is the goal, so in play the chair can park well off the middle of the route.
    if (aside) Object.assign(parked.p, { x: -STAGE_FIVE.bounds.x, y: STAGE_FIVE.bounds.y, vx: 0, vy: 0, a: 0 });
    // As in play, the chair arrives well into the stage, long after the stage title has gone.
    parked.checkpoint = 1;
    parked.time = 76;
    game.restore(JSON.stringify(parked));
    const effects = createEffects();
    const frames = [capture(game, effects)];
    const { release, focus, signal, disconnect, handsStop, wideFrom, spinFrom, spin, lightsOut, dark, end } = ORBIT_ENDING;
    const markers = [{ at: 0, label: 'Spray dies down' }, { at: release, label: 'Extinguisher floats off' }, { at: focus, label: 'Over his shoulder' },
        { at: signal, label: 'Signal dropping' }, { at: disconnect, label: 'Network lost on screen' }, { at: handsStop, label: 'Hands stop · nothing' },
        { at: wideFrom, label: 'Pulling back' }, { at: spinFrom, label: 'Chair swivels, camera circles' },
        { at: spin, label: 'Laptop goes dark' }, { at: lightsOut, label: 'Fading out' }, { at: dark, label: 'THE END' }];
    for (let i = 0; i < (end + 1) * 60; i++) {
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    return aside
        ? recordedScene('orbit-ending-aside', 'Orbit · Ending after parking off to one side', 0, markers, frames)
        : recordedScene('orbit-ending', 'Orbit · Ending: network lost on screen, hands stop, the chair looks out, THE END', 0, markers, frames);
}

function orbitSatelliteLightScene(): PreviewScene {
    const game = createGame();
    game.startStage(5);
    const effects = createEffects();
    const frames = [capture(game, effects)];
    const markers = [{ at: 0, label: 'Stage 5 start' }];
    const first = STAGE_FIVE.satelliteLight.beams[0];
    let previous = '';
    for (let i = 0; i < 2400; i++) {
        const state = game.getSnapshot(), orbit = state.orbit;
        if (!orbit || orbit.z > first.to + 200) break;
        game.setInput(...orbitKeys(state));
        stepGame(game, effects);
        frames.push(capture(game, effects));
        const stage = orbit.z < first.from ? 'clouds' : orbit.z < first.to ? 'satellite light' : 'past the beam';
        if (stage !== previous) { markers.push({ at: i / 60, label: stage }); previous = stage; }
    }
    return recordedScene('orbit-satellite-light', 'Orbit · 5-1: the first beam, announced then dodged', 0, markers, frames);
}

function orbitSatelliteLightLitScene(): PreviewScene {
    const game = createGame();
    game.startStage(5);
    const effects = createEffects();
    const frames = [capture(game, effects)];
    const markers = [{ at: 0, label: 'Stage 5 start' }];
    const first = STAGE_FIVE.satelliteLight.beams[0];
    let previous = '';
    for (let i = 0; i < 2400; i++) {
        const state = game.getSnapshot(), orbit = state.orbit, p = state.player;
        if (!orbit || orbit.z > first.to) break;
        const target = orbit.aims[0].x + first.half.x + 40 + 90 * Math.cos(orbit.age * .9);
        const keys: Input[] = moveToward(p, target);
        game.setInput(...keys);
        stepGame(game, effects);
        frames.push(capture(game, effects));
        const stage = orbit.z < first.from - 300 ? 'approach' : 'in and out of the light';
        if (stage !== previous) { markers.push({ at: i / 60, label: stage }); previous = stage; }
    }
    return recordedScene('orbit-satellite-light-lit', 'Orbit · The chair lights up near and inside a satellite light', 0, markers, frames);
}

function ductSneeze(gust = false): PreviewScene {
    const game = createGame();
    game.startStage(3);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const kind = gust ? 'gust' : 'first';
    const timing = ductTimings(kind);
    return {
        id: gust ? 'duct-gust' : 'duct-sneeze', label: gust ? 'Rooftop · Timed duct gust' : 'Rooftop · First timed sneeze & overtime junk', duration: 2.2, focusX: 1510,
        markers: [{ at: .05, label: 'Inhale' }, { at: timing.inhale + .02, label: 'Twitch' },
            { at: timing.inhale + timing.twitch + .18, label: 'Sneeze' }, { at: gust ? 1.6 : 2.1, label: gust ? 'Gust fades' : 'Junk settles' }],
        sample(time) {
            const at = Math.max(0, Math.min(2.2, time));
            const drift = Math.min(1, Math.max(0, at - timing.inhale - timing.twitch));
            return { state: { ...base, time: at, hasExtinguisher: true, checkpoint: 2,
                rooftopEntrance: { kind: 'ready' }, ductReaction: { kind: 'reacting', age: gust ? 10 + at : at, shots: gust ? 2 : 1, bursts: [{ kind, age: at }] },
                player: { ...base.player, x: 1580 - drift * (gust ? 120 : 145), y: 160 - Math.sin(drift * Math.PI) * 45, a: -.05 }, ground: false,
            }, effects };
        },
    };
}

/** The meeting room on the `visit`-th walk in; the chairs grumble a different set of lines each time. */
function meetingVisit(visit = 1): PreviewScene {
    const game = createGame({ seed: 8 });
    game.startStage(2);
    const saved = JSON.parse(game.serialize());
    saved.mode = 'play';
    saved.ground = true;
    saved.p.x = STAGE_TWO.meeting - 110;
    game.restore(JSON.stringify(saved));
    game.interact();
    const effects = createEffects();
    // Earlier visits, as the effects would have counted them walking in and out of the room.
    for (let i = 1; i < visit; i++) {
        const state = game.getSnapshot();
        for (const kind of ['entering', 'corridor']) effects.observe({ ...state, corridor: { ...state.corridor, room: { kind } } });
    }
    const frames = [capture(game, effects)];
    for (let i = 0; i < Math.ceil((6 + STAGE_TWO.meetingEntry) / FRAME_TIME); i++) {
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    const id = visit === 1 ? 'building-meeting' : `building-meeting-${visit}`;
    const label = visit === 1 ? 'Building · The chairs cannot clock out' : `Building · The chairs cannot clock out (visit ${visit})`;
    return recordedScene(id, label, STAGE_TWO.meeting,
        [{ at: 0, label: 'Closed door' }, { at: .25, label: 'Opening and entering' },
            { at: STAGE_TWO.meetingEntry, label: 'Inside the meeting' }, { at: 2.4, label: 'Chairs sigh under their people' },
            { at: 2.75, label: 'End time extended' }, { at: 5.45, label: 'Return the borrowed chair' }], frames);
}

function chairDispatch(): PreviewScene {
    const game = createGame({ seed: 8 });
    game.startStage(2);
    const saved = JSON.parse(game.serialize());
    saved.mode = 'play';
    saved.ground = true;
    saved.checkpoint = 1;
    saved.p.x = STAGE_TWO.checkpoints[1].x;
    game.restore(JSON.stringify(saved));
    const effects = createEffects();
    const frames = [capture(game, effects)];
    for (let i = 0; i < 300; i++) {
        game.setInput('right');
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    return recordedScene('building-dispatch', 'Building · Chairs leave after the first flag', STAGE_TWO.dispatch.room,
        [{ at: 0, label: 'First checkpoint' }, { at: 1.1, label: 'Room opens' },
            { at: 2.9, label: 'Last chair leaves' }, { at: 4.1, label: 'Door closes' }, { at: 4.8, label: 'Join the convoy' }], frames);
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

function sceneTalk(): PreviewScene {
    const game = createGame();
    game.reset();
    const effects = createEffects().snapshot();
    const frames: GameState[] = [];
    for (let frame = 0; frame * FRAME_TIME <= 4.2; frame++) {
        frames.push(game.getSnapshot());
        for (let i = 0; i < 2; i++) game.step(FIXED_STEP);
        game.drainEvents();
    }
    const REACT = .6, SPEAK = 1.4;
    const managerX = frames[0].people.find(person => person.id === 'manager')?.x ?? 320;
    return {
        id: 'scene-talk', label: 'Office · Stage title, rider reaction and colleague remark', duration: 4.2, focusX: 420,
        markers: [{ at: 0, label: 'Title drops' }, { at: REACT, label: 'Rider reacts' }, { at: SPEAK, label: 'Manager speaks' }, { at: 2.2, label: 'Title gone' }],
        sample(time) {
            return { state: frames[Math.max(0, Math.min(frames.length - 1, Math.round(time / FRAME_TIME)))], effects };
        },
        talk(time, locale) {
            const reactionLife = REACTION_LIFE - (time - REACT);
            const speechLife = SPEECH_LIFE - (time - SPEAK);
            return {
                reaction: time >= REACT && reactionLife > 0 ? { text: translate('player.paperHit', locale), life: reactionLife } : null,
                speech: time >= SPEAK && speechLife > 0
                    ? { name: translate('person.manager', locale), text: translate('npc.manager.leave', locale), x: managerX, life: speechLife } : null,
            };
        },
    };
}

function opening(): PreviewScene {
    const game = createGame();
    game.reset();
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const B = OPENING_BEATS;
    return {
        id: 'opening', label: 'Intro · Opening: overtime until 9 pm', duration: OPENING_DURATION, focusX: base.player.x,
        markers: [
            { at: B.sixPm, label: '6 pm' }, { at: B.irisOpen, label: 'Into the office' }, { at: B.riderOvertime, label: 'Worker: overtime' },
            { at: B.riderSales, label: 'Worker: sales' }, { at: B.pushIn, label: 'Push in' }, { at: B.chairHope, label: 'Chair hopes' },
            { at: B.irisClose, label: 'Back to clock' }, { at: B.creak, label: '7 pm: creaking' }, { at: B.spinToEight, label: '7 → 8 pm' },
            { at: B.kick, label: '8 pm: backrest kick' }, { at: B.spinToNine, label: '8 → 9 pm' },
            { at: B.darkChair, label: 'Dark chair' }, { at: B.rage, label: 'Rage' }, { at: B.handoff, label: 'Handoff' },
        ],
        sample: time => ({ state: openingState(base, openingFrame(time)), effects }),
        opening: openingFrame,
    };
}

function titleScreen(): PreviewScene {
    const game = createGame();
    game.reset();
    const state = game.getSnapshot();
    const effects = createEffects().snapshot();
    return {
        id: 'title-screen', label: 'Intro · Title screen: dash for the exit', duration: 4, focusX: state.player.x, title: true,
        markers: [{ at: 0, label: 'Loop' }, { at: 2, label: 'Sign glow' }],
        sample: () => ({ state, effects }),
    };
}

export const previewScenes: readonly PreviewScene[] = [
    {
        id: 'startup-splash', label: 'Intro · ThorVG splash', duration: SPLASH_DURATION,
        focusX: 400,
        markers: [{ at: 0, label: 'Opening' }, { at: 3.5, label: 'Middle' }, { at: 6.9, label: 'End' }],
        sample: () => ({ state: createGame().getSnapshot(), effects: createEffects().snapshot() }),
    },
    titleScreen(),
    opening(),
    sceneTalk(),
    bucketPour(),
    cleanerRecovery(),
    monitorLight(),
    copierVolley(),
    headImpact(),
    focusLoss(),
    focusTension(),
    focusHitVignette(),
    rooftopEntrance(),
    personalBelongings(),
    extinguisherSpray(),
    ductSneeze(),
    ductSneeze(true),
    shaftHazards('rooftop-shaft-low', 'Rooftop · Shaft duct gust & side vent', { x: 1420, y: 78 }, 0,
        [{ at: 1.6, label: 'Vent hiss' }, { at: 2.4, label: 'Vent blast' }, { at: 3.45, label: 'Duct inhale' }, { at: 4.05, label: 'Duct gust' }]),
    shaftHazards('rooftop-shaft-high', 'Rooftop · Shaft vent & ceiling downdraft', { x: 1400, y: -262 }, 1.2,
        [{ at: .3, label: 'Downdraft' }, { at: 1.5, label: 'Wall vent hiss' }, { at: 2.25, label: 'Wall vent blast' }, { at: 2.65, label: 'Ceiling hiss' }, { at: 3.4, label: 'Downdraft' }]),
    orientationRun('orientation-cable', 'Building · Orientation: hop the cables', 3570, 0, true, 420,
        [{ at: 0, label: 'Rule one' }, { at: 1.4, label: 'Chairs hop first' }, { at: 2, label: 'Rookie hops' }, { at: 3.6, label: 'Again' }]),
    orientationRun('orientation-sleeper', 'Building · Orientation: overtime sleepers', 4890, 3, true, 480,
        [{ at: 0, label: 'Shh' }, { at: 2.2, label: 'Hop the sleeping bag' }, { at: 3.7, label: 'Another one' }]),
    orientationRun('orientation-rhythm', 'Building · Orientation: back to back after the flag', 6150, 6, true, 540,
        [{ at: 1.2, label: 'Two cables' }, { at: 3.6, label: 'Sleeper, cable' }, { at: 5.5, label: 'Three cables' }]),
    orientationRun('orientation-finale', 'Building · Orientation: sleeper pair and the last mix', 7900, 6, true, 360,
        [{ at: .8, label: 'Two sleepers' }, { at: 3, label: 'Cable, sleeper, cable' }]),
    orientationRun('orientation-trip', 'Building · Orientation: rookie trips', 3570, 0, false, 480,
        [{ at: 2, label: 'Trip on the cable' }, { at: 2.2, label: 'Rookie down!' }, { at: 3.7, label: 'Chairs wait' }]),
    expressRun('express-ramp', 'Building · Express: jump from the ramp', true,
        [{ at: 1.5, label: 'Ramp shout' }, { at: 2.6, label: 'Jump at the lip' }]),
    expressRun('express-ramp-miss', 'Building · Express: miss the ramp jump', false,
        [{ at: 1.5, label: 'Ramp shout' }, { at: 2.8, label: 'Missed jump' }]),
    urgentCopier(1, 'urgent-copier-low', 'Office · Urgent reports: skimming sheets'),
    urgentCopier(2, 'urgent-copier-lob', 'Office · Urgent reports: lobbed sheets'),
    urgentCopier(3, 'urgent-copier-fan', 'Office · Urgent reports: both at once'),
    urgentCopier(4, 'urgent-copier-bundle', 'Office · Urgent reports: stapled bundle'),
    rooftopTakeoff(),
    cloudEntry(),
    skyGustCycle(),
    skyOfficeGear(),
    skyOfficeFacade(),
    skyWindFeedback(),
    skyParrots(),
    skyRobotParrot(),
    skySignDepth(),
    skyPromotionCake(),
    skyEnding(),
    skyToOrbit(),
    orbitRoute(),
    orbitSatelliteLightScene(),
    orbitSatelliteLightLitScene(),
    orbitEndingScene(),
    orbitEndingScene(true),
    meetingVisit(),
    meetingVisit(2),
    meetingVisit(3),
    chairDispatch(),
    officeTyping(),
];
