import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createRenderCtx, riderStains, MAX_STAIN_LAYERS } = await loadSource(`
    export { createRenderCtx } from './src/render/context';
    export { riderStains, MAX_STAIN_LAYERS } from './src/render/scene/player-stains';
`);

const stains = soaks => {
    const ctx = createRenderCtx({});
    riderStains(ctx, soaks);
    return ctx.commands;
};

test('no stains before the rider is splashed', () => {
    assert.equal(stains(0).length, 0);
});

test('every splash adds more stains, up to a cap', () => {
    for (let soaks = 1; soaks < MAX_STAIN_LAYERS; soaks++) {
        assert.ok(stains(soaks + 1).length > stains(soaks).length, `soak ${soaks + 1} adds stains`);
    }
    assert.equal(stains(MAX_STAIN_LAYERS + 3).length, stains(MAX_STAIN_LAYERS).length);
});

test('the same number of soakings always draws the same stains', () => {
    assert.deepEqual(stains(4).map(command => command.v), stains(4).map(command => command.v));
});
