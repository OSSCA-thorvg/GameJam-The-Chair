import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';
import { driveStageThree } from './support/stage3-route.mjs';

const { PERSONAL_BOX, createPersonalBoxObserver, personalBoxPose, createEffects, previewScenes, createGame, REPLAY_FORMAT, buildTimeline, buildPersonalBoxTrack, personalBoxAt } = await loadSource(`
    export { PERSONAL_BOX, createPersonalBoxObserver, personalBoxPose } from './src/render/personal-box-motion';
    export { createEffects } from './src/render/effects';
    export { previewScenes } from './src/preview-scenes';
    export { createGame } from './src/game/game';
    export { REPLAY_FORMAT, buildTimeline } from './src/game/replay';
    export { buildPersonalBoxTrack, personalBoxAt } from './src/ui/personal-box-replay';
`);
const input = (time, x, y = 368) => ({ stage: 3, deaths: 0, time, player: { x, y } });

test('farewell waits until the whole chair clears the box, then waits another 0.2 seconds', () => {
    for (const side of [-1, 1]) {
        const observer = createPersonalBoxObserver();
        const edge = side < 0 ? PERSONAL_BOX.right : PERSONAL_BOX.left;
        const clearX = edge - side * (PERSONAL_BOX.chairRadius + 1);
        const still = { bend: 0, leaf: 0, badgeTurn: 0, badgeSwing: 0 };
        observer.observe(input(0, PERSONAL_BOX.plantX + side * 300));
        assert.equal(observer.snapshot().kind, 'idle');
        observer.observe(input(1, PERSONAL_BOX.plantX + side * 100, 0));
        assert.equal(observer.snapshot().kind, 'idle', 'an upper ledge does not trigger it');
        observer.observe(input(2, PERSONAL_BOX.plantX + side * 100));
        assert.equal(observer.snapshot().kind, 'approaching');
        assert.deepEqual(personalBoxPose(observer.snapshot(), 2.7), still);
        observer.observe(input(3, clearX + side * 2));
        assert.equal(observer.snapshot().kind, 'approaching', 'the back of the chair still overlaps');
        observer.observe(input(4, clearX));
        const farewell = observer.snapshot();
        assert.equal(farewell.kind, 'farewell');
        assert.deepEqual(personalBoxPose(farewell, 4.199), still, 'portrait stays front-facing throughout the pause');
        assert.ok(personalBoxPose(farewell, 4.25).badgeTurn > 0);
        assert.ok(personalBoxPose(farewell, 4.9).bend * side < -.5, 'plant bows toward the departing owner');
        assert.equal(personalBoxPose(farewell, 5.2).badgeTurn, Math.PI);
        observer.observe(input(8, PERSONAL_BOX.plantX + side * 100));
        assert.deepEqual(observer.snapshot(), farewell, 'returning cannot restart the farewell');
        assert.deepEqual(personalBoxPose(farewell, 8), { ...still, badgeTurn: Math.PI });
    }
});

test('replay seeking after the box keeps the flipped badge beyond the particle warmup window', () => {
    const commands = [];
    const observer = createPersonalBoxObserver();
    const game = createGame({ onCommand: (tick, command) => commands.push([tick, command]),
        onStep: state => observer.observe({ stage: state.stage, deaths: state.deaths, time: state.time, player: state.p }),
    });
    game.startStage(3);
    const start = JSON.parse(game.serialize());
    commands.length = 0;
    driveStageThree(game, state => {
        const reaction = observer.snapshot();
        return reaction.kind === 'farewell' && state.time - reaction.passed > 3;
    });
    const reaction = observer.snapshot();
    assert.equal(reaction.kind, 'farewell');
    const end = JSON.parse(game.serialize());
    const timeline = buildTimeline({ format: REPLAY_FORMAT, version: '', seed: 0, start,
        commands, hashes: [], endTick: end.tick, truncated: false, error: null,
    });
    const track = buildPersonalBoxTrack(timeline);
    assert.deepEqual(personalBoxAt(track, timeline.endTick), reaction);
    assert.equal(personalBoxAt(track, timeline.startTick).kind, 'idle');
    assert.deepEqual(personalBoxAt(track, timeline.endTick), reaction);
});

test('the farewell settles and resets only for a new attempt', () => {
    const observer = createPersonalBoxObserver();
    observer.observe(input(1, PERSONAL_BOX.plantX - 100));
    observer.observe(input(3, 1500));
    const reaction = observer.snapshot();
    assert.equal(reaction.kind, 'farewell');
    assert.equal(personalBoxPose(reaction, 6).bend, 0);
    assert.equal(personalBoxPose(reaction, 6).badgeSwing, 0);
    observer.observe({ ...input(0, 1000), deaths: 1 });
    assert.equal(observer.snapshot().kind, 'idle');
});

test('personal belongings preview seeks backward through the bow, flip and one-shot return', () => {
    const scene = previewScenes.find(scene => scene.id === 'personal-belongings');
    const bowed = scene.sample(3.6);
    const before = scene.sample(2.8);
    assert.equal(personalBoxPose(before.effects.personalBox, before.state.time).badgeTurn, 0);
    assert.ok(Math.abs(personalBoxPose(bowed.effects.personalBox, bowed.state.time).bend) > .4);
    assert.equal(scene.sample(0).effects.personalBox.kind, 'idle');
    assert.equal(bowed.effects.personalBox.kind, 'farewell');
    const end = scene.sample(7);
    assert.equal(end.effects.personalBox.kind, 'farewell');
    assert.equal(personalBoxPose(end.effects.personalBox, end.state.time).badgeTurn, Math.PI);
    assert.deepEqual(scene.sample(3.6), bowed);
    assert.equal(scene.sample(0).effects.personalBox.kind, 'idle');
    const restored = createEffects();
    restored.restorePersonalBox(end.effects.personalBox);
    restored.observe(input(7.1, 1200));
    assert.deepEqual(restored.snapshot().personalBox, end.effects.personalBox);
});
