import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { FOCUS_DAMAGE, ORBIT_ENDING, orbitEnding, createGame, orbitStep, praiseBeamX, praiseBeamOn, praiseSection, orbitPraise, praiseWarmth, createSkyProjection, STAGE_FIVE, stepGame, parseCommand, previewScenes, orbitKeys, drawOrbit, createRenderCtx, actionForKey, createRecorder, REPLAY_DEFAULTS, buildTimeline, seekTimeline } = await loadSource(`
    export { createRecorder, REPLAY_DEFAULTS, buildTimeline, seekTimeline } from './src/game/replay';
    export { FOCUS_DAMAGE } from './src/game/level';
    export { actionForKey } from './src/ui/controls';
    export { createGame, stepGame } from './src/game/game';
    export { orbitStep, praiseBeamX, praiseBeamOn, praiseSection } from './src/game/stages/orbit/course/decide';
    export { orbitPraise, praiseWarmth } from './src/render/scene/orbit-praise';
    export { createSkyProjection } from './src/render/scene/sky-projection';
    export { STAGE_FIVE } from './src/game/stages/orbit/data';
    export { parseCommand } from './src/game/commands';
    export { previewScenes, orbitKeys } from './src/preview-scenes';
    export { drawOrbit } from './src/render/scene/orbit';
    export { ORBIT_ENDING, orbitEnding } from './src/render/scene/orbit-ending';
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
    // The light spreads out away from the satellite: check it at every height the chair can reach.
    const { bounds, steer: { overshoot } } = STAGE_FIVE;
    const reaches = beam => beam.axis === 'y' ? [-1, 1].map(s => s * (bounds.x + overshoot)) : [-1, 1].map(s => s * (bounds.y + overshoot));
    const slices = beam => reaches(beam).map(reach => praiseSection(beam, 0, reach));
    assert.ok(beams.every(beam => slices(beam).every(slice => slice.scale > 0 && slice.to <= STAGE_FIVE.heights.shadow)));
    const steer = STAGE_FIVE.steer.speed;
    assert.ok(beams.every(beam => slices(beam).every(slice => beam.amplitude * beam.rate * slice.scale < steer)), 'the chair can always outrun a sweep');
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
    assert.ok(state.focus >= 100 - 2 * FOCUS_DAMAGE.praise, 'at most one hit per second');
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
/** The ending's progress `t` seconds in. */
const orbitEndingState = t => orbitEnding({ phase: 'parked', age: 0, z: 0, speed: 0, rings: 0, settled: 1 + t });

function endingFrame(t) {
    const state = JSON.parse(fresh().serialize());
    Object.assign(state.orbit, { phase: 'parked', z: STAGE_FIVE.checkpoint.z, speed: 0, settled: 1 + t });
    const ctx = createRenderCtx({});
    Object.assign(ctx, { state: { ...state, player: state.p, spray: { burst: state.sprayBurst } }, t: 80 + t, W: 1000, H: 510 });
    drawOrbit(ctx);
    const layer = key => ctx.commands.filter(command => command.layer?.key === key);
    const labels = ctx.commands.filter(command => command.text).map(command => command.text.content);
    return { labels, layer, commands: ctx.commands, height: ctx.H };
}

test('parked in the Earth shadow, the ending clock counts on and the chair stays put', () => {
    const state = JSON.parse(fresh().serialize());
    Object.assign(state.orbit, { phase: 'parked', z: STAGE_FIVE.checkpoint.z, speed: 0, settled: 1 });
    const { state: after } = run(state, 2);
    assert.ok(Math.abs(after.orbit.settled - 3) < 1e-6);
    assert.equal(after.orbit.z, STAGE_FIVE.checkpoint.z);
});

test('the ending: the extinguisher floats off, the signal drops bar by bar, the network goes, then THE END', () => {
    const { release, signal, signalStep, disconnect } = ORBIT_ENDING;
    const at = t => endingFrame(t);
    // The extinguisher's red body on screen, or null once it has floated out of the picture.
    const extinguisher = frame => {
        const points = frame.commands.filter(command => command.c === '#b75f4a' || command.c === '#c7765c').flatMap(command => command.v)
            .filter(([x, y]) => x > 0 && x < 1000 && y > 0 && y < frame.height);
        return points.length ? points : null;
    };
    assert.ok(!at(0).labels.some(label => label.startsWith('Network')), 'no network message straight away');
    assert.ok(extinguisher(at(release + .1)), 'the extinguisher is still in the picture as it comes off');
    assert.equal(extinguisher(at(release + 6)), null, 'and it has floated away out of the picture');
    const bars = frame => frame.layer('orbit-signal').filter(command => command.stroke?.color === '#ffffff').length;
    assert.deepEqual(at(signal - 2).layer('orbit-signal'), [], 'no signal icon before it starts to drop');
    assert.equal(bars(at(signal + .1)), 3);
    assert.ok(bars(at(signal + signalStep * 1.2)) < 3 && bars(at(signal + signalStep * 2.2)) < bars(at(signal + signalStep * 1.2)), 'losing bars one by one');
    assert.ok(at(disconnect + .5).labels.some(label => label.startsWith('Network')), 'then the network is lost');
    const wide = at(ORBIT_ENDING.wide - 1), out = at(ORBIT_ENDING.lightsOut + 1), end = at(ORBIT_ENDING.end);
    assert.ok(wide.layer('orbit-nebula').length > 0 && wide.layer('orbit-laptop-light').length > 0, 'the laptop still glows under the nebula');
    assert.deepEqual(out.layer('orbit-laptop-light'), [], 'the screen has gone dark');
    assert.ok(out.layer('orbit-ending-black').length === 1, 'fading out');
    assert.deepEqual(end.labels.filter(label => label === 'THE END'), ['THE END']);
    assert.deepEqual(wide.labels.filter(label => label === 'THE END'), []);
});

test('after the network is lost the camera circles the chair once, all the way round, with the sky turning too', () => {
    const { disconnect, spinFrom, spin } = ORBIT_ENDING;
    assert.ok(spinFrom > disconnect, 'the circle starts once the network is gone');
    // The rider's blue lenses are on the front of the face: hidden from behind, seen once the camera comes round.
    const glasses = t => endingFrame(t).commands.some(command => command.c === '#83c8e4');
    assert.equal(glasses(spinFrom), false, 'it starts from behind');
    const round = Array.from({ length: 9 }, (_, i) => spinFrom + (spin - spinFrom) * (i + 1) / 10).map(glasses);
    assert.ok(round.filter(Boolean).length >= 2, `the rider's face comes into view on the way round (${round})`);
    // The camera ends behind where it started, but the chair has swivelled half round to face it.
    assert.equal(glasses(spin), true, 'and the chair ends turned towards the camera, the rider still on his screen');
    const stars = t => endingFrame(t).commands.filter(command => typeof command.c === 'string' && command.c.startsWith('#ffffff') && command.v.length === 4 && !command.layer).map(command => command.v[0][0]);
    assert.notDeepEqual(stars(spinFrom), stars((spinFrom + spin) / 2), 'the stars swing past');
});

