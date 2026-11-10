import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { driveStageThree } from './stage3-route.mjs';

const bundle = await build({ entryPoints: ['src/game/game.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { createGame } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const dt = 1 / 120;

test('extinguisher must be collected and does not leak into other stages', () => {
    const game = createGame();
    for (const stage of [1, 2, 3]) {
        game.startStage(stage); game.drainEvents();
        const before = game.getSnapshot();
        assert.equal(before.hasExtinguisher, false);
        game.spray();
        assert.deepEqual(game.getSnapshot(), before);
        assert.deepEqual(game.drainEvents(), []);
    }
    driveStageThree(game, state => state.hasExtinguisher);
    assert.equal(game.getSnapshot().checkpoint, 1);
    game.restart();
    assert.equal(game.getSnapshot().hasExtinguisher, true);
    assert.equal(game.getSnapshot().player.x, 640);
    game.startStage(1);
    assert.equal(game.getSnapshot().hasExtinguisher, false);
});

test('held spray repeats every 0.24 seconds without ammo and right input propels right', () => {
    const game = createGame(); game.startStage(3);
    driveStageThree(game, state => state.hasExtinguisher);
    game.restart(); game.drainEvents();
    const before = game.getSnapshot().player;
    game.setInput('right', 'spray');
    let bursts = 0;
    const times = [];
    for (let i = 0; i < 120; i++) {
        game.step(dt);
        for (const event of game.drainEvents()) if (event.type === 'cue' && event.id === 'spray') { bursts++; times.push(game.getSnapshot().time); }
        if (i === 0) {
            const state = game.getSnapshot();
            assert.ok(state.player.vx > before.vx && state.player.vy < before.vy);
            assert.ok(state.spray.dir.x < 0 && state.spray.dir.y > 0);
        }
    }
    assert.equal(bursts, 5);
    for (let i = 1; i < times.length; i++) assert.ok(Math.abs(times[i] - times[i - 1] - .24) < dt);
    game.release('spray');
    for (let i = 0; i < 60; i++) game.step(dt);
    assert.equal(game.getSnapshot().spray.burst, 0);
});

test('continuous thrust carries the chair smoothly into an airborne stage-four start', () => {
    const game = createGame(); game.startStage(3);
    const flags = new Set(), landings = new Set(), reactions = new Set(), shots = new Set();
    const flight = driveStageThree(game, state => state.firstFlight.kind === 'flight', state => {
        flags.add(state.checkpoint);
        reactions.add(state.ductReaction.kind);
        if (state.firstFlight.kind === 'course') shots.add(state.firstFlight.verticalShots);
        if (state.ground) {
            if (state.player.x > 1510 && state.player.x < 1780 && Math.abs(state.player.y - 248) < 18) landings.add('right');
            if (state.player.x > 1240 && state.player.x < 1400 && Math.abs(state.player.y - 108) < 18) landings.add('left');
            if (state.player.x > 1510 && state.player.x < 1780 && Math.abs(state.player.y + 32) < 18) landings.add('duct');
        }
    });
    assert.deepEqual([...flags], [0, 1, 2, 3]);
    assert.deepEqual(landings, new Set(['right', 'left', 'duct']));
    assert.deepEqual([...reactions], ['idle', 'reacting', 'done']);
    assert.equal(flight.mode, 'play');
    assert.equal(flight.deaths, 0);
    assert.deepEqual([...shots], [0, 1, 2]);
    assert.ok(flight.player.x >= 2230 && flight.player.x <= 2440);
    assert.equal(flight.player.vx, 0);
    assert.ok(flight.player.vy < -300);
    game.pause(); const paused = game.getSnapshot(); game.advance(1);
    assert.deepEqual(game.getSnapshot(), paused); game.pause();
    let beforeTransition = game.getSnapshot();
    for (let i = 0; i < 120 * 12 && game.getSnapshot().stage === 3; i++) {
        beforeTransition = game.getSnapshot();
        assert.ok(beforeTransition.spray.burst > .2, 'spray never stops during ascent');
        assert.equal(beforeTransition.ground, false);
        game.step(dt);
        const next = game.getSnapshot();
        assert.equal(next.player.x, flight.player.x);
        assert.ok(next.player.y <= beforeTransition.player.y, 'ascent continues upward');
        assert.ok(Math.abs(next.player.vy - beforeTransition.player.vy) < 5, 'thrust changes speed smoothly');
    }
    const end = game.getSnapshot();
    assert.ok(beforeTransition.firstFlight.age > 4, 'the sustained ascent plays before the stage transition');
    assert.equal(end.mode, 'play');
    assert.equal(end.stage, 4);
    assert.equal(end.completedStage, 3);
    assert.ok(Math.abs(end.player.y - beforeTransition.player.y) < 5, 'no position jump on entry');
    assert.equal(end.player.x, flight.player.x);
    assert.ok(Math.abs(end.player.vy - beforeTransition.player.vy) < 5, 'velocity carries through the transition');
    assert.equal(end.hasExtinguisher, true);
    assert.equal(end.ground, false);
    assert.equal(end.solids.length, 0, 'no landing cloud or floor');
    for (let i = 0; i < 120 * 5; i++) {
        game.step(dt);
        const hover = game.getSnapshot();
        assert.equal(hover.ground, false);
        assert.ok(hover.spray.burst > .2, 'extinguisher keeps spraying while hovering');
        assert.ok(Math.abs(hover.player.y + 1820) < 35, 'remains floating near the starting height');
    }
    game.setInput('right');
    for (let i = 0; i < 120; i++) game.step(dt);
    assert.ok(game.getSnapshot().player.x > end.player.x + 50, 'airborne starting area remains controllable');
    game.restart();
    assert.equal(game.getSnapshot().player.x, 2380);
    assert.equal(game.getSnapshot().hasExtinguisher, true);
    assert.equal(game.getSnapshot().firstFlight.kind, 'course');
});

test('entrance moves the chair to the first block and closes before enabling controls', () => {
    const game = createGame(); game.startStage(3);
    assert.equal(game.getSnapshot().rooftopEntrance.kind, 'opening');
    assert.deepEqual(game.getSnapshot().people, []);
    game.setInput('left'); game.jump();
    for (let i = 0; i < 60; i++) game.step(dt);
    assert.equal(game.getSnapshot().player.x, 100, 'chair stays behind the door while it first opens');
    assert.equal(game.getSnapshot().player.vy, 0, 'jump input cannot interrupt the entrance');
    game.pause(); const paused = game.getSnapshot(); game.advance(2);
    assert.deepEqual(game.getSnapshot(), paused); game.pause();
    for (let i = 0; i < 80; i++) game.step(dt);
    const emerging = game.getSnapshot();
    assert.equal(emerging.rooftopEntrance.kind, 'opening');
    assert.ok(emerging.player.x > 100 && emerging.player.x < 235);
    for (let i = 0; i < 100; i++) game.step(dt);
    const closing = game.getSnapshot();
    assert.equal(closing.rooftopEntrance.kind, 'opening', 'controls stay locked while the door closes');
    assert.equal(closing.player.x, 235, 'chair waits in front of the first pipe');
    game.setInput('left'); game.jump();
    for (let i = 0; i < 90; i++) game.step(dt);
    assert.equal(game.getSnapshot().rooftopEntrance.kind, 'ready');
    assert.ok(Math.abs(game.getSnapshot().player.x - 235) < 1);
    game.setInput('left');
    for (let i = 0; i < 40; i++) game.step(dt);
    assert.ok(game.getSnapshot().player.x < 230, 'controls activate after the door closes');
});

test('launch requires three consecutive upward shots and ignores directional or delayed bursts', () => {
    const game = createGame(); game.startStage(3);
    driveStageThree(game, state => state.checkpoint === 3 && state.ground && state.player.x > 2250);
    game.clearInput(); game.spray();
    assert.equal(game.getSnapshot().firstFlight.verticalShots, 1);
    for (let i = 0; i < 30; i++) game.step(dt);
    game.setInput('right'); game.spray();
    assert.equal(game.getSnapshot().firstFlight.verticalShots, 0);
    game.clearInput();
    for (let i = 0; i < 30; i++) game.step(dt);
    game.spray();
    assert.equal(game.getSnapshot().firstFlight.verticalShots, 1);
    for (let i = 0; i < 85; i++) game.step(dt);
    assert.equal(game.getSnapshot().firstFlight.verticalShots, 0);
    assert.equal(game.getSnapshot().stage, 3);
    assert.equal(game.getSnapshot().firstFlight.kind, 'course');
});
