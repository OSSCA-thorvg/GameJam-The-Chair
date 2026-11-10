import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const bundle = await build({ stdin: { contents: `export {createCore} from './src/game/core'; export {ductSpray,rooftopStep} from './src/game/systems/rooftop'; export {createRenderCtx} from './src/render/context'; export {rooftopDuct} from './src/render/scene/rooftop-duct';`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });
const { createCore, ductSpray, rooftopStep, createRenderCtx, rooftopDuct } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
function front() {
    const s = createCore({ seed: 0 }); s.stage = 3; s.hasExtinguisher = true;
    s.p = { x: 1600, y: 226, vx: 0, vy: 0, a: 0, w: 0 };
    return s;
}
function tick(s, seconds) { for (let i = 0; i < Math.ceil(seconds * 120); i++) rooftopStep(s, [], 1 / 120); }
function palms(s) {
    const ctx = createRenderCtx({}, {}); Object.assign(ctx, { state: s }); rooftopDuct(ctx);
    return ctx.commands.filter(command => command.c === '#a18a45').map(command => command.v);
}

test('each spray in front triggers independently, including overlapping sprays', () => {
    const s = front();
    for (const x of [-1, 0, 1]) { s.sprayDir = { x, y: 1 }; ductSpray(s); }
    assert.equal(s.ductReaction.shots, 3);
    assert.deepEqual(s.ductReaction.bursts.map(burst => burst.kind), ['first', 'repeat', 'repeat']);
    tick(s, .25);
    assert.equal(s.ductReaction.bursts.length, 3, 'a new spray cannot cancel the first reaction');
    assert.ok(s.p.vx <= -285, 'first wind supplies the stronger knockback');
});

test('first wind ejects gloves once and subsequent wind is weaker without re-ejecting them', () => {
    const s = front(); ductSpray(s);
    tick(s, .1); assert.equal(s.p.vx, 0, 'inhale precedes the wind');
    tick(s, .11); const first = s.p.vx;
    assert.equal(first, -285);
    tick(s, 2); assert.equal(s.ductReaction.kind, 'done');
    const settled = palms(s); assert.equal(settled.length, 3);
    s.p.vx = 0; s.p.vy = 0;
    ductSpray(s);
    assert.equal(s.ductReaction.shots, 2);
    assert.deepEqual(s.ductReaction.bursts.map(burst => burst.kind), ['repeat']);
    tick(s, .13);
    assert.equal(s.p.vx, -120);
    assert.ok(Math.abs(s.p.vx) < Math.abs(first));
    assert.deepEqual(palms(s), settled, 'gloves stay settled instead of launching again');
    s.p.vx = 0; tick(s, .05);
    assert.equal(s.p.vx, 0, 'one wind pulse applies only one impulse');
    tick(s, 1); ductSpray(s);
    assert.equal(s.ductReaction.shots, 3, 'later visits still trigger the effect');
});

test('the front trigger excludes the rear, upper shaft and other stages', () => {
    for (const [x, y, stage] of [[1800, 226, 3], [1600, 30, 3], [1200, 226, 3], [1600, 226, 4]]) {
        const s = front(); s.p.x = x; s.p.y = y; s.stage = stage;
        ductSpray(s); assert.equal(s.ductReaction.kind, 'idle');
    }
});
