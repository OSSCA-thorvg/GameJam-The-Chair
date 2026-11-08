import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

async function load(entry) {
    const bundle = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'esm' });
    return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
}
const { createGame } = await load('src/game/game.ts');
const { createFeedback } = await load('src/ui/feedback.ts');
const { createCore } = await load('src/game/core.ts');
const { monitorStep } = await load('src/game/systems/monitor.ts');

test('head failures retain the short cause and joke without control hints', () => {
    const feedback = createFeedback(() => 'ko');
    const state = createGame().getSnapshot();
    state.player.a = .9;
    feedback.receive({ type: 'cue', id: 'head-game-over' }, state);
    assert.deepEqual(feedback.snapshot().panel, { k: '머리 충돌', title: '머리가 먼저 퇴근했습니다.', desc: '', button: '다시' });
    state.player.a = -.9;
    state.dirtyWaterExperienced = true;
    feedback.receive({ type: 'cue', id: 'head-game-over' }, state);
    assert.equal(feedback.snapshot().panel.desc, '');
    assert.equal(feedback.snapshot().reaction, null);
});

test('bin and focus failures have distinct concise causes without restoration paragraphs', () => {
    const feedback = createFeedback(() => 'ko');
    const state = createGame().getSnapshot();
    feedback.receive({ type: 'cue', id: 'bin-game-over' }, state);
    assert.deepEqual(feedback.snapshot().panel, { k: '휴지통 추락', title: '업무와 함께 분리배출.', desc: '', button: '다시' });
    feedback.receive({ type: 'cue', id: 'focus-game-over' }, state);
    assert.deepEqual(feedback.snapshot().panel, { k: '집중도 소진', title: '앗, 여기가 어디지?', desc: '', button: '다시' });
});

test('water keeps the rider reaction and restores the cleaner response without status duplication', () => {
    const feedback = createFeedback(() => 'ko');
    const state = createGame().getSnapshot();
    feedback.receive({ type: 'reset' }, state);
    feedback.receive({ type: 'cue', id: 'water-spilled' }, state);
    assert.equal(feedback.snapshot().reaction.text, '노트북은?!');
    assert.doesNotMatch(feedback.snapshot().status, /노트북/);
    feedback.receive({ type: 'cue', id: 'water-comment' }, state);
    assert.equal(feedback.snapshot().speech.text, '앗! 청소 중이었는데…');
    assert.equal(feedback.snapshot().speech.name, '김 대리');
    assert.equal(feedback.snapshot().reaction.text, '노트북은?!');
    feedback.receive({ type: 'tick', dt: 3 }, state);
    feedback.receive({ type: 'cue', id: 'water-spilled' }, state);
    assert.equal(feedback.snapshot().reaction, null);
});

test('checkpoint uses an accessibility notification while clear panels omit statistics', () => {
    const feedback = createFeedback(() => 'ko');
    const state = createGame().getSnapshot();
    feedback.receive({ type: 'cue', id: 'checkpoint' }, state);
    assert.equal(feedback.snapshot().reaction, null);
    assert.equal(feedback.snapshot().status, '체크포인트 저장.');
    feedback.receive({ type: 'cue', id: 'stage-clear' }, state);
    assert.deepEqual(feedback.snapshot().panel, { k: '', title: '퇴근 처리 중…', desc: '', button: '다음' });
});


test('stage one NPCs use their original approach and reverse dialogue', () => {
    const state = createGame().getSnapshot();
    for (const [id, name, text, x] of [
        ['manager', '박 과장', '벌써 퇴근하는 거야?', 320],
        ['cleaner', '김 대리', '앗, 청소 물통 넘어간다!', 1000],
        ['admin', '총무팀', '쓰레기 분리배출 부탁드려요.', 1810]
    ]) {
        const feedback = createFeedback(() => 'ko');
        const person = { id, x, said: true };
        feedback.receive({ type: 'cue', id: 'person-comment', person }, state);
        assert.deepEqual(feedback.snapshot().speech, { name, text, x, life: 3.4 });
        feedback.receive({ type: 'cue', id: 'reverse-comment', person }, state);
        assert.equal(feedback.snapshot().speech.text, '다시 출근하는 거야?');
        assert.equal(feedback.snapshot().speech.x, x);
    }
});

