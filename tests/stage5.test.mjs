import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { FOCUS_DAMAGE, ORBIT_ENDING, orbitEnding, createGame, orbitStep, gearAt, satelliteLightOn, satelliteLightStage, orbitSatelliteLight, satelliteLightWarmth, createSkyProjection, STAGE_FIVE, stepGame, parseCommand, previewScenes, orbitKeys, drawOrbit, createRenderCtx, actionForKey, createRecorder, REPLAY_DEFAULTS, buildTimeline, seekTimeline } = await loadSource(`
    export { createRecorder, REPLAY_DEFAULTS, buildTimeline, seekTimeline } from './src/game/replay';
    export { FOCUS_DAMAGE } from './src/game/level';
    export { actionForKey } from './src/ui/controls';
    export { createGame, stepGame } from './src/game/game';
    export { orbitStep, gearAt, satelliteLightOn } from './src/game/stages/orbit/course/decide';
    export { orbitSatelliteLight, satelliteLightStage, satelliteLightWarmth } from './src/render/scene/orbit-satellite-light';
    export { createSkyProjection } from './src/render/scene/sky-projection';
    export { STAGE_FIVE } from './src/game/stages/orbit/data';
    export { parseCommand } from './src/game/commands';
    export { previewScenes, orbitKeys } from './src/preview-scenes';
    export { drawOrbit } from './src/render/scene/orbit';
    export { ORBIT_ENDING, orbitEnding } from './src/render/scene/orbit-ending';
    export { createRenderCtx } from './src/render/context';
`);
const fresh = () => { const game = createGame({ seed: 55 }); game.startStage(5); return game; };

