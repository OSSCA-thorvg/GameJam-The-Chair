import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createGame, orbitStep, praiseBeamX, STAGE_FIVE, stepGame, parseCommand, previewScenes, drawOrbit, createRenderCtx, actionForKey, createRecorder, REPLAY_DEFAULTS, buildTimeline, seekTimeline } = await loadSource(`
    export { createRecorder, REPLAY_DEFAULTS, buildTimeline, seekTimeline } from './src/game/replay';
    export { actionForKey } from './src/ui/controls';
    export { createGame, stepGame } from './src/game/game';
    export { orbitStep, praiseBeamX } from './src/game/stages/orbit/course/decide';
    export { STAGE_FIVE } from './src/game/stages/orbit/data';
    export { parseCommand } from './src/game/commands';
    export { previewScenes } from './src/preview-scenes';
    export { drawOrbit } from './src/render/scene/orbit';
    export { createRenderCtx } from './src/render/context';
`);
const fresh = () => { const game = createGame({ seed: 55 }); game.startStage(5); return game; };

test('orbit steering is screen-relative, coasts after release and speeds up with thrust', () => {
    const game = fresh();
    for (let i = 0; i < 360; i++) game.step();
    game.setInput('right', 'forward', 'spray');
    for (let i = 0; i < 100; i++) game.step();
    const moving = JSON.parse(game.serialize());
    assert.ok(moving.p.x > 0 && moving.p.y > 0 && moving.orbit.speed > STAGE_FIVE.cruise);
    const coast = orbitStep(moving.orbit, moving.p, [], .1);
    const thrust = orbitStep(moving.orbit, moving.p, ['spray'], .1);
    assert.ok(coast.p.x > moving.p.x && coast.p.y > moving.p.y);
    assert.ok(thrust.orbit.speed > coast.orbit.speed);
    assert.deepEqual(parseCommand({ type: 'keys', keys: ['brake', 'forward'] }).keys, ['brake', 'forward']);
    assert.deepEqual(parseCommand({ type: 'startStage', id: 5 }), { type: 'startStage', id: 5 });
});

test('stage five has no hoops: after the entry the chair heads straight for the door', () => {
    assert.deepEqual(STAGE_FIVE.rings, []);
    const game = fresh();
    const state = JSON.parse(game.serialize());
    Object.assign(state.orbit, { phase: 'entry', age: STAGE_FIVE.entryTime });
    const result = stepGame(state);
    assert.equal(result.state.orbit.phase, 'door');
    assert.equal(result.state.focus, 100);
    assert.equal(result.state.deaths, 0);
});

