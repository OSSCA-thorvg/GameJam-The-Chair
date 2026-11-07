import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

async function load(entry) {
    const bundle = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'esm' });
    return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
}
const { createGame } = await load('src/game/game.ts');
const { createFeedback } = await load('src/ui/feedback.ts');

test('head failures retain one short cause, joke and correction key', () => {
    const feedback = createFeedback();
    const state = createGame().getSnapshot();
    state.player.a = .9;
    feedback.receive({ type: 'cue', id: 'head-game-over' }, state);
    assert.deepEqual(feedback.snapshot().panel, { k: '머리 충돌', title: '머리가 먼저 퇴근했습니다.', desc: 'Q ↶', button: '다시' });
    state.player.a = -.9;
    state.dirtyWaterExperienced = true;
    feedback.receive({ type: 'cue', id: 'head-game-over' }, state);
    assert.equal(feedback.snapshot().panel.desc, 'E ↷');
    assert.equal(feedback.snapshot().reaction, null);
});

test('bin and focus failures have distinct concise causes without restoration paragraphs', () => {
    const feedback = createFeedback();
    const state = createGame().getSnapshot();
    feedback.receive({ type: 'cue', id: 'bin-game-over' }, state);
    assert.deepEqual(feedback.snapshot().panel, { k: '휴지통 추락', title: '업무와 함께 분리배출.', desc: '', button: '다시' });
    feedback.receive({ type: 'cue', id: 'focus-game-over' }, state);
    assert.deepEqual(feedback.snapshot().panel, { k: '집중도 소진', title: '앗, 여기가 어디지?', desc: '', button: '다시' });
});

test('water gets one short bubble without NPC followups or accessible joke duplication', () => {
    const feedback = createFeedback();
    const state = createGame().getSnapshot();
    feedback.receive({ type: 'reset' }, state);
    feedback.receive({ type: 'cue', id: 'water-spilled' }, state);
    assert.equal(feedback.snapshot().reaction.text, '노트북은?!');
    assert.doesNotMatch(feedback.snapshot().status, /노트북/);
    for (const id of ['water-comment', 'water-followup', 'rolling', 'reverse-comment', 'person-comment']) feedback.receive({ type: 'cue', id }, state);
    assert.equal(feedback.snapshot().speech, null);
    assert.equal(feedback.snapshot().reaction.text, '노트북은?!');
    feedback.receive({ type: 'tick', dt: 3 }, state);
    feedback.receive({ type: 'cue', id: 'water-spilled' }, state);
    assert.equal(feedback.snapshot().reaction, null);
});

test('checkpoint uses an accessibility notification while clear panels omit statistics', () => {
    const feedback = createFeedback();
    const state = createGame().getSnapshot();
    feedback.receive({ type: 'cue', id: 'checkpoint' }, state);
    assert.equal(feedback.snapshot().reaction, null);
    assert.equal(feedback.snapshot().status, '체크포인트 저장.');
    feedback.receive({ type: 'cue', id: 'stage-clear' }, state);
    assert.deepEqual(feedback.snapshot().panel, { k: '', title: '퇴근 처리 중…', desc: '', button: '다음' });
});
