import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createGame, createRenderCtx, officeControlHints, rooftopSprayHint } = await loadSource(`
    export { createGame } from './src/game/game';
    export { createRenderCtx } from './src/render/context';
    export { officeControlHints, rooftopSprayHint } from './src/render/scene/control-hints';
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

test('each keycap goes as soon as its key is pressed', () => {
    const pressed = keys => {
        const ctx = frame(1);
        ctx.keysTried = { left: false, right: false, jump: false, spray: false, ...keys };
        officeControlHints(ctx);
        return keyTops(ctx.commands).length;
    };
    assert.equal(pressed({ right: true }), 2, 'left over the chair and up over the pile stay');
    assert.equal(pressed({ left: true, right: true }), 1);
    assert.equal(pressed({ jump: true }), 2, 'up goes, left and right stay');

    const rooftop = frame(3);
    rooftop.keysTried = { left: false, right: false, jump: false, spray: true };
    rooftopSprayHint(rooftop);
    assert.equal(keyTops(rooftop.commands).length, 0, 'Space goes once sprayed');
});

test('the effects remember the keys tried until the stage changes', async () => {
    const { createEffects } = await loadSource(`export { createEffects } from './src/render/effects';`);
    const effects = createEffects();
    const at = stage => ({ stage, deaths: 0, time: 1, player: { x: 0, y: 0, vx: 0, vy: 0, a: 0, w: 0 } });
    effects.observe(at(1));
    effects.pressKey('left');
    effects.observe(at(1));
    assert.equal(effects.snapshot().keysTried.left, true);
    effects.observe(at(3));
    assert.equal(effects.snapshot().keysTried.left, false, 'a new stage brings the hints back');
});

test('stage three shows a Space keycap over the extinguisher', () => {
    const rooftop = frame(3);
    rooftopSprayHint(rooftop);
    assert.equal(keyTops(rooftop.commands).length, 1);
    assert.ok(rooftop.commands.some(command => command.text?.content === 'Space'));

});
