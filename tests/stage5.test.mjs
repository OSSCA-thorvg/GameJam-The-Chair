import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createGame, orbitStep, STAGE_FIVE, stepGame, parseCommand, previewScenes, drawOrbit, createRenderCtx, actionForKey, createRecorder, REPLAY_DEFAULTS, buildTimeline, seekTimeline } = await loadSource(`
    export { createRecorder, REPLAY_DEFAULTS, buildTimeline, seekTimeline } from './src/game/replay';
    export { actionForKey } from './src/ui/controls';
    export { createGame, stepGame } from './src/game/game';
    export { orbitStep } from './src/game/stages/orbit/course/decide';
    export { STAGE_FIVE } from './src/game/stages/orbit/data';
    export { parseCommand } from './src/game/commands';
    export { previewScenes } from './src/preview-scenes';
    export { drawOrbit } from './src/render/scene/orbit';
    export { createRenderCtx } from './src/render/context';
`);
const fresh = () => { const game = createGame({ seed: 55 }); game.startStage(5); return game; };

test('orbit steering is screen-relative, coasts after release and brakes on all three axes', () => {
    const game = fresh();
    for (let i = 0; i < 360; i++) game.step();
    game.setInput('right', 'forward', 'spray');
    for (let i = 0; i < 100; i++) game.step();
    const moving = JSON.parse(game.serialize());
    assert.ok(moving.p.x > 0 && moving.p.y > 0 && moving.orbit.speed > STAGE_FIVE.cruise);
    const coast = orbitStep(moving.orbit, moving.p, [], .1);
    const brake = orbitStep(moving.orbit, moving.p, ['brake'], .1);
    assert.ok(coast.p.x > moving.p.x && coast.p.y > moving.p.y);
    assert.ok(brake.p.vx < coast.p.vx && brake.p.vy < coast.p.vy && brake.orbit.speed < coast.orbit.speed);
    assert.deepEqual(parseCommand({ type: 'keys', keys: ['brake', 'forward'] }).keys, ['brake', 'forward']);
    assert.deepEqual(parseCommand({ type: 'startStage', id: 5 }), { type: 'startStage', id: 5 });
});

test('a missed hoop remains available without deaths or focus damage', () => {
    const game = fresh();
    const state = JSON.parse(game.serialize());
    Object.assign(state.orbit, { phase: 'rings', z: STAGE_FIVE.rings[0].z - 1 });
    Object.assign(state.p, { x: 600, y: 0 });
    const before = structuredClone(state);
    const result = stepGame(state);
    assert.deepEqual(state, before);
    assert.equal(result.state.orbit.rings, 0);
    assert.ok(result.state.orbit.z < STAGE_FIVE.rings[0].z);
    assert.equal(result.state.focus, 100);
    assert.equal(result.state.deaths, 0);
    result.state.p.x = 0;
    const aligned = stepGame(result.state);
    for (let i = 0; i < 10 && aligned.state.orbit.rings === 0; i++) Object.assign(aligned, stepGame(aligned.state));
    assert.equal(aligned.state.orbit.rings, 1);
});

test('the drawer requires low speed inside its walls, and papers safely catch overshooting chairs', () => {
    const game = fresh();
    const state = JSON.parse(game.serialize());
    Object.assign(state.orbit, { phase: 'drawer', z: 5400, speed: 300, rings: 2 });
    game.restore(JSON.stringify(state));
    for (let i = 0; i < 120; i++) game.step();
    assert.equal(game.getSnapshot().checkpoint, 0, 'entering fast cannot save the checkpoint');
    for (let i = 0; i < 1200; i++) game.step();
    const end = game.getSnapshot();
    assert.equal(end.orbit.phase, 'parked');
    assert.equal(end.checkpoint, 1);
    assert.equal(end.deaths, 0);
    assert.equal(end.focus, 100);
    assert.equal(end.completedStage, 4, 'the first two sections do not clear all of stage five');
    game.restart();
    assert.equal(game.getSnapshot().orbit.phase, 'parked');
    assert.equal(game.getSnapshot().orbit.z, STAGE_FIVE.checkpoint.z);
    Object.assign(state.orbit, { z: 5400, speed: 0 });
    state.p.x = 650;
    const outside = orbitStep(state.orbit, state.p, ['brake'], 1);
    assert.equal(outside.checkpoint, false);
    assert.ok(outside.orbit.z < STAGE_FIVE.drawer.z);
});

test('saved orbit movement resumes exactly and pause freezes it', () => {
    const game = fresh();
    game.setInput('right', 'forward', 'spray');
    for (let i = 0; i < 600; i++) game.step();
    const saved = game.serialize(), clone = fresh();
    clone.restore(saved);
    for (let i = 0; i < 200; i++) { game.step(); clone.step(); }
    assert.equal(clone.serialize(), game.serialize());
    game.pause();
    const frozen = game.serialize();
    game.advance(10);
    assert.equal(game.serialize(), frozen);
});

test('the orbit preview reaches the checkpoint, seeks backwards, and renders finite geometry on narrow screens', () => {
    const scene = previewScenes.find(scene => scene.id === 'orbit-route');
    assert.ok(scene);
    assert.equal(scene.sample(scene.duration).state.orbit.phase, 'parked');
    const early = structuredClone(scene.sample(4));
    scene.sample(30);
    assert.deepEqual(scene.sample(4), early);
    for (const width of [320, 1000]) for (const at of [0, 5, 15, 30, scene.duration]) {
        const frame = scene.sample(at), labels = [];
        const ctx = createRenderCtx({}, { save() {}, restore() {}, fillText(text) { labels.push(text); } });
        Object.assign(ctx, { state: frame.state, t: at, W: width, H: 510 });
        const before = structuredClone(frame.state);
        drawOrbit(ctx);
        assert.deepEqual(frame.state, before);
        assert.ok(ctx.commands.length > 200);
        for (const cmd of ctx.commands) for (const point of [...cmd.v, ...(cmd.curves ?? [])]) assert.ok(point.every(Number.isFinite));
    }
});

test('orbit keys steer and brake while earlier stages keep their jump binding', () => {
    const state = fresh().status();
    for (const [key, action] of [['w', 'up'], ['ArrowUp', 'up'], ['s', 'down'], ['ArrowDown', 'down'],
        ['a', 'left'], ['d', 'right'], ['Shift', 'brake'], [' ', 'spray']]) {
        assert.equal(actionForKey(key, state), action);
    }
    assert.equal(actionForKey('ArrowUp', { ...state, stage: 4 }), 'jump');
    assert.equal(actionForKey('Shift', { ...state, stage: 4 }), null);
});

test('orbit recordings reproduce steering and braking and support backwards seek', () => {
    const recorder = createRecorder(() => REPLAY_DEFAULTS, 55);
    const game = createGame({ seed: 55, ...recorder });
    game.startStage(5);
    const before = [];
    for (let i = 0; i < 900; i++) {
        if (i === 360) game.setInput('right', 'forward', 'spray');
        if (i === 480) game.setInput('brake');
        if (i === 600) game.setInput();
        game.step();
        if (i === 399) before.push(JSON.parse(game.serialize()));
    }
    const file = recorder.latest(0);
    assert.ok(file);
    const timeline = buildTimeline(file);
    assert.equal(timeline.divergedAt, null);
    assert.equal(timeline.error, null);
    const last = seekTimeline(timeline, file.endTick);
    assert.deepEqual(last.state, JSON.parse(game.serialize()));
    assert.deepEqual(seekTimeline(timeline, 400).state, before[0]);
});
