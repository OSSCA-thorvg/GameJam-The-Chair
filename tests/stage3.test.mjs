import assert from 'node:assert/strict';
import test from 'node:test';
import { driveStageThree } from './support/stage3-route.mjs';
import { bundled } from './support/load.mjs';

const { createGame } = await bundled({ entryPoints: ['src/game/game.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
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

test('held spray repeats every 0.24 seconds, three bursts per time in the air, and right input propels right', () => {
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
    assert.equal(bursts, 3, 'the extinguisher stops after three bursts until the chair lands');
    assert.equal(game.getSnapshot().airSprays, 3);
    for (let i = 1; i < times.length; i++) assert.ok(Math.abs(times[i] - times[i - 1] - .24) < dt);
    game.release('spray');
    for (let i = 0; i < 60; i++) game.step(dt);
    assert.equal(game.getSnapshot().spray.burst, 0);
    for (let i = 0; i < 600 && !game.getSnapshot().ground; i++) game.step(dt);
    assert.equal(game.getSnapshot().airSprays, 0, 'landing refills the bursts');
    game.drainEvents(); game.spray();
    assert.ok(game.drainEvents().some(event => event.type === 'cue' && event.id === 'spray'));
});

test('dropping off the roof onto the sales graph rides it into an airborne stage-four start', () => {
    const game = createGame(); game.startStage(3);
    const flags = new Set(), landings = new Set(), reactions = new Set();
    const ride = driveStageThree(game, state => state.firstFlight.kind === 'ride', state => {
        flags.add(state.checkpoint);
        reactions.add(state.ductReaction.kind);
        // The shaft's four ledges, zig-zagging up from the duct: R1, L1, R2, L2.
        if (state.ground) {
            if (state.player.x > 1480 && state.player.x < 1780 && Math.abs(state.player.y - 248) < 18) landings.add('R1');
            if (state.player.x > 1240 && state.player.x < 1540 && Math.abs(state.player.y - 78) < 18) landings.add('L1');
            if (state.player.x > 1480 && state.player.x < 1780 && Math.abs(state.player.y + 92) < 18) landings.add('R2');
            if (state.player.x > 1240 && state.player.x < 1540 && Math.abs(state.player.y + 262) < 18) landings.add('L2');
        }
    });
    assert.deepEqual([...flags], [0, 1, 2, 3, 4]);
    assert.deepEqual(landings, new Set(['R1', 'L1', 'R2', 'L2']));
    assert.deepEqual([...reactions], ['idle', 'reacting', 'done']);
    assert.equal(ride.mode, 'play');
    assert.equal(ride.deaths, 0);
    assert.ok(ride.player.x > 2400 && ride.player.x < 2560, 'the chair boards where the board meets the roof edge');
    game.drainEvents(); game.spray();
    assert.ok(!game.drainEvents().some(event => event.type === 'cue' && event.id === 'spray'), 'no manual sprays during the ride');
    game.pause(); const paused = game.getSnapshot(); game.advance(1);
    assert.deepEqual(game.getSnapshot(), paused); game.pause();
    let beforeTransition = game.getSnapshot(), sawFlight = false;
    for (let i = 0; i < 120 * 14 && game.getSnapshot().stage === 3; i++) {
        beforeTransition = game.getSnapshot();
        assert.ok(beforeTransition.spray.burst > .2, 'spray never stops during the ride and ascent');
        assert.equal(beforeTransition.ground, false);
        sawFlight ||= beforeTransition.firstFlight.kind === 'flight';
        game.step(dt);
        const next = game.getSnapshot();
        if (sawFlight && next.stage === 3) assert.ok(next.player.y <= beforeTransition.player.y, 'ascent continues upward');
    }
    const end = game.getSnapshot();
    assert.ok(sawFlight, 'the graph tip hands over to the climb');
    assert.equal(end.mode, 'play');
    assert.equal(end.stage, 4);
    assert.equal(end.completedStage, 3);
    assert.ok(Math.abs(end.player.y - beforeTransition.player.y) < 5, 'no position jump on entry');
    assert.ok(Math.abs(end.player.vy - beforeTransition.player.vy) < 5, 'velocity carries through the transition');
    assert.equal(end.player.x, 2380, 'the sky stage starts at its hover column');
    assert.ok(Math.abs(beforeTransition.player.x - 2880) < 30, 'the climb went straight up from the graph tip');
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
    const settled = game.getSnapshot();
    game.setInput('right');
    for (let i = 0; i < 120; i++) game.step(dt);
    assert.ok(game.getSnapshot().player.x > settled.player.x + 50, 'airborne starting area remains controllable');
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

test('the sales graph waits until the chair rolls onto it', () => {
    const game = createGame(); game.startStage(3);
    driveStageThree(game, state => state.checkpoint === 4 && state.ground && state.player.x > 2000);
    game.setInput('left');
    for (let i = 0; i < 120 * 2; i++) game.step(dt);
    assert.equal(game.getSnapshot().firstFlight.kind, 'course', 'rolling away leaves the graph alone');
    game.setInput('right');
    for (let i = 0; i < 120 * 4 && game.getSnapshot().firstFlight.kind === 'course'; i++) game.step(dt);
    const state = game.getSnapshot();
    assert.equal(state.firstFlight.kind, 'ride');
    assert.equal(state.deaths, 0);
});

test('a steam blast costs focus once per blast', async () => {
    const { STAGE_THREE, ventPhase } = await bundled({ stdin: { contents: `export { STAGE_THREE, ventPhase } from './src/game/stages/rooftop/data';`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });
    const vent = STAGE_THREE.vents[0];
    let blowAt = 0;
    while (ventPhase(vent, blowAt + dt).kind !== 'blow') blowAt += dt;
    const game = createGame(); game.startStage(3);
    const state = JSON.parse(game.serialize());
    Object.assign(state, { focus: 100, mode: 'play', time: blowAt, hasExtinguisher: true, ground: false });
    state.rooftop.entrance = { kind: 'ready' };
    Object.assign(state.p, { x: vent.x - 40, y: vent.y, vx: 0, vy: 0 });
    game.restore(JSON.stringify(state));
    game.step(dt);
    const hit = game.getSnapshot();
    assert.equal(hit.focusNotice?.kind, 'steam');
    assert.ok(hit.focus < 100);
    game.step(dt);
    assert.equal(game.getSnapshot().focus, hit.focus, 'the same blast only counts once');
});
