import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

// Unit tests for pure system decisions: same input, same answer, no state writes.
const bundle = await build({
    stdin: { contents: `export * from './src/game/systems/geyser'; export * from './src/game/systems/monitor'; export * from './src/game/systems/bin'; export * from './src/game/systems/cleaning';`, resolveDir: process.cwd() },
    bundle: true, write: false, platform: 'node', format: 'esm',
});
const sys = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const F = 420;

test('geyser launches only during a burst, near the vent and low enough', () => {
    const burstAt = 3.2; // geyser 0: period 3.5, offset 0, burst from 3.1
    assert.equal(sys.geyserHits({ x: 2600, y: F - 28 }, 1, 7).length, 0, 'resting');
    assert.equal(sys.geyserHits({ x: 2700, y: F - 28 }, burstAt, 7).length, 0, 'too far');
    assert.equal(sys.geyserHits({ x: 2600, y: F - 200 }, burstAt, 7).length, 0, 'too high');
    const [hit] = sys.geyserHits({ x: 2590, y: F - 28 }, burstAt, 7);
    assert.equal(hit.push, -90, 'pushes away from the vent');
    assert.ok(Math.abs(hit.spin) <= 3);
    assert.notEqual(hit.rng, 7, 'spin consumes the physics stream');
    assert.deepEqual(sys.geyserHits({ x: 2590, y: F - 28 }, burstAt, 7), [hit], 'deterministic');
    assert.deepEqual(hit.focus, { kind: 'paper', id: 1000, damage: 30 });
});

test('a lit monitor pushes the chair back the way it came', () => {
    const lit = 1; // monitor 0: active from .8 to 2.1
    assert.equal(sys.monitorContact({ x: 2110, y: 392 }, 2100, .2), null, 'warning only');
    assert.equal(sys.monitorContact({ x: 2110, y: 200 }, 2100, lit), null, 'above the screens');
    assert.deepEqual(sys.monitorContact({ x: 2110, y: 392 }, 2100, lit), { index: 0, x: 2065, vx: -65, focus: { kind: 'light', id: 0, damage: 30 } });
    assert.equal(sys.monitorContact({ x: 2110, y: 392 }, 2120, lit).vx, 65, 'from the right');
});

test('the office bin catches a falling chair over its opening only', () => {
    const over = { x: 1660, y: 380, vx: 0, vy: 50, a: 0, w: 0 };
    assert.equal(sys.fallsIntoBin(over, 0), true);
    assert.equal(sys.fallsIntoBin({ ...over, vy: -10 }, 0), false, 'rising');
    assert.equal(sys.fallsIntoBin(over, .5), false, 'cooling down');
    assert.equal(sys.fallsIntoBin({ ...over, x: 1590 }, 0), false, 'on the rim');
    assert.equal(sys.fellOffFloor({ x: 0, y: 671 }), true);
    assert.equal(sys.fellOffFloor({ x: 0, y: 670 }), false);
    assert.throws(() => { sys.BIN_REST.x = 0; });
});

test('the bucket tips once when approached, splashes nearby riders and must refill', () => {
    const cleaning = { x: 1095, a: 1035, b: 1360, spilled: false, age: 0, followup: false, splashDir: 0 };
    const bucket = { age: 2.2, armed: true, spills: 0 };
    const input = { p: { x: 1000, y: 392 }, cleaning, bucket, soakedOnSpill: 0 };
    const first = sys.cleaningStep(input, 1 / 120);
    assert.equal(first.splash, true);
    assert.equal(first.cleaning.splashDir, -1);
    assert.deepEqual(first.soak, { kind: 'water', id: 1, damage: 30 });
    assert.equal(cleaning.spilled, false, 'input untouched');
    const again = sys.cleaningStep({ ...input, cleaning: first.cleaning, bucket: first.bucket, soakedOnSpill: 1 }, 1 / 120);
    assert.equal(again.splash, false, 'not refilled yet');
    assert.equal(again.soak, null, 'one soak per spill');
    const far = sys.cleaningStep({ ...input, p: { x: 600, y: 392 } }, 1 / 120);
    assert.equal(far.splash, false);
});
