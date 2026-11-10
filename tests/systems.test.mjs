import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

// Unit tests for pure system decisions: same input, same answer, no state writes.
const bundle = await build({
    stdin: { contents: `export * from './src/game/systems/geyser'; export * from './src/game/systems/monitor';`, resolveDir: process.cwd() },
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