test('monitor and accident responses retain the original speaker and line', () => {
    const state = createGame().getSnapshot();
    const feedback = createFeedback(() => 'ko');
    feedback.receive({ type: 'cue', id: 'light-hit' }, state);
    feedback.receive({ type: 'cue', id: 'light-comment', monitorIndex: 0 }, state);
    assert.equal(feedback.snapshot().reaction.text, '눈부셔… 실적 칸이 안 보여!');
    assert.deepEqual(feedback.snapshot().speech, { text: '밝은 미래가 보이죠?', name: '옆자리 동료', x: 2281, life: 3.4 });
    for (const [id, name] of [['head-comment', '박 과장'], ['bin-comment', '총무팀']]) {
        feedback.receive({ type: 'cue', id }, state);
        assert.equal(feedback.snapshot().speech.text, '산재 처리는…');
        assert.equal(feedback.snapshot().speech.name, name);
    }
});

test('the monitor that hit the rider owns the speech bubble', () => {
    const state = createGame().getSnapshot();
    for (const [index, time, wall, speakerX] of [[1, 2.3, 2560, 2701], [2, .1, 2980, 3121]]) {
        const core = createCore(0);
        core.mode = 'play';
        core.t = time;
        core.p.x = wall;
        core.p.y = 392;
        monitorStep(core, 1 / 120, wall - 10);
        const cue = core.events.find(event => event.type === 'cue' && event.id === 'light-comment');
        assert.deepEqual(cue, { type: 'cue', id: 'light-comment', monitorIndex: index });
        const feedback = createFeedback();
        feedback.receive(cue, state);
        assert.equal(feedback.snapshot().speech.x, speakerX);
    }
});

test('dialogue expires, resets and stays out of later stages', () => {
    const game = createGame();
    const state = game.getSnapshot();
    const feedback = createFeedback(() => 'ko');
    const cue = { type: 'cue', id: 'light-comment', monitorIndex: 0 };
    feedback.receive(cue, state);
    feedback.receive({ type: 'tick', dt: 3.5 }, state);
    assert.equal(feedback.snapshot().speech, null);
    feedback.receive(cue, state);
    feedback.receive({ type: 'reset' }, state);
    assert.equal(feedback.snapshot().speech, null);
    game.startStage(2);
    feedback.receive(cue, game.getSnapshot());
    assert.equal(feedback.snapshot().speech, null);
});

test('each printer volley triggers a fresh readable burst, then disappears', async () => {
    const { createEffects } = await load('src/render/effects.ts');
    const effects = createEffects();
    effects.receive({ type: 'volley' });
    effects.receive({ type: 'tick', dt: .3 });
    assert.ok(effects.snapshot().copierFlash > 0);
    effects.receive({ type: 'tick', dt: .3 });
    assert.equal(effects.snapshot().copierFlash, 0);
    effects.receive({ type: 'volley' });
    assert.ok(effects.snapshot().copierFlash > 0);
    effects.receive({ type: 'reset' });
    assert.equal(effects.snapshot().copierFlash, 0);
});


test('all game-over panels omit control advice in both languages and all stages', () => {
    for (const locale of ['en', 'ko']) {
        for (const stage of [1, 2, 3]) {
            const game = createGame();
            game.startStage(stage);
            const state = game.getSnapshot();
            const feedback = createFeedback(() => locale);
            for (const angle of [-.9, .9]) {
                state.player.a = angle;
                for (const id of ['head-game-over', 'bin-game-over', 'focus-game-over']) {
                    feedback.receive({ type: 'cue', id }, state);
                    const panel = feedback.snapshot().panel;
                    assert.equal(panel.desc, '');
                    assert.ok(panel.title);
                    assert.ok(panel.button);
                    assert.doesNotMatch(Object.values(panel).join(' '), /[QE] [↶↷]|brake|제동/);
                }
            }
        }
    }
});
