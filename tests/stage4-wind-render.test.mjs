import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createRenderCtx, player, sprayPlume, drawSky, skyWindResponse, previewScenes, skyCoursePlatform } = await loadSource(`
    export { createRenderCtx } from './src/render/context';
    export { player } from './src/render/scene/player';
    export { sprayPlume } from './src/render/scene/spray';
    export { drawSky } from './src/render/scene/sky';
    export { skyWindResponse } from './src/render/scene/sky-wind-response';
    export { previewScenes } from './src/preview-scenes';
    export { skyCoursePlatform } from './src/render/scene/sky-course-art';
`);
const scene = previewScenes.find(scene => scene.id === 'sky-wind-feedback');
function context(time, over = {}) {
    const { state } = scene.sample(time);
    const ctx = createRenderCtx({}, { fillText() {} });
    Object.assign(ctx, { state: { ...state, ...over }, p: state.player, mode: 'play', t: time,
        cam: state.player.x - 380, vertical: 330 - state.player.y });
    return ctx;
}

test('wind tilts only the chair while the worker keeps typing and gameplay stays untouched', () => {
    const calm = context(.3), gust = context(5.3);
    const before = structuredClone(gust.state);
    player(calm); player(gust);
    const backrest = ctx => ctx.commands.find(command => command.c === '#666d80');
    assert.notDeepEqual(backrest(calm).v, backrest(gust).v);
    for (const color of ['#3c424f', '#83c8e4', '#a8b9c3']) {
        assert.deepEqual(gust.commands.filter(command => command.c === color), calm.commands.filter(command => command.c === color),
            'head, glasses and laptop do not inherit the chair wobble');
    }
    assert.deepEqual(gust.state, before);
    const grounded = context(5.3, { ground: true });
    assert.ok(Math.abs(skyWindResponse(grounded).chairTilt) < Math.abs(skyWindResponse(gust).chairTilt));
    const warning = context(3.8);
    assert.notEqual(skyWindResponse(warning).chairTilt, 0, 'warning precedes the actual gust');
    const hand = ctx => ctx.commands.filter(command => command.c === ctx.C.skin).at(-1);
    const later = context(5.35); player(later);
    assert.notDeepEqual(hand(gust), hand(later), 'the worker keeps typing during the gust');
});

test('spray curves with the headwind only in stage four and stays attached at the nozzle', () => {
    const calm = context(.3), gust = context(5.3);
    sprayPlume(calm); sprayPlume(gust);
    const calmCone = calm.commands[0], gustCone = gust.commands[0];
    const reach = cone => cone.curves[0][4] - cone.v[0][0];
    assert.ok(reach(gustCone) < reach(calmCone) - 50, 'older smoke drifts farther left in a gust');
    assert.deepEqual(gustCone.curves.at(-1).slice(4), gustCone.v[0], 'cone returns to its attached origin');
    const idle = context(5.3, { spray: { ...gust.state.spray, burst: 0 } });
    sprayPlume(idle);
    assert.deepEqual(idle.commands, [], 'no extra plume appears when the extinguisher is not firing');
    for (const stage of [1, 2, 3, 5]) {
        const other = context(5.3, { stage });
        assert.deepEqual(skyWindResponse(other), { chairTilt: 0, plumeDrift: 0 });
    }
    for (const phase of ['arrival', 'reveal', 'depth']) {
        assert.deepEqual(skyWindResponse(context(5.3, { sky: { ...gust.state.sky, phase } })), { chairTilt: 0, plumeDrift: 0 });
    }
});

test('open-air wind preview has no wind strokes, remains finite and supports reverse seeking', () => {
    const time = 4.7;
    const frame = scene.sample(time);
    const render = at => {
        const ctx = context(at);
        drawSky(ctx);
        return ctx.commands;
    };
    const commands = render(time);
    const removed = new Set(['sky-wind-lines', 'sky-gust-curls', 'sky-wisps']);
    assert.ok(commands.every(command => !removed.has(command.layer?.key)));
    for (const command of commands) for (const point of [...command.v, ...(command.curves ?? [])]) {
        assert.ok(point.every(Number.isFinite));
    }
    render(7.3); render(.3);
    assert.deepEqual(render(time), commands);
    assert.deepEqual(scene.sample(time), frame);
});

test('billboard copy is ThorVG Text inside the scene, in both languages, never on the label canvas', () => {
    for (const locale of ['en', 'ko']) {
        // A label canvas that throws on any drawing: the copy must not go there any more.
        const ctx = createRenderCtx({}, new Proxy({}, { get: (_, key) => key === 'measureText' ? undefined : () => assert.fail(`lg.${String(key)}`) }));
        Object.assign(ctx, { locale, cam: 4400, vertical: 2500 });
        skyCoursePlatform(ctx, { id: 'last-sign', kind: 'sign', x: 4770, y: -2310, width: 230, angle: -.1 });
        const texts = ctx.commands.filter(command => command.text).map(command => command.text);
        assert.deepEqual(texts.map(text => text.content), locale === 'ko' ? ['흔들리지', '않는 기업'] : ['UNSHAKE', 'ABLE INC.']);
        assert.ok(texts.every(text => text.font === 'Black Han Sans' && text.outline && Math.abs(text.rotation + .1) < 1e-9));
        assert.ok(ctx.commands.at(-1).text, 'the copy is the last thing the sign draws, so actors drawn later cover it');
        const tilted = createRenderCtx({}, {});
        Object.assign(tilted, { locale, cam: 4400, vertical: 2500 });
        skyCoursePlatform(tilted, { id: 'wind-sign', kind: 'sign', x: 4770, y: -2310, width: 230, angle: -1 });
        assert.equal(tilted.commands.some(command => command.text), false);
    }
});