test('the cloud entry ends at the office door, without clearing all of stage five', () => {
    const game = fresh();
    // This driver never hides from the 5-1 praise beam, so it crawls through it; allow for that.
    for (let i = 0; i < 120 * 120 && game.getSnapshot().checkpoint === 0; i++) {
        const state = game.getSnapshot(), p = state.player;
        const target = STAGE_FIVE.rings[state.orbit.rings] ?? STAGE_FIVE.door;
        const dy = target.y-p.y-p.vy*.65, dx = target.x-p.x-p.vx*.65;
        // The 5-1 beam shoves the chair sideways, so the driver steers back across as well.
        game.setInput(...(dy > 6 ? ['forward'] : dy < -6 ? ['back'] : []), ...(dx > 6 ? ['right'] : dx < -6 ? ['left'] : []));
        game.step();
    }
    const end = game.getSnapshot();
    assert.equal(end.orbit.phase, 'parked');
    assert.equal(end.orbit.rings, 0);
    assert.equal(end.checkpoint, 1);
    assert.equal(end.deaths, 0);
    assert.equal(end.focus, 100);
    assert.equal(end.completedStage, 4);
    game.restart();
    assert.equal(game.getSnapshot().orbit.phase, 'parked');
    assert.equal(game.getSnapshot().orbit.z, STAGE_FIVE.checkpoint.z);
    const state = JSON.parse(game.serialize());
    Object.assign(state.orbit, { phase: 'door', z: STAGE_FIVE.checkpoint.z, speed: 50 });
    state.p.x = 650;
    const outside = orbitStep(state.orbit, state.p, [], 1 / 120);
    assert.equal(outside.checkpoint, false);
    assert.equal(outside.orbit.phase, 'door');
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

test('the orbit preview reaches the office door, seeks backwards, and renders finite geometry on narrow screens', () => {
    const scene = previewScenes.find(scene => scene.id === 'orbit-route');
    assert.ok(scene);
    assert.equal(STAGE_FIVE.drawer, undefined);
    assert.ok(STAGE_FIVE.door);
    assert.equal(scene.sample(scene.duration).state.orbit.phase, 'parked');
    const early = structuredClone(scene.sample(4));
    scene.sample(30);
    assert.deepEqual(scene.sample(4), early);
    for (const width of [320, 1000]) for (const at of [0, 5, 15, 30, scene.duration]) {
        const frame = scene.sample(at), labels = [];
        const ctx = createRenderCtx({}, { save() {}, restore() {}, measureText: text => ({ width: [...text].length * 8 }), fillText(text) { labels.push(text); } });
        Object.assign(ctx, { state: frame.state, t: at, W: width, H: 510 });
        const before = structuredClone(frame.state);
        drawOrbit(ctx);
        assert.deepEqual(frame.state, before);
        assert.ok(ctx.commands.length > 200);
        assert.ok(ctx.commands.reduce((n,c) => n+(c.curves?.length ?? 0), 0) <= 5000, 'cloud entry stays within its curve budget');
        assert.ok(ctx.commands.filter(c => c.c && typeof c.c === 'object').length <= 140, 'cloud entry stays within its gradient budget');
        const commands = ctx.commands;
        assert.ok(commands.some(cmd => cmd.curves), 'clouds use vector curves');
        assert.ok(!commands.some(cmd => cmd.stroke?.color === '#bff5bd'), 'no green hoops');
        assert.ok(commands.every(cmd => !cmd.layer?.blur && !cmd.layer?.motionBlur), 'the cloud entry uses no blur');
        for (const cmd of commands) for (const point of [...cmd.v, ...(cmd.curves ?? [])]) assert.ok(point.every(Number.isFinite));
    }
});

test('orbit keys steer while earlier stages keep their jump binding', () => {
    const state = fresh().status();
    for (const [key, action] of [['w', 'up'], ['ArrowUp', 'up'], ['s', 'down'], ['ArrowDown', 'down'],
        ['a', 'left'], ['d', 'right'], [' ', 'spray']]) {
        assert.equal(actionForKey(key, state), action);
    }
    assert.equal(actionForKey('ArrowUp', { ...state, stage: 4 }), 'jump');
    assert.equal(actionForKey('Shift', state), null);
});

test('orbit recordings reproduce steering and thrust and support backwards seek', () => {
    const recorder = createRecorder(() => REPLAY_DEFAULTS, 55);
    const game = createGame({ seed: 55, ...recorder });
    game.startStage(5);
    const before = [];
    for (let i = 0; i < 900; i++) {
        if (i === 360) game.setInput('right', 'forward', 'spray');
        if (i === 480) game.setInput('left');
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

test('repeated orbit frames do not accumulate previous drawing commands', () => {
    const scene = previewScenes.find(scene => scene.id === 'orbit-route');
    const state = scene.sample(3).state;
    const ctx = createRenderCtx({}, {});
    Object.assign(ctx, { state, t: state.time, W: 1000, H: 510 });
    drawOrbit(ctx);
    const count = ctx.commands.length;
    for (let frame = 0; frame < 20; frame++) {
        drawOrbit(ctx);
        assert.equal(ctx.commands.length, count, `drawing commands accumulated at frame ${frame+2}`);
    }
});

/** A stage five state with the chair at route depth `z` and lateral `x`, `age` seconds in. */
function praiseState(z, x, age = 10) {
    const state = JSON.parse(fresh().serialize());
    Object.assign(state.orbit, { phase: 'door', age, z, speed: STAGE_FIVE.cruise });
    Object.assign(state.p, { x, y: 0, vx: 0, vy: 0 });
    return state;
}
const run = (state, seconds) => {
    let r = { state, events: [] };
    const events = [];
    for (let i = 0; i < seconds * 120; i++) { r = stepGame(r.state); events.push(...r.events); }
    return { state: r.state, events };
};

test('5-1: each second under the praise beam costs focus, and it does not come back meanwhile', () => {
    const z = STAGE_FIVE.praise.from + 30;
    const { state } = run(praiseState(z, praiseBeamX(10)), 1.5);
    assert.ok(state.focus < 100, `focus ${state.focus}`);
    assert.ok(state.focus >= 100 - 2 * 7, 'at most one hit per second');
    assert.equal(state.focusNotice?.kind, 'praise');
    assert.equal(state.deaths, 0);
});

test('5-1: outside the beam focus recovers, and running out of focus ends the attempt', () => {
    const calm = praiseState(STAGE_FIVE.praise.from - 900, 0);
    calm.focus = 80;
    assert.ok(run(calm, 4.1).state.focus > 80, 'recovers away from the beam');
    const shaky = praiseState(STAGE_FIVE.praise.from + 30, praiseBeamX(10));
    shaky.focus = 5;
    const { state, events } = run(shaky, .2);
    assert.equal(state.mode, 'focuslost');
    assert.ok(events.some(event => event.id === 'focus-lost'));
    assert.equal(state.deaths, 1);
});