test('the arrow keys move the chair straight across and up, and it speeds up on its own', () => {
    const game = fresh();
    for (let i = 0; i < 360; i++) game.step();
    game.setInput('right', 'forward');
    for (let i = 0; i < 100; i++) game.step();
    const moving = JSON.parse(game.serialize());
    assert.ok(moving.p.x > 0 && moving.p.y > 0 && moving.orbit.speed > STAGE_FIVE.cruise);
    const coast = orbitStep(moving.orbit, moving.p, [], .1);
    const thrust = orbitStep(moving.orbit, moving.p, ['spray'], .1);
    assert.ok(coast.p.x > moving.p.x && coast.p.y > moving.p.y);
    assert.ok(coast.orbit.speed >= moving.orbit.speed && thrust.orbit.speed === coast.orbit.speed, 'Space changes nothing');
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

test('no satellite light reaches into the Earth shadow, every edge is slower than the chair, and each gear is busier', () => {
    const { beams, chairRadius } = STAGE_FIVE.satelliteLight, { bounds, steer, gears } = STAGE_FIVE;
    assert.ok(beams.every(beam => beam.to <= STAGE_FIVE.autopilot.from - 300), 'a quiet stretch before the shadow');
    const { lock } = STAGE_FIVE.satelliteLight;
    for (const beam of beams) {
        // From a standing start the chair covers about 85% of its full speed over the second after a lock.
        const escape = Math.min(beam.half.x, beam.half.y) + chairRadius;
        assert.ok(escape < steer.speed * lock * .85, `a locked rectangle can be left in time (${escape})`);
        assert.ok(beam.half.x + chairRadius < bounds.x || beam.half.y + chairRadius < bounds.y, 'and there is room beside it on the plane');
    }
    assert.ok(gears.every((gear, i) => i === 0 || gear.maxSpeed > gears[i - 1].maxSpeed), 'every gear is faster');
    // Seconds from one beam to the next at each gear's top speed: they come closer together gear by gear.
    const gaps = gears.map((gear, i) => {
        const inGear = beams.filter(beam => gearAt(beam.from).index === i);
        const seconds = inGear.slice(1).map((beam, k) => (beam.from - inGear[k].from) / gear.maxSpeed);
        return seconds.reduce((sum, gap) => sum + gap, 0) / seconds.length;
    });
    assert.ok(gaps[0] > gaps[1] && gaps[1] > gaps[2], `beams come closer together (${gaps.map(gap => gap.toFixed(1)).join(', ')} s)`);
    assert.ok(chairRadius > 0);
});

test('saved orbit movement resumes exactly and pause freezes it', () => {
    const game = fresh();
    game.setInput('right', 'forward');
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
        const commands = ctx.commands;
        if (frame.state.orbit.phase === 'parked' && orbitEnding(frame.state.orbit).dark >= 1) {
            assert.ok(commands.some(cmd => cmd.layer?.key === 'orbit-ending-black'), 'the opaque ending card remains visible');
            assert.ok(commands.some(cmd => cmd.text?.content === 'THE END'), 'the ending title remains visible');
        } else {
            assert.ok(commands.length > 200);
            assert.ok(commands.reduce((n,c) => n+(c.curves?.length ?? 0), 0) <= 5000, 'cloud entry stays within its curve budget');
            assert.ok(commands.filter(c => c.c && typeof c.c === 'object').length <= 140, 'cloud entry stays within its gradient budget');
            assert.ok(commands.some(cmd => cmd.curves), 'clouds use vector curves');
        }
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
function satelliteLightState(z, x, age = 10) {
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

test('5-1: each second under the satellite light costs focus, and it does not come back meanwhile', () => {
    const first = STAGE_FIVE.satelliteLight.beams[0], z = first.from + 30;
    const { state } = run(satelliteLightState(z, 0), 1.5);
    assert.ok(state.focus < 100, `focus ${state.focus}`);
    assert.ok(state.focus >= 100 - 2 * FOCUS_DAMAGE.satelliteLight, 'at most one hit per second');
    assert.equal(state.focusNotice?.kind, 'satelliteLight');
    assert.equal(state.deaths, 0);
});

test('5-1: outside the beam focus recovers, and running out of focus ends the attempt', () => {
    const first = STAGE_FIVE.satelliteLight.beams[0];
    // Past the last beam, before the shadow.
    const calm = satelliteLightState(STAGE_FIVE.satelliteLight.beams.at(-1).to + 60, 0);
    calm.focus = 80;
    assert.ok(run(calm, 2.1).state.focus > 80, 'recovers away from the beams');
    const shaky = satelliteLightState(first.from + 30, 0);
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
    const glide = orbitStep({ ...state.orbit, age: .2 }, state.p, [], 1 / 120);
    assert.ok(glide.orbit.speed <= STAGE_FIVE.cruise, 'the glide carries it until the entry is over');
});

test('the chair flies on by itself: the extinguisher fires and speeds it up to its gear\'s top speed', () => {
    const game = fresh();
    for (let i = 0; i < 120 * 2.5; i++) game.step();
    const flying = game.getSnapshot();
    assert.equal(flying.orbit.speed, STAGE_FIVE.gears[0].maxSpeed, `top speed with no keys held (${flying.orbit.speed.toFixed(1)})`);
    assert.ok(flying.spray.burst > 0, 'the plume shows all the while');
    let state = { orbit: cruisingAt(STAGE_FIVE.gears[2].from + 300, { speed: STAGE_FIVE.gears[1].maxSpeed }), p: still(-STAGE_FIVE.bounds.x, 0) };
    state = hold(state.orbit, state.p, [], 1);
    assert.ok(state.orbit.speed > STAGE_FIVE.gears[1].maxSpeed, 'and faster again in the next gear');
});

const cruisingAt = (z, extra = {}) => ({ phase: 'door', age: 10, z, speed: STAGE_FIVE.cruise, rings: 0,
    aims: STAGE_FIVE.satelliteLight.beams.map(() => ({ x: 0, y: 0 })), settled: 0, ...extra });
const still = (x = 0, y = 0) => ({ x, y, vx: 0, vy: 0, a: 0, w: 0 });
const hold = (orbit, p, keys, seconds) => {
    for (let i = 0; i < seconds * 120; i++) ({ orbit, p } = orbitStep(orbit, p, keys, 1 / 120));
    return { orbit, p };
};

test('moving answers at once, settles quickly when released, and nothing moves the chair on its own', () => {
    const { speed } = STAGE_FIVE.steer;
    const quick = hold(cruisingAt(200), still(), ['right'], .35);
    assert.ok(quick.p.vx > speed * .9, `near full speed across after 0.35 s (${quick.p.vx.toFixed(0)})`);
    const settled = hold(quick.orbit, quick.p, [], .6);
    assert.ok(Math.abs(settled.p.vx) < speed * .1, 'and nearly stopped 0.6 s after letting go');
    assert.ok(settled.p.x > quick.p.x, 'sliding a little further before it stops');
    // Let go, it stays where it is: flying on never drifts it across.
    const calm = hold(settled.orbit, settled.p, [], 1), on = hold(calm.orbit, calm.p, [], 1);
    assert.ok(Math.abs(on.p.x - calm.p.x) < 2 && on.orbit.z > calm.orbit.z, 'it flies straight on toward the shadow');
    const up = hold(cruisingAt(200), still(), ['forward'], .35), down = hold(cruisingAt(200), still(), ['back'], .35);
    assert.ok(up.p.vy > speed * .9 && down.p.vy < -speed * .9, 'up and down answer the same way');
});

test('in the Earth shadow the autopilot takes over and flies the chair in, whatever the keys say', () => {
    const { autopilot, checkpoint, bounds } = STAGE_FIVE;
    // Arriving in a corner, slow, with the player still holding left and climbing.
    let state = { orbit: cruisingAt(autopilot.from, { speed: 40 }), p: still(bounds.x, bounds.y) };
    let seconds = 0;
    while (state.orbit.phase !== 'parked' && seconds < 20) {
        state = orbitStep(state.orbit, state.p, ['left', 'forward'], 1 / 120);
        seconds += 1 / 120;
    }
    assert.equal(state.orbit.phase, 'parked', 'it parks in the shadow');
    assert.ok(seconds < 8, `and soon (${seconds.toFixed(1)} s)`);
    assert.equal(state.orbit.z, checkpoint.z);
    assert.ok(state.p.x >= bounds.x - 5, 'the keys no longer move it');
    const before = orbitStep(cruisingAt(autopilot.from - 200), still(), ['left'], 1 / 120);
    assert.ok(before.p.vx < 0, 'before the shadow the keys still steer');
});

test('the company geofence (the viewfinder) pushes back past the edge', () => {
    const { bounds, steer } = STAGE_FIVE;
    let state = { orbit: cruisingAt(200, { speed: STAGE_FIVE.gears[0].maxSpeed }), p: still() }, furthest = 0, highest = 0;
    for (let i = 0; i < 4 * 120; i++) {
        state = orbitStep(state.orbit, state.p, ['right', 'forward'], 1 / 120);
        furthest = Math.max(furthest, state.p.x);
        highest = Math.max(highest, state.p.y);
    }
    assert.ok(furthest > bounds.x && furthest <= bounds.x + steer.overshoot, 'the chair can lean past the line, never further than the overshoot');
    assert.ok(highest > bounds.y && highest <= bounds.y + steer.overshoot, 'the same at the top');
    const away = hold(state.orbit, state.p, [], 2);
    assert.ok(away.p.x <= bounds.x + 1 && away.p.y <= bounds.y + 1, 'let go, the fence eases it back inside');
});

test('a satellite follows the chair, locks on a second ahead, and moving away in time escapes it', () => {
    const beam = STAGE_FIVE.satelliteLight.beams[0], { warn, lock, chairRadius } = STAGE_FIVE.satelliteLight, top = STAGE_FIVE.gears[0].maxSpeed;
    const fly = keysAt => {
        let state = { orbit: cruisingAt(beam.from - top * (warn + .5), { speed: top }), p: still(-150, 0) }, lockedAt = null, lit = false;
        while (state.orbit.z < beam.from + 100) {
            const arrival = (beam.from - state.orbit.z) / state.orbit.speed;
            state = orbitStep(state.orbit, state.p, keysAt(arrival), 1 / 120);
            if (arrival <= lock && !lockedAt) lockedAt = { ...state.orbit.aims[0] };
            if (lockedAt && arrival > 0) assert.deepEqual(state.orbit.aims[0], lockedAt, 'once locked it holds still');
            lit ||= satelliteLightOn(state.orbit, state.p, state.orbit.z) === beam;
        }
        return { state, lockedAt, lit };
    };
    const still_ = fly(() => []);
    assert.ok(Math.abs(still_.lockedAt.x + 150) < 5, `it aimed where the chair was (${still_.lockedAt.x.toFixed(0)})`);
    assert.ok(still_.lit, 'staying put is a hit');
    const dodged = fly(arrival => arrival <= lock ? ['right'] : []);
    assert.ok(!dodged.lit, 'leaving as soon as it locks gets clear in time');
    assert.ok(dodged.state.p.x > dodged.lockedAt.x + beam.half.x + chairRadius, 'clear of the rectangle');
});

function flightFrame(setup) {
    const state = JSON.parse(fresh().serialize());
    // Just before the first beam: it is announced, but the chair is not in it.
    Object.assign(state.orbit, { phase: 'door', age: 20, z: 300 });
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
    const top = STAGE_FIVE.gears[0].maxSpeed;
    const pressing = flightFrame(state => { state.p.x = STAGE_FIVE.bounds.x + STAGE_FIVE.steer.overshoot; });
    assert.equal(tape(pressing).length, 0, 'nothing is hung in the sky to mark it');
    assert.ok(puffs(pressing) > puffs(inside) + 3, 'the extinguisher coughs outward to push back in');
    assert.ok(Math.abs(casters(middle) - 500) < 30, 'the chair starts in the middle');
    assert.ok(casters(inside) > casters(middle) + 120 && casters(pressing) > casters(inside), 'the camera follows only a little, so the chair moves across the frame');
    // The viewfinder brackets are the fence: even pressing on it, all four corners stay on screen.
    const brackets = pressing.filter(command => command.layer?.key === 'orbit-viewfinder' && command.stroke);
    assert.equal(brackets.length, 4, 'four corner brackets');
    assert.ok(brackets.every(command => command.v.every(([x, y]) => x > 0 && x < 1000 && y > 0 && y < 510)), 'all on screen');
    const lines = commands => commands.filter(command => command.layer?.key === 'orbit-speed-lines');
    assert.equal(lines(middle).length, 0, 'no speed lines at cruise speed');
    assert.ok(lines(flightFrame(state => { state.orbit.speed = top; })).length > 10, 'streaks flat out');
});

test('rushing forward pulls the camera back and streams air round the chair, more in each gear', () => {
    const casters = commands => {
        const points = commands.filter(command => command.c === '#3f4650').flatMap(command => command.v);
        const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
        return { width: Math.max(...xs) - Math.min(...xs), y: (Math.max(...ys) + Math.min(...ys)) / 2 };
    };
    const air = commands => commands.filter(command => command.layer?.key === 'orbit-slipstream');
    const frame = (speed, burst, z = 300) => flightFrame(state => { Object.assign(state.orbit, { speed, z }); state.sprayBurst = burst; });
    const third = STAGE_FIVE.gears[2], z3 = third.from + 400;
    const slow = frame(STAGE_FIVE.cruise * .4, 0), cruise = frame(STAGE_FIVE.cruise, 0, z3), rushing = frame(third.maxSpeed, .24, z3);
    assert.ok(casters(rushing).width < casters(cruise).width * .9, 'the chair looks smaller as the camera falls back');
    assert.ok(Math.abs(casters(rushing).y - casters(cruise).y) < 30, 'but stays near the same height on screen');
    const first = frame(STAGE_FIVE.gears[0].maxSpeed, .24);
    assert.ok(casters(rushing).width < casters(first).width * .92, 'flat out in third gear the camera is further back than in first');
    assert.ok(air(rushing).reduce((sum, c) => sum + parseInt(c.c.slice(7), 16), 0) > air(first).reduce((sum, c) => sum + parseInt(c.c.slice(7), 16), 0), 'and the air streams harder');
    assert.equal(air(slow).length, 0, 'no air streaks at a crawl');
    assert.ok(air(rushing).length > 10, 'streaks flat out');
    const strength = commands => air(commands).reduce((sum, command) => sum + parseInt(command.c.slice(7), 16), 0);
    assert.ok(strength(rushing) > strength(frame(third.maxSpeed, 0, z3)), 'stronger while the extinguisher pushes');
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
    // Turning the view to the right slides the ground left, the same way as the sky panorama and the scenery.
    // Followed by the first city light on the night side below.
    const ground = spin => {
        const ctx = createRenderCtx({});
        Object.assign(ctx, { W: 1000, H: 510, t: 0, commands: [] });
        orbitEarth(ctx, STAGE_FIVE.checkpoint.z, { ...level, pitch: .4 }, 0, 1, 1, spin);
        const light = ctx.commands.find(command => command.layer?.key === 'orbit-earth-lights');
        return light.v.reduce((sum, [x]) => sum + x, 0) / light.v.length;
    };
    assert.ok(ground(.05) < ground(0) - 10, `the ground slides left as the view turns right (${ground(0).toFixed(0)} to ${ground(.05).toFixed(0)})`);
});

test('in the ending Seoul glows on the night side ahead', () => {
    const night = endingFrame(.5);
    const lights = night.layer('orbit-earth-lights').filter(command => command.c === '#fff6dc');
    assert.ok(lights.length > 5, 'city lights are on');
    assert.ok(lights.some(({ v }) => v.every(([x, y]) => x > 0 && x < 1000 && y > 0 && y < 510)), 'and on screen');
});

test('glows and streaks of a kind share one layer, so each is a single ThorVG Scene', () => {
    const frame = flightFrame(state => { state.orbit.speed = STAGE_FIVE.gears[0].maxSpeed; state.orbit.z = 300; });
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

test('a beam is announced, then drawn on the chair\'s plane exactly where it touches the chair', () => {
    const beam = STAGE_FIVE.satelliteLight.beams[0], { chairRadius, warn, lock } = STAGE_FIVE.satelliteLight, speed = 200;
    const view = createSkyProjection(1000, 510, 1, { distance: 820 });
    const aims = STAGE_FIVE.satelliteLight.beams.map(() => ({ x: 60, y: -40 }));
    const frame = travel => {
        const point = (x, y, z) => [z - travel, 15 + y, x];
        const plane = (x, y) => [500 + x, 255 - y];
        const ctx = createRenderCtx({});
        Object.assign(ctx, { W: 1000, H: 510, t: 0, commands: [] });
        orbitSatelliteLight(ctx, view, point, plane, aims, travel, speed);
        return ctx.commands.filter(command => command.layer?.key === 'orbit-satellite-light-plane');
    };
    const box = command => {
        const xs = command.v.map(([x]) => x - 500), ys = command.v.map(([, y]) => 255 - y);
        return { left: Math.min(...xs), right: Math.max(...xs), bottom: Math.min(...ys), top: Math.max(...ys) };
    };
    assert.equal(frame(beam.from - speed * (warn + .5)).length, 0, 'nothing on the plane before it takes aim');
    const following = frame(beam.from - speed * 1.5);
    assert.ok(following.length > 0 && following.every(command => command.stroke?.dash?.length), 'while it follows the chair: a dashed outline only');
    assert.deepEqual(box(following[0]), { left: 60 - beam.half.x, right: 60 + beam.half.x, bottom: -40 - beam.half.y, top: -40 + beam.half.y }, 'round its aim');
    assert.equal(satelliteLightStage(beam, beam.from - speed * (lock - .1), speed).kind, 'lock', 'locked in its last second');
    const on = frame((beam.from + beam.to) / 2);
    const lit = on.find(command => typeof command.c === 'string');
    assert.deepEqual(box(lit), { left: 60 - beam.half.x, right: 60 + beam.half.x, bottom: -40 - beam.half.y, top: -40 + beam.half.y }, 'the lit rectangle is the one the course checks');
    assert.ok(on.every(command => command.v.length === 4), 'no lines across it, just the rectangle');
    const z = (beam.from + beam.to) / 2, state = { aims };
    assert.equal(satelliteLightOn(state, { x: 60 + beam.half.x + chairRadius - 5, y: -40 }, z), beam, 'the chair overlapping its edge is lit');
    assert.equal(satelliteLightOn(state, { x: 60 + beam.half.x + chairRadius + 5, y: -40 }, z), null, 'clear of it is dark');
    assert.equal(satelliteLightOn(state, { x: 60, y: -40 + beam.half.y + chairRadius + 5 }, z), null, 'above it is dark too');
    assert.equal(satelliteLightStage(beam, beam.to + speed * .5, speed), null, 'gone once the chair is through');
});

test('the chair catches the light: warming near a beam, glowing inside it, plain far from it', () => {
    const beam = STAGE_FIVE.satelliteLight.beams[1], age = 20, z = (beam.from + beam.to) / 2;
    const aims = STAGE_FIVE.satelliteLight.beams.map(() => ({ x: 0, y: 0 }));
    const edge = beam.half.x + STAGE_FIVE.satelliteLight.chairRadius;
    const warmth = x => satelliteLightWarmth(aims, { x, y: 0 }, z).warmth;
    assert.equal(satelliteLightOn({ aims }, { x: edge - 10, y: 0 }, z), beam);
    assert.equal(warmth(edge - 10), 1, 'inside, exactly where the course says it is lit');
    assert.ok(warmth(edge + 40) > 0 && warmth(edge + 40) < 1, 'warming just outside the edge');
    assert.ok(warmth(edge + 40) > warmth(edge + 100), 'more the nearer it gets');
    const glow = x => flightFrame(state => { Object.assign(state.orbit, { z, age }); Object.assign(state.p, { x, vx: 0 }); })
        .filter(command => command.c?.radius && command.c.stops?.[0]?.[1]?.[0] === 255 && command.c.stops[0][1][1] === 224).length;
    assert.ok(glow(edge - 10) > 0, 'a warm glow round the chair inside the light');
    const rec = x => flightFrame(state => { Object.assign(state.orbit, { z, age }); Object.assign(state.p, { x, vx: 0 }); })
        .some(command => command.text?.content === 'REC');
    assert.ok(rec(edge - 10) && !rec(edge + 200), 'the viewfinder records only inside the light');
});

test('the ending close-up finds the chair wherever in the shadow it parked', () => {
    const laptop = setup => {
        const commands = flightFrame(state => {
            Object.assign(state.orbit, { phase: 'parked', z: STAGE_FIVE.checkpoint.z, speed: 0, settled: 1 + 10 });
            setup(state);
        });
        const xs = commands.filter(command => command.text).map(command => command.v[0][0]);
        return xs.length ? xs.reduce((sum, x) => sum + x, 0) / xs.length : NaN;
    };
    const middle = laptop(() => {}), aside = laptop(state => Object.assign(state.p, { x: 520, y: -330, vx: 0, vy: 0 }));
    assert.ok(middle > 0 && middle < 1000, 'the message is on screen');
    assert.ok(Math.abs(aside - middle) < 5, `parked off to one side the message is still in the same place (${middle} vs ${aside})`);
    // Parked turned aside and against the fence, as in a played run: the ending's shots are the same as ever.
    const turned = state => { Object.assign(state.p, { x: -STAGE_FIVE.bounds.x - 20, y: STAGE_FIVE.bounds.y + 20, vx: 0, vy: 0 }); };
    assert.ok(Math.abs(laptop(turned) - middle) < 5, 'parked in a corner, the ending frames it the same');
    const frame = setup => flightFrame(state => {
        Object.assign(state.orbit, { phase: 'parked', z: STAGE_FIVE.checkpoint.z, speed: 0, settled: 1 + 22 });
        setup(state);
    });
    // Only the far city's slight parallax and the beacon (off screen by now) move with the chair's place aside.
    const shapes = commands => commands.filter(command => typeof command.c === 'string' && !/^#(7d9fbb|fffaf0)/.test(command.c)).map(command => command.c + command.v.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(' '));
    assert.deepEqual(shapes(frame(turned)), shapes(frame(() => {})), 'the Earth below lies the same way round');
    assert.equal(frame(turned).filter(command => command.c === '#f6e6df' || command.c?.startsWith?.('#f6e6df')).length, 0, 'and the fence no longer puffs at it');
});

