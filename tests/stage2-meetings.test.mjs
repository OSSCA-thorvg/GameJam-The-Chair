import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';
import { corridorPolicy } from './support/harness.mjs';

const { createGame, STAGE_TWO, previewScenes, meetingChairPose } = await loadSource(`
    export { createGame } from './src/game/game';
    export { STAGE_TWO } from './src/game/stages/building/data';
    export { previewScenes } from './src/preview-scenes';
    export { meetingChairPose } from './src/render/scene/meeting-room';
`);
const dt = 1 / 120;
function travel(game, stop) {
    const policy = corridorPolicy(false);
    for (let i = 0; i < 7200; i++) {
        const s = game.getSnapshot();
        if (stop(s)) return s;
        policy(s, game);
        game.step(dt);
    }
    assert.fail('route did not reach the expected scene');
}

test('the visitable meeting never dispatches chairs and stays before the first saved flag', () => {
    assert.ok(STAGE_TWO.meeting < STAGE_TWO.checkpoints[1].x);
    assert.ok(STAGE_TWO.dispatch.room > STAGE_TWO.checkpoints[1].x);
    const game = createGame({ seed: 8 });
    game.startStage(2);
    const entry = travel(game, s => s.canEnterMeeting);
    assert.equal(entry.corridor.dispatchStarted, false);
    game.interact();
    for (let i = 0; i < 720; i++) game.step(dt);
    const exit = game.getSnapshot();
    assert.equal(exit.corridor.room.kind, 'corridor');
    assert.equal(exit.corridor.meetingVisited, true);
    assert.equal(exit.corridor.dispatchAge, 0);
    assert.equal(exit.furniture.some(chair => chair.released), false);
    assert.ok(exit.furniture.every(chair => chair.x > STAGE_TWO.checkpoints[1].x));
    assert.equal(exit.deaths, 0);
    const end = travel(game, s => s.mode === 'won');
    assert.equal(end.deaths, 0, 'visiting still allows the convoy jump route without a retry');
});

test('retry at the first flag preserves the new room departure and the original express route', () => {
    const game = createGame({ seed: 9 });
    game.startStage(2);
    travel(game, s => s.checkpoint === 1);
    game.restart();
    const retry = game.getSnapshot();
    assert.equal(retry.player.x, STAGE_TWO.checkpoints[1].x);
    assert.equal(retry.corridor.dispatchStarted, false);
    assert.equal(retry.furniture.some(chair => chair.released), false);
    const deaths = retry.deaths;
    const end = travel(game, s => s.mode === 'won');
    assert.equal(end.deaths, deaths);
    assert.equal(end.focus, 100);
    assert.ok(end.furniture.every(chair => chair.released));
});

test('meeting and dispatch previews support deterministic forward and backward seeking', () => {
    for (const id of ['building-meeting', 'building-dispatch']) {
        const scene = previewScenes.find(scene => scene.id === id);
        assert.ok(scene);
        const middle = scene.sample(1.8);
        scene.sample(scene.duration);
        assert.deepEqual(scene.sample(1.8), middle);
    }
    const room = previewScenes.find(scene => scene.id === 'building-meeting');
    assert.equal(room.sample(1.8).state.corridor.room.kind, 'meeting');
    assert.equal(room.sample(5).state.furniture.some(chair => chair.released), false);
    assert.equal(room.sample(6).state.corridor.room.kind, 'corridor');
    const dispatch = previewScenes.find(scene => scene.id === 'building-dispatch');
    assert.equal(dispatch.sample(0).state.furniture.some(chair => chair.released), false);
    assert.ok(dispatch.sample(4.8).state.furniture.every(chair => chair.released));
    for (let i = 0; i < 3; i++) {
        const pose = meetingChairPose(2, i);
        assert.ok(pose.sink >= 0 && pose.sink <= 3, 'only the seat sinks; human limb lengths stay fixed');
        assert.ok(pose.lean >= 0 && pose.lean <= 4);
    }
});
