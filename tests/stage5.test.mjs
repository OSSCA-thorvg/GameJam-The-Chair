import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createGame, orbitStep, praiseBeamX, praiseBeamOn, STAGE_FIVE, stepGame, parseCommand, previewScenes, orbitKeys, drawOrbit, createRenderCtx, actionForKey, createRecorder, REPLAY_DEFAULTS, buildTimeline, seekTimeline } = await loadSource(`
    export { createRecorder, REPLAY_DEFAULTS, buildTimeline, seekTimeline } from './src/game/replay';
    export { actionForKey } from './src/ui/controls';
    export { createGame, stepGame } from './src/game/game';
    export { orbitStep, praiseBeamX, praiseBeamOn } from './src/game/stages/orbit/course/decide';
    export { STAGE_FIVE } from './src/game/stages/orbit/data';
    export { parseCommand } from './src/game/commands';
    export { previewScenes, orbitKeys } from './src/preview-scenes';
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

test('stage five climbs through 5-1 to 5-3 and stops in the Earth shadow, without clearing all of stage five', () => {
    const game = fresh();
    // The preview driver hides in 5-1's clouds and keeps to the widest gap between the beams after that.
    let lowest = 100;
    for (let i = 0; i < 120 * 150 && game.getSnapshot().checkpoint === 0; i++) {
        game.setInput(...orbitKeys(game.getSnapshot()));
        game.step();
        lowest = Math.min(lowest, game.getSnapshot().focus);
    }
    const end = game.getSnapshot();
    assert.equal(end.orbit.phase, 'parked');
    assert.ok(end.orbit.z >= STAGE_FIVE.heights.shadow, 'parked inside the Earth shadow');
    assert.equal(end.checkpoint, 1);
    assert.equal(end.deaths, 0);
    assert.ok(lowest > 20, `careful steering keeps some focus (lowest ${lowest})`);
    assert.equal(end.focus, 100, 'reaching the shadow clears the head');
    assert.equal(end.completedStage, 4);
    game.restart();
    assert.equal(game.getSnapshot().orbit.phase, 'parked');
    assert.equal(game.getSnapshot().orbit.z, STAGE_FIVE.checkpoint.z);
    // The whole shadow is the goal: arriving off to one side still parks there.
    const state = JSON.parse(game.serialize());
    Object.assign(state.orbit, { phase: 'door', z: STAGE_FIVE.checkpoint.z, speed: 50 });
    state.p.x = 650;
    const aside = orbitStep(state.orbit, state.p, [], 1 / 120);
    assert.equal(aside.checkpoint, true);
    assert.equal(aside.orbit.phase, 'parked');
});

test('no praise beam reaches into the Earth shadow, and every beam sweeps slower than the chair steers', () => {
    const { beams } = STAGE_FIVE.praise;
    assert.ok(beams.every(beam => beam.to <= STAGE_FIVE.heights.shadow));
    const steer = STAGE_FIVE.steer.speed;
    assert.ok(beams.every(beam => beam.amplitude * beam.rate < steer), 'the chair can always outrun a sweep');
    assert.equal(beams.filter(beam => beam.from >= STAGE_FIVE.heights.air && beam.to <= STAGE_FIVE.heights.space).length, 3, '5-2 has three satellites');
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

test('the orbit preview reaches the Earth shadow, seeks backwards, and renders finite geometry on narrow screens', () => {
    const scene = previewScenes.find(scene => scene.id === 'orbit-route');
    assert.ok(scene);
    assert.equal(STAGE_FIVE.drawer, undefined);
    assert.ok(STAGE_FIVE.door);
    assert.equal(scene.sample(scene.duration).state.orbit.phase, 'parked');
    const early = structuredClone(scene.sample(4));
    scene.sample(30);
    assert.deepEqual(scene.sample(4), early);
    for (const width of [320, 1000]) for (const at of [0, 5, 15, 30, scene.duration]) {
        const frame = scene.sample(at);
        const ctx = createRenderCtx({});
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
    const ctx = createRenderCtx({});
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
    const first = STAGE_FIVE.praise.beams[0], z = first.from + 30;
    const { state } = run(praiseState(z, praiseBeamX(first, 10)), 1.5);
    assert.ok(state.focus < 100, `focus ${state.focus}`);
    assert.ok(state.focus >= 100 - 2 * 5, 'at most one hit per second');
    assert.equal(state.focusNotice?.kind, 'praise');
    assert.equal(state.deaths, 0);
});

test('5-1: outside the beam focus recovers, and running out of focus ends the attempt', () => {
    const first = STAGE_FIVE.praise.beams[0];
    const calm = praiseState(first.from - 900, 0);
    calm.focus = 80;
    assert.ok(run(calm, 4.1).state.focus > 80, 'recovers away from the beam');
    const shaky = praiseState(first.from + 30, praiseBeamX(first, 10));
    shaky.focus = 5;
    const { state, events } = run(shaky, .2);
    assert.equal(state.mode, 'focuslost');
    assert.ok(events.some(event => event.id === 'focus-lost'));
    assert.equal(state.deaths, 1);
});

/** Renders stage five parked in the Earth shadow, `t` seconds into the ending. */
function endingFrame(t) {
    const state = JSON.parse(fresh().serialize());
    Object.assign(state.orbit, { phase: 'parked', z: STAGE_FIVE.checkpoint.z, speed: 0, settled: 1 + t });
    const ctx = createRenderCtx({});
    Object.assign(ctx, { state: { ...state, player: state.p, spray: { burst: state.sprayBurst } }, t: 80 + t, W: 1000, H: 510 });
    drawOrbit(ctx);
    const layer = key => ctx.commands.filter(command => command.layer?.key === key);
    const labels = ctx.commands.filter(command => command.text).map(command => command.text.content);
    return { labels, layer };
}

test('parked in the Earth shadow, the ending clock counts on and the chair stays put', () => {
    const state = JSON.parse(fresh().serialize());
    Object.assign(state.orbit, { phase: 'parked', z: STAGE_FIVE.checkpoint.z, speed: 0, settled: 1 });
    const { state: after } = run(state, 2);
    assert.ok(Math.abs(after.orbit.settled - 3) < 1e-6);
    assert.equal(after.orbit.z, STAGE_FIVE.checkpoint.z);
});

test('the ending: horizon and nebula, the laptop goes dark, everything fades, then THE END', () => {
    const start = endingFrame(0), wide = endingFrame(10), out = endingFrame(15), end = endingFrame(20);
    assert.deepEqual(start.layer('orbit-nebula'), [], 'it starts from the shadow 5-3 ended in');
    assert.ok(start.labels.some(label => label.startsWith('Network')), 'the connection-lost bubble is up first');
    assert.ok(wide.layer('orbit-nebula').length > 0 && wide.layer('orbit-atmosphere-glow').length > 0);
    assert.ok(wide.layer('orbit-laptop-light').length > 0, 'the laptop still glows');
    assert.deepEqual(wide.layer('orbit-ending-black'), []);
    assert.deepEqual(out.layer('orbit-laptop-light'), [], 'the screen has gone dark');
    assert.ok(out.layer('orbit-ending-black').length === 1, 'fading out');
    assert.deepEqual(end.labels.filter(label => label === 'THE END'), ['THE END']);
    assert.deepEqual(wide.labels.filter(label => label === 'THE END'), []);
});

test('steering fades in during the entry instead of being locked out', () => {
    const state = JSON.parse(fresh().serialize());
    const at = age => orbitStep({ ...state.orbit, age }, state.p, ['right'], 1 / 120).p.vx;
    assert.ok(at(0) < at(STAGE_FIVE.entryTime * .3), 'the first tick barely steers');
    assert.ok(at(STAGE_FIVE.entryTime * .3) > 0, 'the chair already answers early in the entry');
    assert.ok(at(STAGE_FIVE.entryTime * .3) < at(STAGE_FIVE.entryTime * .9), 'and answers more as the entry goes on');
    const thrust = orbitStep({ ...state.orbit, age: .2 }, state.p, ['spray'], 1 / 120);
    assert.ok(thrust.orbit.speed <= STAGE_FIVE.cruise, 'thrust waits until the entry is over');
});

test('only the extinguisher moves the chair forward: it coasts to a crawl without spraying', () => {
    const coast = fresh(), spray = fresh();
    for (let i = 0; i < 120 * 6; i++) { coast.step(); spray.setInput('spray'); spray.step(); }
    const idle = coast.getSnapshot(), pushed = spray.getSnapshot();
    assert.ok(idle.orbit.speed < STAGE_FIVE.cruise * .2, `coasting slows to ${idle.orbit.speed.toFixed(1)}`);
    assert.equal(idle.spray.burst, 0, 'no plume while coasting');
    assert.ok(pushed.orbit.speed > STAGE_FIVE.cruise, 'spraying speeds the chair up');
    assert.ok(pushed.spray.burst > 0, 'the plume shows while spraying');
    assert.ok(pushed.orbit.z > idle.orbit.z + 600, 'and carries it much further');
});

const cruisingAt = (z, extra = {}) => ({ phase: 'door', age: 10, z, speed: STAGE_FIVE.cruise, rings: 0, settled: 0, coffee: 0, sip: 0, ...extra });
const still = (x = 0, y = 0) => ({ x, y, vx: 0, vy: 0, a: 0, w: 0 });
const hold = (orbit, p, keys, seconds) => {
    for (let i = 0; i < seconds * 120; i++) ({ orbit, p } = orbitStep(orbit, p, keys, 1 / 120));
    return { orbit, p };
};

test('steering answers at once and settles quickly when released', () => {
    const { speed } = STAGE_FIVE.steer;
    const quick = hold(cruisingAt(200), still(), ['right'], .35);
    assert.ok(quick.p.vx > speed * .9, `near full sideways speed after 0.35 s (${quick.p.vx.toFixed(0)})`);
    const settled = hold(quick.orbit, quick.p, [], .6);
    assert.ok(Math.abs(settled.p.vx) < speed * .1, 'and nearly stopped 0.6 s after letting go');
    assert.ok(settled.p.x > quick.p.x, 'drifting a little on before it stops');
});

test('the company geofence pushes back past the edge instead of a hard wall', () => {
    const { bounds, steer } = STAGE_FIVE;
    let state = { orbit: cruisingAt(200), p: still() }, furthest = 0;
    for (let i = 0; i < 10 * 120; i++) {
        state = orbitStep(state.orbit, state.p, ['right', 'forward'], 1 / 120);
        furthest = Math.max(furthest, state.p.x);
    }
    assert.ok(furthest > bounds.x, 'the chair can lean past the line');
    assert.ok(furthest <= bounds.x + steer.overshoot, 'but never further than the overshoot');
    assert.ok(state.p.vx >= 0 && state.p.vx < 1, 'held against the fence it comes to rest, not bounces');
    assert.ok(state.p.y > bounds.y && state.p.y <= bounds.y + steer.overshoot, 'the same up and down');
    const back = hold(state.orbit, state.p, [], 2);
    assert.ok(back.p.x <= bounds.x + 1 && back.p.y <= bounds.y + 1, 'let go, the fence eases it back inside');
});

test('a side beam sweeps up and down: only climbing or diving gets out of it', () => {
    const side = STAGE_FIVE.praise.beams.find(beam => beam.axis === 'y');
    assert.ok(side, 'one satellite shines in from the side');
    assert.ok(side.amplitude + side.halfWidth <= STAGE_FIVE.bounds.y + 100, 'its sweep stays within reach');
    const z = (side.from + side.to) / 2;
    const age = Array.from({ length: 400 }, (_, i) => 10 + i / 10).find(t => Math.abs(praiseBeamX(side, t)) < 20);
    // Other beams cross this stretch too: test across from where the down beams are shining at that moment.
    const downs = STAGE_FIVE.praise.beams.filter(beam => beam.axis === 'x' && z >= beam.from && z <= beam.to);
    const clear = x => downs.every(beam => Math.abs(x - praiseBeamX(beam, age)) >= beam.halfWidth);
    const xs = Array.from({ length: 33 }, (_, i) => -640 + i * 40).filter(clear);
    assert.ok(xs.length >= 2, 'there is a gap between the down beams');
    for (const x of [xs[0], xs.at(-1)]) assert.equal(praiseBeamOn(age, still(x, 0), z), side, `level with the beam it has the chair (x ${x})`);
    assert.equal(praiseBeamOn(age, still(xs[0], side.halfWidth + 60), z), null, 'climbing clear escapes it');
    const lit = orbitStep(cruisingAt(z, { age }), still(xs[0], 0), [], 1 / 120);
    assert.ok(Math.abs(lit.p.vy) > Math.abs(lit.p.vx), 'and it shoves the chair up or down');
});

test('flying through a coffee cup clears the head once; passing wide of it does nothing', () => {
    const [cup] = STAGE_FIVE.coffee.cups;
    const game = fresh();
    const state = JSON.parse(game.serialize());
    Object.assign(state.orbit, { phase: 'door', age: 10, z: cup.z - .5 });
    Object.assign(state.p, { x: cup.x, y: cup.y });
    state.focus = 50;
    const { state: after, events } = stepGame(state);
    assert.equal(after.orbit.coffee & 1, 1, 'the cup is drunk');
    assert.equal(after.focus, 50 + STAGE_FIVE.coffee.focus);
    assert.ok(after.orbit.sip > 0, 'the rider takes a sip');
    assert.ok(events.some(event => event.type === 'cue' && event.id === 'coffee'));
    const again = stepGame({ ...after, orbit: { ...after.orbit, z: cup.z - .5 } }).state;
    assert.equal(again.focus, after.focus, 'a drunk cup is gone');
    const wide = JSON.parse(game.serialize());
    Object.assign(wide.orbit, { phase: 'door', age: 10, z: cup.z - .5 });
    Object.assign(wide.p, { x: cup.x + STAGE_FIVE.coffee.reach + 40, y: cup.y });
    assert.equal(stepGame(wide).state.orbit.coffee, 0, 'out of reach, the cup floats by');
});

function flightFrame(setup) {
    const state = JSON.parse(fresh().serialize());
    Object.assign(state.orbit, { phase: 'door', age: 20, z: 700 });
    setup?.(state);
    const ctx = createRenderCtx({});
    Object.assign(ctx, { state: { ...state, player: state.p, spray: { burst: state.sprayBurst } }, t: 30, W: 1000, H: 510 });
    drawOrbit(ctx);
    return ctx.commands;
}

test('the geofence tape shows only near the edge, and speed lines only when fast', () => {
    const tape = commands => commands.filter(command => typeof command.c === 'string' && /^#(f2c230|2b2b2b)/.test(command.c));
    assert.equal(tape(flightFrame()).length, 0, 'none in the middle of the route');
    assert.ok(tape(flightFrame(state => { state.p.x = STAGE_FIVE.bounds.x; })).length > 10, 'tape along the edge the chair is at');
    const lines = commands => commands.filter(command => command.layer?.key === 'orbit-speed-lines');
    assert.equal(lines(flightFrame()).length, 0, 'none at cruise speed');
    assert.ok(lines(flightFrame(state => { state.orbit.speed = STAGE_FIVE.maxSpeed; })).length > 10, 'streaks flat out');
});

test('papers drift past on both sides of the chair and sort in depth with it', () => {
    const commands = flightFrame();
    // Near sheets keep their own colours (far ones are hazed); the casters mark where the chair is painted.
    const sheets = commands.map((command, i) => ({ command, i })).filter(({ command }) => typeof command.c === 'string' && /^#(f4efe2|f7d85c|d9b26a)ff$/.test(command.c));
    const chair = commands.findIndex(command => command.c === '#3f4650');
    assert.ok(sheets.length > 5, 'plenty of papers in view');
    const xs = sheets.map(({ command }) => command.v[0][0]);
    assert.ok(xs.some(x => x < 400) && xs.some(x => x > 600), 'on both sides');
    assert.ok(chair > 0 && sheets.some(({ i }) => i > chair), 'some pass nearer than the chair and are painted over it');
});