test('the lost connection comes up on the laptop screen, his hands stop, and for a moment nothing moves', () => {
    const { disconnect, handsStop, idle } = ORBIT_ENDING;
    const before = endingFrame(disconnect - .5), after = endingFrame(disconnect + 1);
    assert.ok(before.layer('orbit-laptop-screen').length === 0 || !before.labels.some(label => label.startsWith('Network')));
    assert.equal(after.labels.join(' '), 'Network connection lost.', 'the message is written on the laptop screen');
    assert.equal(after.labels.length, 2, 'in two lines, so it can be large enough to read');
    assert.deepEqual(after.layer('attendance-bubble'), [], 'not in a speech bubble over his head');
    const state = t => orbitEndingState(t);
    assert.equal(state(disconnect - .2).rest, 0, 'typing until the message');
    assert.equal(state(disconnect + 1).rest, 1, 'then the hands come off the keys');
    assert.equal(state(handsStop - .1).still, 0);
    assert.ok(state(handsStop + 1).still > 0, 'and stay where they stopped');
    for (const t of [handsStop + .2, (handsStop + idle) / 2, idle - .1]) {
        const e = state(t);
        assert.ok(e.focus === 1 && e.wide === 0 && e.spin === 0, `a held moment of nothing at ${t}`);
    }
});

