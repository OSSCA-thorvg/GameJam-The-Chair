import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

async function load(entry) {
    const bundle = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'esm' });
    return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
}
const { createGame } = await load('src/game/game.ts');
const { createFeedback } = await load('src/ui/feedback.ts');

test('clean head failures explain balance direction without blaming water', () => {
    const feedback = createFeedback();
    const game = createGame();
    game.startStage(1);
    const state = game.getSnapshot();
    state.player.a = .9;
    feedback.receive({ type: 'cue', id: 'head-game-over' }, state);
    const panel = feedback.snapshot().panel;
    assert.match(panel.desc, /Q ↶/);
    assert.doesNotMatch(panel.desc, /물|미끄/);
    state.player.a = -.9;
    feedback.receive({ type: 'cue', id: 'head-game-over' }, state);
    assert.match(feedback.snapshot().panel.desc, /E ↷/);
});

test('wet head failures, trash-bin failures and focus failures have distinct guidance', () => {
    const feedback = createFeedback();
    const state = createGame().getSnapshot();
    state.dirtyWaterExperienced = true;
    feedback.receive({ type: 'cue', id: 'head-game-over' }, state);
    assert.match(feedback.snapshot().panel.desc, /젖은 바닥/);
    feedback.receive({ type: 'cue', id: 'bin-game-over' }, state);
    assert.match(feedback.snapshot().panel.desc, /깃발.*100%.*마른/);
    feedback.receive({ type: 'cue', id: 'focus-game-over' }, state);
    assert.match(feedback.snapshot().panel.desc, /집중도가 모두 소진/);
});
