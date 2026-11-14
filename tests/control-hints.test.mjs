import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createGame, createRenderCtx, officeControlHints, rooftopSprayHint, orbitSprayHint } = await loadSource(`
    export { createGame } from './src/game/game';
    export { createRenderCtx } from './src/render/context';
    export { officeControlHints, rooftopSprayHint } from './src/render/scene/control-hints';
    export { orbitSprayHint } from './src/render/scene/orbit-spray-hint';
`);

/** Keycap tops are the light face colour, with the hint's opacity appended. */
const keyTops = commands => commands.filter(command => typeof command.c === 'string' && command.c.startsWith('#f4f1ea'));

function frame(stage, setup = () => {}) {
    const game = createGame();
    game.startStage(stage);
    const state = game.getSnapshot();
    setup(state);
    const ctx = createRenderCtx({});
    Object.assign(ctx, { state, p: state.player, mode: 'play', W: 1000, H: 510, VW: 1000, cam: 0, t: 1, commands: [] });
    return ctx;
}

test('stage one starts with left, right and up keycaps that go once each lesson is done', () => {
    const start = frame(1);
    officeControlHints(start);
    assert.equal(keyTops(start.commands).length, 3, 'left and right over the chair, up over the practice pile');

    const moved = frame(1, state => { state.lessons.moved = true; });
    officeControlHints(moved);
    assert.equal(keyTops(moved.commands).length, 1, 'only up is left once the chair has rolled');

    const done = frame(1, state => { state.lessons.moved = state.lessons.jumped = true; });
    officeControlHints(done);
    assert.equal(keyTops(done.commands).length, 0);

    const intro = frame(1);
    intro.mode = 'intro';
    officeControlHints(intro);
    assert.equal(keyTops(intro.commands).length, 0, 'nothing over the opening');
});

test('stage three shows a Space keycap over the extinguisher, drawn like the stage five hint', () => {
    const rooftop = frame(3);
    rooftopSprayHint(rooftop);
    assert.equal(keyTops(rooftop.commands).length, 1);
    assert.ok(rooftop.commands.some(command => command.text?.content === 'Space'));

    const orbit = frame(5);
    orbitSprayHint(orbit, [500, 300], 4);
    const look = commands => commands.map(command => [typeof command.c === 'string' ? command.c.slice(0, 7) : null, command.stroke?.width ?? 0]);
    assert.deepEqual(look(rooftop.commands), look(orbit.commands), 'the same key: base, top with outline, label');
});