test('the chair swivels and leans back to look out while he keeps his eyes on the dead screen', () => {
    const { spinFrom, spin } = ORBIT_ENDING;
    const mid = orbitEndingState((spinFrom + spin) / 2);
    assert.ok(mid.swivel > .3 && mid.swivel < .7 && mid.recline > .9, 'turning round and leaning back');
    assert.ok(mid.rest === 1 && mid.still > 0, 'his hands still off the keys');
    assert.equal(orbitEndingState(spinFrom - .5).swivel, 0);
});

test('the camera pushes in on the laptop so the message is large enough to read', () => {
    const { disconnect } = ORBIT_ENDING;
    const lineSize = t => Math.max(0, ...endingFrame(t).commands.filter(command => command.text).map(command => command.text.size));
    assert.ok(orbitEndingState(disconnect - .5).read === 0 && orbitEndingState(disconnect + 1).read === 1);
    assert.ok(lineSize(disconnect + 1.5) >= 18, `message lines are at least 18 px on a 510 px tall frame (${lineSize(disconnect + 1.5).toFixed(1)})`);
});

test('the rider works on a laptop, not a monitor: a keyboard base under his hands and a thin lid with the screen', () => {
    const over = endingFrame(ORBIT_ENDING.focus + 1);
    // Faces seen at an angle are shaded a few percent, so match colours closely rather than exactly.
    const rgb = color => [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
    const near = (color, target) => typeof color === 'string' && color.length >= 7
        && rgb(color).every((channel, i) => Math.abs(channel - rgb(target)[i]) <= 8);
    for (const [color, part] of [['#3c4350', 'keyboard'], ['#6b7486', 'trackpad'], ['#a8b9c3', 'screen']]) {
        assert.ok(over.commands.some(command => near(command.c, color)), `the ${part} shows over his shoulder`);
    }
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

const cruisingAt = (z, extra = {}) => ({ phase: 'door', age: 10, z, speed: STAGE_FIVE.cruise, rings: 0, settled: 0, ...extra });
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

function flightFrame(setup) {
    const state = JSON.parse(fresh().serialize());
    Object.assign(state.orbit, { phase: 'door', age: 20, z: 700 });
    setup?.(state);
    const ctx = createRenderCtx({});
    Object.assign(ctx, { state: { ...state, player: state.p, spray: { burst: state.sprayBurst } }, t: 30, W: 1000, H: 510 });
    drawOrbit(ctx);
    return ctx.commands;
}

test('the edge of the play area shows on the chair itself, and speed lines only when fast', () => {
    const tape = commands => commands.filter(command => typeof command.c === 'string' && /^#(f2c230|2b2b2b)/.test(command.c));
    const puffs = commands => commands.filter(command => typeof command.c === 'string' && command.c.startsWith('#f6e6df')).length;
    const casters = commands => {
        const xs = commands.filter(command => command.c === '#3f4650').flatMap(command => command.v.map(([x]) => x));
        return xs.reduce((sum, x) => sum + x, 0) / xs.length;
    };
    const middle = flightFrame(), inside = flightFrame(state => { state.p.x = STAGE_FIVE.bounds.x - 100; });
    const pressing = flightFrame(state => { state.p.x = STAGE_FIVE.bounds.x + STAGE_FIVE.steer.overshoot; });
    assert.equal(tape(pressing).length, 0, 'nothing is hung in the sky to mark it');
    assert.ok(puffs(pressing) > puffs(inside) + 3, 'the extinguisher coughs outward to push back in');
    assert.ok(casters(pressing) - casters(inside) > 40, 'the camera stops at the edge, so the chair slides toward the side');
    assert.ok(Math.abs(casters(middle) - 500) < 30, 'centred in the middle of the route');
    const lines = commands => commands.filter(command => command.layer?.key === 'orbit-speed-lines');
    assert.equal(lines(middle).length, 0, 'no speed lines at cruise speed');
    assert.ok(lines(flightFrame(state => { state.orbit.speed = STAGE_FIVE.maxSpeed; })).length > 10, 'streaks flat out');
});

test('rushing forward pulls the camera back and streams air round the chair', () => {
    const casters = commands => {
        const points = commands.filter(command => command.c === '#3f4650').flatMap(command => command.v);
        const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
        return { width: Math.max(...xs) - Math.min(...xs), y: (Math.max(...ys) + Math.min(...ys)) / 2 };
    };
    const air = commands => commands.filter(command => command.layer?.key === 'orbit-slipstream');
    const frame = (speed, burst) => flightFrame(state => { state.orbit.speed = speed; state.sprayBurst = burst; });
    const slow = frame(STAGE_FIVE.cruise * .4, 0), cruise = frame(STAGE_FIVE.cruise, 0), rushing = frame(STAGE_FIVE.maxSpeed, .24);
    assert.ok(casters(rushing).width < casters(cruise).width * .92, 'the chair looks smaller as the camera falls back');
    assert.ok(Math.abs(casters(rushing).y - casters(cruise).y) < 20, 'but stays at the same height on screen');
    assert.equal(air(slow).length, 0, 'no air streaks at a crawl');
    assert.ok(air(rushing).length > 10, 'streaks flat out');
    const strength = commands => air(commands).reduce((sum, command) => sum + parseInt(command.c.slice(7), 16), 0);
    assert.ok(strength(rushing) > strength(frame(STAGE_FIVE.maxSpeed, 0)), 'stronger while the extinguisher pushes');
});

test('the Earth sits below the chair: its horizon dips under eye level and curves more the higher it climbs', async () => {
    const { orbitEarth, earthAltitude, groundTrack } = await loadSource(`export { orbitEarth, earthAltitude, groundTrack } from './src/render/scene/orbit-earth';`);
    const level = { cx: 500, cy: 189, focal: 841, roll: 0, pitch: 0 };
    const horizon = z => {
        const ctx = createRenderCtx({});
        Object.assign(ctx, { W: 1000, H: 510, t: 0, commands: [] });
        orbitEarth(ctx, z, level, 0, 1, 0);
        return ctx.commands.find(command => command.layer?.key === 'orbit-earth-limb').v;
    };
    const { air, space, shadow } = STAGE_FIVE.heights;
    assert.ok(earthAltitude(air) < earthAltitude(space) && earthAltitude(space) < earthAltitude(shadow), 'climbing all the way');
    const low = horizon(space), high = horizon(shadow);
    const middle = line => line[Math.floor(line.length / 2)][1];
    assert.ok(middle(low) > level.cy && middle(high) > middle(low), 'below eye level, lower the higher it is');
    const sag = line => line.find(([x]) => x > 1000)[1] - middle(line);
    assert.ok(sag(low) > 0 && sag(high) > sag(low), 'curving down toward the sides, more so higher up');
    const [lon, lat] = groundTrack(STAGE_FIVE.checkpoint.z);
    assert.ok(lat < 37.5 && Math.abs(lon - 127) < 3, 'the flight ends south of Seoul, looking north at it');
});

test('in the ending Seoul glows on the night side ahead', () => {
    const night = endingFrame(.5);
    const lights = night.layer('orbit-earth-lights').filter(command => command.c === '#fff6dc');
    assert.ok(lights.length > 5, 'city lights are on');
    assert.ok(lights.some(({ v }) => v.every(([x, y]) => x > 0 && x < 1000 && y > 0 && y < 510)), 'and on screen');
});

test('glows and streaks of a kind share one layer, so each is a single ThorVG Scene', () => {
    const frame = flightFrame(state => { state.orbit.speed = STAGE_FIVE.maxSpeed; state.orbit.z = 700; });
    const runs = key => {
        let count = 0, last = null;
        for (const command of frame) {
            const layer = command.layer?.key === key ? command.layer : null;
            if (layer && layer !== last) count++;
            last = layer;
        }
        return count;
    };
    assert.ok(frame.some(command => command.layer?.key === 'orbit-speed-lines'), 'streaks are drawn flat out');
    for (const key of ['orbit-speed-lines', 'orbit-cctv-rec', 'orbit-cctv-light', 'orbit-robot-eye']) assert.ok(runs(key) <= 1, `${key} is one layer run`);
});

test('a praise beam is drawn where it pushes, at every height, and nothing of it nearer than the chair', () => {
    const beam = STAGE_FIVE.praise.beams[1];
    // A moment when the beam lies off to the right, so its right edge is an outline of the drawn light.
    const age = Array.from({ length: 600 }, (_, i) => i / 10).find(t => Math.abs(praiseBeamX(beam, t) - 300) < 20);
    const travel = beam.satellite.z + 200;
    const view = createSkyProjection(1000, 510, 1, { distance: 690 });
    const point = (x, y, z) => [z - travel, 15 + y, x];
    const ctx = createRenderCtx({});
    Object.assign(ctx, { W: 1000, H: 510, t: 0 });
    orbitPraise(ctx, view, point, age, travel);
    const lights = ctx.commands.filter(command => command.layer?.key === 'orbit-praise-beam');
    const inside = (polygon, [x, y]) => polygon.every((a, i) => {
        const b = polygon[(i + 1) % polygon.length];
        return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) >= 0;
    }) || polygon.every((a, i) => {
        const b = polygon[(i + 1) % polygon.length];
        return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) <= 0;
    });
    const at = (x, y) => view.project(point(x, y, travel + 1));
    const light = lights.find(command => inside(command.v, at(praiseSection(beam, age, 0).centre, 0)));
    assert.ok(light, 'the beam is drawn');
    for (const y of [-400, 0, 400]) {
        const slice = praiseSection(beam, age, y), edge = slice.centre + slice.halfWidth;
        assert.equal(praiseBeamOn(age, { x: edge - 30, y }, travel + 1), beam);
        assert.notEqual(praiseBeamOn(age, { x: edge + 30, y }, travel + 1), beam);
        assert.ok(inside(light.v, at(edge - 30, y)), `lit just inside its edge at height ${y}`);
        assert.ok(!inside(light.v, at(edge + 30, y)), `dark just outside it at height ${y}`);
    }
    assert.ok(praiseSection(beam, age, 400).halfWidth < praiseSection(beam, age, -400).halfWidth, 'it spreads out below the satellite');
    // Cut at the chair: the satellite's lens is behind the chair now, so the light no longer reaches up to it.
    assert.ok(!inside(light.v, view.project(point(beam.satellite.x, beam.satellite.y - STAGE_FIVE.praise.lens, beam.satellite.z))));
});

test('the chair catches the light: warming near a beam, glowing inside it, plain far from it', () => {
    const beam = STAGE_FIVE.praise.beams[1], age = 20, z = beam.satellite.z;
    const slice = praiseSection(beam, age, 0), edge = slice.centre + slice.halfWidth;
    const warmth = x => praiseWarmth(age, { x, y: 0 }, z).warmth;
    assert.equal(praiseBeamOn(age, { x: edge - 10, y: 0 }, z), beam);
    assert.equal(warmth(edge - 10), 1, 'inside, exactly where the course says it is lit');
    assert.ok(warmth(edge + 40) > 0 && warmth(edge + 40) < 1, 'warming just outside the edge');
    assert.ok(warmth(edge + 40) > warmth(edge + 100), 'more the nearer it gets');
    const far = edge + 400;
    if (praiseBeamOn(age, { x: far, y: 0 }, z) === null) assert.ok(warmth(far) < warmth(edge + 40));
    const glow = x => flightFrame(state => { Object.assign(state.orbit, { z, age }); Object.assign(state.p, { x, vx: 0 }); })
        .filter(command => command.c?.radius && command.c.stops?.[0]?.[1]?.[0] === 255 && command.c.stops[0][1][1] === 224).length;
    assert.ok(glow(edge - 10) > 0, 'a warm glow round the chair inside the light');
});
