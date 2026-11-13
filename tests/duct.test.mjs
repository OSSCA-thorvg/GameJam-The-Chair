import assert from 'node:assert/strict';
import test from 'node:test';
import { bundled } from './support/load.mjs';
const { createCore, viewState, applyRooftop, rooftopHooks, createRenderCtx, rooftopDuct, DUCT_PROP_COLORS, STAGE_THREE } = await bundled({ stdin: { contents: `export {createCore} from './src/game/state'; export {viewState} from './src/game/game'; export {applyRooftop} from './src/game/stages/rooftop/course/apply'; export {rooftopHooks} from './src/game/stages/rooftop/hooks'; export {createRenderCtx} from './src/render/context'; export {rooftopDuct, DUCT_PROP_COLORS} from './src/render/scene/rooftop-duct'; export {STAGE_THREE} from './src/game/stages/rooftop/data';`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });
const D = STAGE_THREE.duct;
function at(x, y = 226) {
    const s = createCore({ seed: 0 }); s.stage = 3; s.hasExtinguisher = true;
    s.p = { x, y, vx: 0, vy: 0, a: 0, w: 0 };
    return s;
}
function tick(s, seconds) { for (let i = 0; i < Math.round(seconds * 120); i++) applyRooftop(s, [], 1 / 120); }
// The ejected junk: four energy-drink cans, three coffee cups, an empty badge, two ties and twelve printouts.
function props(s) {
    const ctx = createRenderCtx({}); Object.assign(ctx, { state: viewState(s) }); rooftopDuct(ctx);
    const marks = Object.values(DUCT_PROP_COLORS);
    return ctx.commands.filter(command => marks.includes(command.c)).map(command => command.v);
}

test('the duct sneezes first on a timer, wherever the rider is', () => {
    for (const x of [300, 1600]) {
        const s = at(x);
        tick(s, D.firstSneezeAt - .05);
        assert.equal(s.rooftop.duct.kind, 'idle', 'nothing before the timer');
        tick(s, .1);
        assert.equal(s.rooftop.duct.kind, 'reacting', `the first sneeze starts on time with the rider at x=${x}`);
        assert.deepEqual(s.rooftop.duct.bursts.map(burst => burst.kind), ['first']);
    }
});

test('spraying at the duct no longer wakes it or makes it sneeze', () => {
    const s = at(1600); s.ground = true;
    for (let i = 0; i < 5; i++) { rooftopHooks.onSpray(s); s.rooftop.airSprays = 0; tick(s, .3); }
    assert.equal(s.rooftop.duct.kind, 'idle');
    assert.equal(s.p.vx, 0);
});

test('the first sneeze ejects the overtime junk once; later gusts keep their period and leave it settled', () => {
    const s = at(1600);
    tick(s, D.firstSneezeAt + D.inhaleDuration + D.twitchDuration - .03);
    assert.equal(s.p.vx, 0, 'inhale precedes the wind');
    tick(s, .05);
    assert.equal(s.p.vx, -D.firstKnockback);
    let quiet = 0;
    while (s.rooftop.duct.kind !== 'done') tick(s, 1 / 120);
    const settled = props(s); assert.equal(settled.length, 22);
    s.p = { x: 1600, y: 226, vx: 0, vy: 0, a: 0, w: 0 };
    while (s.rooftop.duct.kind === 'done') { tick(s, 1 / 120); quiet += 1 / 120; }
    assert.ok(Math.abs(quiet - D.gustPeriod) < .02, `the gust comes after its period (${quiet.toFixed(3)} s)`);
    assert.deepEqual(s.rooftop.duct.bursts.map(burst => burst.kind), ['gust']);
    tick(s, D.gustInhaleDuration + D.gustTwitchDuration);
    assert.equal(s.p.vx, -D.gustKnockback);
    assert.deepEqual(props(s), settled, 'the junk stays settled instead of launching again');
});

test('a gust only knocks back a rider in front of the duct', () => {
    for (const [x, y] of [[1800, 226], [1600, 30], [1200, 226]]) {
        const s = at(x, y);
        tick(s, D.firstSneezeAt + 1);
        assert.equal(s.p.vx, 0, `rider at ${x},${y} is untouched`);
    }
});
