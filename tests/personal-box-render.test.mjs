import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createRenderCtx, personalBox } = await loadSource(`
    export { createRenderCtx } from './src/render/context';
    export { personalBox } from './src/render/scene/personal-box';
`);

test('personal belongings render without text and restore the scene transform', () => {
    for (const locale of ['en', 'ko']) for (const scale of [.7, 1]) {
        const ctx = createRenderCtx({});
        Object.assign(ctx, { locale, scale, ox: 13, oy: 27, rotation: .2, localScale: .9 });
        personalBox(ctx);
        assert.deepEqual(ctx.commands.filter(command => command.text), [], 'belongings tell the story without labels');
        assert.deepEqual([ctx.ox, ctx.oy, ctx.rotation, ctx.localScale], [13, 27, .2, .9]);
        assert.ok(ctx.commands.some(command => command.curves?.length && command.stroke), 'mug and lanyard retain curved strokes');
        assert.ok(ctx.commands.some(command => command.curves?.length && command.c), 'plant retains curved leaves');
        assert.ok(ctx.commands.some(command => command.c && typeof command.c !== 'string'), 'box and contents retain ThorVG gradients');
        for (const command of ctx.commands) {
            for (const point of [...command.v, ...(command.curves ?? [])]) assert.ok(point.every(Number.isFinite));
        }
    }
});

test('the readable badge portrait hangs at the upper right and disappears when its back turns', () => {
    const ctx = createRenderCtx({});
    personalBox(ctx);
    const front = ctx.commands;
    const glasses = front.filter(command => command.c === '#83c8e4');
    assert.equal(glasses.length, 2, 'portrait wears blue glasses');
    assert.ok(glasses.every(command => command.v[1][0] - command.v[0][0] >= 6), 'lenses remain legible on the small box');
    assert.ok(glasses.every(command => command.v[0][0] > 1330 && command.v[0][1] < 355), 'portrait sits above the right rim');
    assert.ok(front.some(command => command.c === '#3c424f'), 'portrait has the player’s black hair');
    assert.ok(front.some(command => command.c === '#a65e44'), 'portrait has the player’s red tie');
    ctx.commands = [];
    ctx.personalBox = { kind: 'farewell', side: -1, passed: 1 };
    ctx.t = 3;
    personalBox(ctx);
    assert.ok(ctx.commands.some(command => command.c === '#bec8c5'), 'blank badge back faces the viewer');
    for (const color of ['#83c8e4', '#3c424f', '#a65e44']) {
        assert.ok(!ctx.commands.some(command => command.c === color), 'portrait is hidden on the back');
    }
    const box = commands => commands.filter(command => command.c === '#796955' || command.c === '#cbb295');
    assert.deepEqual(box(ctx.commands), box(front), 'carton stays fixed throughout the farewell');
});

test('personal box sits below the chair seat, with a small recessed mug and shoulder-height leaves', () => {
    const ctx = createRenderCtx({});
    personalBox(ctx);
    const body = ctx.commands.find(command => command.v.length === 4
        && command.v[1][0] - command.v[0][0] > 70 && command.v[1][0] - command.v[0][0] < 80
        && command.v[2][1] - command.v[1][1] > 35 && command.v[2][1] - command.v[1][1] < 40);
    assert.ok(body);
    assert.equal(body.v[2][1], 396, 'box bottom remains on the existing floor');
    assert.ok(body.v[0][1] > 353 && body.v[0][1] < 365, 'box rim is slightly below the chair seat');
    const mug = ctx.commands.find(command => command.c === '#edf0e4');
    const mugWidth = Math.max(...mug.v.map(([x]) => x)) - Math.min(...mug.v.map(([x]) => x));
    assert.ok(mugWidth < 16, 'mug is smaller than the seated person’s head');
    assert.ok(Math.min(...mug.v.map(([, y]) => y)) > 340, 'mug is tucked down into the box');
    const points = ctx.commands.flatMap(command => [...command.v, ...(command.curves ?? []).flatMap(curve => [[curve[0], curve[1]], [curve[2], curve[3]], [curve[4], curve[5]]])]);
    const highest = Math.min(...points.map(([, y]) => y));
    assert.ok(highest >= 300 && highest <= 325, 'leaf tips sit around shoulder height');
    const rightmost = Math.max(...points.map(([x]) => x));
    assert.ok(1420 - 31 - rightmost > 30, 'resting shaft chair has clear space beside the box');
});
