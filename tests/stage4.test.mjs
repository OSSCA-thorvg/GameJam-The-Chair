import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { driveStageFour } from './stage4-route.mjs';
const bundle = await build({ stdin: { contents: `export { createGame } from './src/game/game'; export { skyPlatforms, skySurface } from './src/game/stage4';`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });
const { createGame, skyPlatforms, skySurface } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('stage 4 traverses growing building, gust sign, nested desk and depth reveal without falling', () => {
    const game = createGame(); game.startStage(4);
    const landings = new Set(), flags = new Set(), phases = new Set();
    let lift = 0, drawer = 0, tiltedDesk = false, sign = false;
    const end = driveStageFour(game, state => {
        flags.add(state.checkpoint); phases.add(state.sky.phase);
        if (state.ground) landings.add(state.sky.standing);
        lift = Math.max(lift, state.sky.lift); drawer = Math.max(drawer, state.sky.drawer);
        tiltedDesk ||= Math.abs(state.sky.deskTilt) > .001;
        if (state.sky.standing === 'wind-sign' && state.ground) {
            sign = true;
            const surface = skySurface(skyPlatforms(state.sky, state.time).find(p => p.id === 'wind-sign'), state.player.x);
            assert.ok(Math.abs(state.player.y + 28 - surface) < .01, 'chair rests on the moving sign face');
        }
    });
    assert.equal(end.completedStage, 4); assert.equal(end.deaths, 0);
    assert.deepEqual([...flags], [0, 1, 2, 3]);
    assert.deepEqual([...phases], ['arrival', 'course', 'reveal', 'depth']);
    for (const id of ['arrival-roof', 'window-one', 'window-two', 'wind-sign', 'drawer-desk', 'little-desk', 'upper-rest', 'last-sign']) assert.ok(landings.has(id), id);
    assert.equal(lift, 1); assert.equal(drawer, 1); assert.ok(tiltedDesk); assert.ok(sign);
    assert.equal(end.ground, false, 'ending stays suspended in the sky');
});

test('saved sky flags restore a safe landing and do not leak props into earlier stages', () => {
    const game = createGame(); game.startStage(4);
    let checked = false;
    driveStageFour(game, state => {
        if (state.checkpoint === 2 && !checked) {
            checked = true; game.pause(); const frozen = game.getSnapshot(); game.advance(2);
            assert.deepEqual(game.getSnapshot(), frozen); game.pause();

        }
    });
    assert.ok(checked);
    game.restart();
    const retry = game.getSnapshot();
    assert.equal(retry.checkpoint, 3); assert.equal(retry.player.x, 4510);
    assert.equal(retry.sky.phase, 'course'); assert.equal(retry.sky.lift, 1);
    game.startStage(4); assert.equal(game.getSnapshot().player.x, 2380);
    game.startStage(3); assert.equal(game.getSnapshot().sky.phase, 'arrival');
    assert.equal(game.getSnapshot().hasExtinguisher, false);
});
