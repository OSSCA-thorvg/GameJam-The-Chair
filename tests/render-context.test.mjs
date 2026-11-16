import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createRenderCtx, createRenderResources, createGame, createEffects } = await loadSource(`
    export { createRenderCtx, createRenderResources } from './src/render/context';
    export { createGame } from './src/game/game';
    export { createEffects } from './src/render/effects';
`);

test('frame construction supplies valid state and retains only reusable geometry', () => {
    const game = createGame();
    const effects = createEffects();
    const resources = createRenderResources({});
    const first = createRenderCtx(resources, game.getSnapshot(), effects.snapshot());
    let builds = 0;
    const bounds = { left: 10, top: 10, right: 30, bottom: 30 };
    const draw = ctx => ctx.retainedGroup('test', bounds, () => {
        builds++;
        ctx.rect(10, 10, 20, 20, '#ffffff');
    });
    draw(first);
    first.ox = 99;
    first.cutscene = true;
    game.startStage(3);
    const next = createRenderCtx(resources, game.getSnapshot(), effects.snapshot());
    assert.equal(next.state.stage, 3);
    assert.equal(next.p, next.state.player);
    assert.equal(next.LEN, next.state.level.length);
    assert.equal(next.ox, 0);
    assert.equal(next.cutscene, false);
    assert.deepEqual(next.commands, []);
    draw(next);
    assert.equal(builds, 1);
    assert.equal(next.commands.length, 1);
});
