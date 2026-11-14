import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createGame, createRenderCtx, player } = await loadSource(`
    export { createGame } from './src/game/game';
    export { createRenderCtx } from './src/render/context';
    export { player } from './src/render/scene/player';
`);

/** The side-view rider drawn large, as the 2D stages show him. */
function rider() {
    const game = createGame();
    game.startStage(1);
    const state = structuredClone(game.getSnapshot());
    const ctx = createRenderCtx({});
    const p = state.player;
    Object.assign(ctx, { state, p, mode: 'play', locale: 'en', W: 700, H: 600, t: 2, scale: 5, cam: p.x - 20, vertical: -p.y + 120 });
    player(ctx);
    return ctx.commands;
}
const extent = commands => {
    const points = commands.flatMap(command => command.v);
    const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
    return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), left: Math.min(...xs) };
};

test('side on, the rider’s glasses show the lens edge-on as a thin line, as the 3D side view does', () => {
    const commands = rider();
    const lens = commands.filter(command => command.c === '#83c8e4');
    assert.ok(lens.length > 0, 'the lens is drawn');
    const { width, height } = extent(lens);
    assert.ok(height > width * 3, `a thin upright line, not a lens surface (${width.toFixed(1)} by ${height.toFixed(1)})`);
    assert.ok(!commands.some(command => command.c === '#bfe6ef'), 'no face-on reflection stripe side on');
    // The eye sits on the face behind the line; the arm runs back from the line to the ear.
    const eye = extent(commands.filter(command => command.c === '#446d82'));
    assert.ok(eye.left < extent(lens).left, 'the eye is behind the lens line');
    assert.ok(commands.some(command => command.c === '#3a414b'), 'the arm runs back to the ear');
});
