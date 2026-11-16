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

test('nested transform and layer scopes restore their callers even when drawing throws', () => {
    const ctx = createRenderCtx(createRenderResources({}), createGame().getSnapshot(), createEffects().snapshot());
    const outer = { key: 'outer' }, inner = { key: 'inner' };
    ctx.ox = 12;
    ctx.withLayer(outer, () => {
        assert.throws(() => ctx.withTransform({ ox: 70, rotation: 1 }, () => {
            ctx.withLayer(inner, () => {
                ctx.rect(0, 0, 10, 10, '#ffffff');
                throw new Error('draw failed');
            });
        }), /draw failed/);
        assert.equal(ctx.layer, outer);
        assert.equal(ctx.ox, 12);
        assert.equal(ctx.rotation, 0);
        ctx.rect(0, 0, 10, 10, '#ffffff');
    });
    assert.equal(ctx.layer, null);
    assert.deepEqual(ctx.commands.map(command => command.layer), [inner, outer]);
    ctx.beginLayer(outer);
    ctx.beginLayer(inner);
    ctx.endLayer();
    assert.equal(ctx.layer, outer);
    ctx.endLayer();
    assert.equal(ctx.layer, null);
});
