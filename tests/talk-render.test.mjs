import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createGame, createRenderCtx, drawTalk, drawStageTitle, SPEECH_FONT, LABEL_FONT } = await loadSource(`
    export { createGame } from './src/game/game';
    export { createRenderCtx } from './src/render/context';
    export { drawTalk, drawStageTitle } from './src/render/scene/talk';
    export { SPEECH_FONT, LABEL_FONT } from './src/render/fonts';
`);

function context(state, overrides = {}) {
    const ctx = createRenderCtx({});
    Object.assign(ctx, { state, p: state.player, mode: 'play', locale: 'ko', t: state.time, W: 1000, H: 510, VW: 1000, scale: 1, cam: 0, vertical: 0 }, overrides);
    return ctx;
}

test('rider reactions and colleague remarks are ThorVG bubbles with Jua words', () => {
    const game = createGame();
    game.reset();
    const state = { ...game.getSnapshot(), time: 5 };
    const ctx = context(state);
    drawTalk(ctx, { reaction: { text: '이거 이번 달 실적인데…', life: 1 }, speech: { name: '박 과장', text: '벌써 퇴근하는 거야?', x: 320, life: 2 } });
    const texts = ctx.commands.filter(command => command.text).map(command => command.text);
    assert.deepEqual(texts.map(text => text.content), ['이거 이번 달 실적인데...', '박 과장', '벌써 퇴근하는 거야?']);
    assert.ok(texts.every(text => text.font === SPEECH_FONT));
    assert.equal(ctx.commands.filter(command => command.layer?.key.startsWith('talk-')).length, 2, 'one paper bubble per speaker');
    for (const command of ctx.commands) for (const point of [...command.v, ...(command.curves ?? [])]) assert.ok(point.every(Number.isFinite));
});

test('remarks stay quiet where the HUD kept them hidden', () => {
    const game = createGame();
    game.startStage(2);
    const ctx = context(game.getSnapshot());
    drawTalk(ctx, { reaction: { text: 'hi', life: 1 }, speech: { name: 'Kim', text: 'hello', x: 320, life: 2 } });
    assert.equal(ctx.commands.length, 0, 'stage two has its own chair bubbles');
    const paused = context({ ...createGame().getSnapshot(), time: 5 }, { mode: 'pause' });
    drawTalk(paused, { reaction: { text: 'hi', life: 1 }, speech: null });
    assert.equal(paused.commands.length, 0);
});

test('the stage title drops in as a Do Hyeon card and is gone after its moment', () => {
    const game = createGame();
    game.startStage(3);
    const early = context({ ...game.getSnapshot(), time: .8 });
    drawStageTitle(early);
    const title = early.commands.find(command => command.text)?.text;
    assert.equal(title?.content, '03 기계실 & 옥상');
    assert.equal(title?.font, LABEL_FONT);
    assert.ok(early.commands.some(command => command.layer?.key === 'stage-title'));
    const late = context({ ...game.getSnapshot(), time: 2.5 });
    drawStageTitle(late);
    assert.equal(late.commands.length, 0);
});
