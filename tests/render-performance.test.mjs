import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createGame, createRenderCtx, drawSky, drawRooftop, puffCloud, CLOUD_TONES, effectScaleForArea } = await loadSource(`
    export { createGame } from './src/game/game';
    export { createRenderCtx } from './src/render/context';
    export { drawSky } from './src/render/scene/sky';
    export { drawRooftop } from './src/render/scene/rooftop';
    export { puffCloud, CLOUD_TONES } from './src/render/scene/cloud-art';
    export { effectScaleForArea } from './src/render/perf';
`);

function stageContext(stage, camera = 0) {
    const game = createGame();
    game.startStage(stage);
    const state = game.getSnapshot();
    const ctx = createRenderCtx({});
    Object.assign(ctx, {
        state,
        p: state.player,
        mode: state.mode,
        t: state.time,
        cam: camera,
        W: 1000,
        H: 510,
        VW: 1000,
        scale: 1,
        vertical: stage === 3 ? Math.max(0, 330 - state.player.y) : 0,
    });
    return ctx;
}

test('stage four keeps ThorVG screen blending local to the visible sun halo', () => {
    const ctx = stageContext(4);
    drawSky(ctx);

    assert.ok(!ctx.commands.some(command => command.layer?.key === 'sky-sun'), 'the sun does not allocate a full-canvas Scene');
    const sun = ctx.commands.find(command => command.blend === 'screen' && command.c && typeof command.c !== 'string' && command.c.radius);
    assert.ok(sun, 'the sun still uses a ThorVG radial gradient with Screen blending');
    const xs = sun.v.map(([x]) => x), ys = sun.v.map(([, y]) => y);
    assert.ok(Math.max(...xs) - Math.min(...xs) < ctx.W * .8, 'the glow is bounded around the sun');
    assert.ok(Math.max(...ys) - Math.min(...ys) < ctx.H * .9, 'the glow is not a full-height intermediate');
});

test('effect budgets reduce sampling smoothly without deleting the ThorVG effect', () => {
    assert.equal(effectScaleForArea(50_000, 100_000), 1);
    assert.equal(effectScaleForArea(400_000, 100_000), .55);
    assert.equal(effectScaleForArea(1_000_000, 100_000, .65), .65);
});

test('rooftop scene omits distant structures and restores them when the camera reaches them', () => {
    const entrance = stageContext(3, 0);
    drawRooftop(entrance);
    assert.ok(!entrance.commands.some(command => command.layer?.key === 'graph-rest-glow'), 'the distant billboard is not built');
    assert.ok(!entrance.commands.some(command => command.layer?.key === 'duct-steam'), 'the distant duct effects are not built');

    const billboard = stageContext(3, 2200);
    drawRooftop(billboard);
    assert.ok(billboard.commands.some(command => command.layer?.key === 'graph-rest-glow'), 'the billboard returns inside the viewport');
});

test('small projected clouds use fewer curves while retaining ThorVG gradients', () => {
    const distant = stageContext(4), near = stageContext(4);
    puffCloud(distant, 500, 250, .45, 77, CLOUD_TONES.bread);
    puffCloud(near, 500, 250, 1.5, 77, CLOUD_TONES.bread);
    const curves = ctx => ctx.commands.reduce((sum, command) => sum + (command.curves?.length ?? 0), 0);

    assert.ok(curves(distant) < curves(near), 'distant clouds have a smaller path payload');
    assert.ok(distant.commands.some(command => command.c && typeof command.c !== 'string'), 'LOD retains gradient volume');
});

test('retained groups build local geometry once and move it with an absolute Scene transform', () => {
    const ctx = stageContext(3, 0);
    let builds = 0;
    const draw = () => { builds++; ctx.rect(10, 20, 30, 40, '#336699'); };
    const bounds = { left: 10, top: 20, right: 40, bottom: 60 };

    ctx.retainedGroup('test-geometry', bounds, draw);
    const first = ctx.commands[0];
    ctx.commands = [];
    ctx.cam = 5;
    ctx.retainedGroup('test-geometry', bounds, draw);
    const second = ctx.commands[0];

    assert.equal(builds, 1);
    assert.deepEqual(second.v, first.v, 'cached paths remain in local coordinates');
    assert.notDeepEqual(second.layer.retained.transform, first.layer.retained.transform, 'camera movement changes only the Scene matrix');
});
