import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';
import { corridorPolicy } from './support/harness.mjs';

const { createGame, STAGE_TWO, previewScenes, meetingChairPose, entryDoorOpening, dispatchDoorOpening } = await loadSource(`
    export { createGame } from './src/game/game';
    export { STAGE_TWO } from './src/game/stages/building/data';
    export { previewScenes } from './src/preview-scenes';
    export { meetingChairPose } from './src/render/scene/meeting-room';
    export { entryDoorOpening, dispatchDoorOpening } from './src/render/scene/meeting-doors';
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
    for (let i = 0; i <= Math.ceil((6 + STAGE_TWO.meetingEntry) / dt); i++) game.step(dt);
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
    assert.equal(room.sample(room.duration).state.corridor.room.kind, 'corridor');
    const dispatch = previewScenes.find(scene => scene.id === 'building-dispatch');
    assert.equal(dispatch.sample(0).state.furniture.some(chair => chair.released), false);
    assert.ok(dispatch.sample(4.8).state.furniture.every(chair => chair.released));
    for (let i = 0; i < 3; i++) {
        const pose = meetingChairPose(2, i);
        assert.ok(pose.sink >= 0 && pose.sink <= 3, 'only the seat sinks; human limb lengths stay fixed');
        assert.ok(pose.lean >= 0 && pose.lean <= 4);
    }
});


test('enter opens the first door before entering and restores halfway through the approach', () => {
    const game = createGame({ seed: 8 });
    game.startStage(2);
    const before = travel(game, state => state.canEnterMeeting);
    assert.equal(entryDoorOpening(before.corridor.room), 0);
    game.interact();
    assert.equal(game.getSnapshot().corridor.room.kind, 'entering');
    assert.equal(game.getSnapshot().player.x, before.player.x, 'enter does not teleport through the closed door');
    for (let i = 0; i < 25; i++) game.step(dt);
    const approach = game.getSnapshot();
    const aperture = entryDoorOpening(approach.corridor.room);
    assert.ok(aperture > 0 && aperture < 1);
    assert.ok(approach.player.x > before.player.x && approach.player.x < STAGE_TWO.meeting);
    const restored = createGame();
    restored.restore(game.serialize());
    for (let i = 0; i < 120; i++) { game.step(dt); restored.step(dt); }
    assert.deepEqual(restored.getSnapshot(), game.getSnapshot());
    assert.equal(game.getSnapshot().corridor.room.kind, 'meeting');
});

test('the dispatch door starts shut and closes only after every chair clears its frame', () => {
    const game = createGame({ seed: 8 });
    game.startStage(2);
    const policy = corridorPolicy(false);
    let sawOpening = false, sawOpen = false, sawClosing = false, closed = false;
    for (let i = 0; i < 5000; i++) {
        const s = game.getSnapshot(), c = s.corridor;
        const clear = s.furniture.every(chair => chair.released && chair.x - chair.width / 2 > STAGE_TWO.dispatch.room + 78);
        const aperture = dispatchDoorOpening(c.dispatchAge, c.dispatchStarted, clear);
        if (!c.dispatchStarted) assert.equal(aperture, 0);
        else if (c.dispatchAge < .5 && aperture > 0) sawOpening = true;
        if (aperture === 1) sawOpen = true;
        if (c.dispatchAge > 3.4 && aperture > 0 && aperture < 1) {
            sawClosing = true;
            assert.ok(clear, 'the last chair is completely outside before the door closes');
        }
        if (c.dispatchAge > 4.2) { assert.equal(aperture, 0); closed = true; break; }
        policy(s, game);
        game.step(dt);
    }
    assert.ok(sawOpening && sawOpen && sawClosing && closed);
});
