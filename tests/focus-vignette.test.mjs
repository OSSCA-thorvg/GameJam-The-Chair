import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { focusVignetteAlpha, focusVignette, createRenderCtx, createGame } = await loadSource(`
    export { focusVignetteAlpha, focusVignette } from './src/render/scene/focus-vignette';
    export { createRenderCtx } from './src/render/context';
    export { createGame } from './src/game/game';
`);

const peak = focus => Math.max(...Array.from({ length: 170 }, (_, i) => focusVignetteAlpha(focus, 1.7 - i / 100, 0).alpha));

test('a focus hit pulses the vignette harder at 60, 40 and 20 percent', () => {
    const [high, sixty, forty, twenty] = [80, 60, 40, 20].map(peak);
    assert.ok(high > 0, 'every hit shows the vignette');
    assert.ok(sixty > high && forty > sixty && twenty > forty, `${high} < ${sixty} < ${forty} < ${twenty}`);
    assert.equal(focusVignetteAlpha(80, null, 0).alpha, 0, 'no hit, no vignette above 20%');
});

test('the vignette is one border band appended last, and skipped when idle', () => {
    const game = createGame();
    game.reset();
    const state = { ...game.getSnapshot(), mode: 'play', focus: 50, focusNotice: { kind: 'paper', life: 1.6 } };
    const ctx = createRenderCtx({}, { fillText() {} });
    Object.assign(ctx, { state, p: state.player, mode: 'play', t: 0, cam: 0, W: 1000, H: 510, VW: 1000, scale: 1, vertical: 0 });
    focusVignette(ctx);
    assert.equal(ctx.commands.length, 1);
    assert.ok(ctx.commands[0].c.radius, 'drawn with a ThorVG radial gradient');
    assert.ok(ctx.commands[0].v.length > 4, 'the transparent centre is cut out of the path');

    ctx.commands = [];
    ctx.state = { ...state, focusNotice: null };
    focusVignette(ctx);
    assert.equal(ctx.commands.length, 0);
});
