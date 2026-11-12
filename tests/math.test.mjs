import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadSource } from './support/load.mjs';

// src/game/math.ts replaces the engine-approximated Math functions so every browser computes the same bits.
const Det = await loadSource(`export * as Det from './src/game/math';`).then(module => module.Det);

const bits = x => {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, x);
    return view.getBigUint64(0).toString(16).padStart(16, '0');
};
/** Distance in units in the last place between two finite doubles of the same sign. */
const ulps = (a, b) => {
    if (a === b) return 0;
    const view = new DataView(new ArrayBuffer(16));
    view.setFloat64(0, a);
    view.setFloat64(8, b);
    return Number(view.getBigInt64(0) - view.getBigInt64(8) < 0n ? view.getBigInt64(8) - view.getBigInt64(0) : view.getBigInt64(0) - view.getBigInt64(8));
};

test('results are pinned bit for bit, so any engine replays the same physics', () => {
    // Computed once; a change here changes every replay and golden trace.
    const pinned = [
        ['sin', [0.1], '3fb98eaecb8bcb2c'],
        ['sin', [-2.5], 'bfe326af0dcfcab0'],
        ['sin', [1234.5], '3fc29c531dfd031b'],
        ['cos', [0.7], '3fe87996529f9d93'],
        ['cos', [3], 'bfefae04be85e5d2'],
        ['tan', [0.4], '3fdb0f0b49dcdcd8'],
        ['exp', [-0.0333], '3feef3b2cb42fd44'],
        ['exp', [5.5], '406e96244f21bbf6'],
        ['atan2', [0.3, -2], '4007f10e1dc6b048'],
        ['atan2', [-1, 0.2], 'bff5f97315254857'],
        ['hypot', [3.1, 4.7], '40168566e3aa6849'],
        ['hypot', [0.001, 250], '406f4000000112e1'],
    ];
    for (const [name, args, expected] of pinned) assert.equal(bits(Det[name](...args)), expected, `${name}(${args})`);
});

test('accuracy stays within a couple of ulps of the engine over the ranges the game uses', () => {
    const worst = { sin: 0, cos: 0, tan: 0, exp: 0, atan2: 0, hypot: 0 };
    for (let i = 0; i < 20000; i++) {
        const u = ((i * 2654435761) % 1000003) / 1000003;
        const angle = (u - .5) * 40;
        const v = (((i * 40503) % 65521) / 65521 - .5) * 600;
        worst.sin = Math.max(worst.sin, Math.abs(Math.sin(angle)) > 1e-3 ? ulps(Det.sin(angle), Math.sin(angle)) : 0);
        worst.cos = Math.max(worst.cos, Math.abs(Math.cos(angle)) > 1e-3 ? ulps(Det.cos(angle), Math.cos(angle)) : 0);
        const small = (u - .5) * 3;
        worst.tan = Math.max(worst.tan, ulps(Det.tan(small), Math.tan(small)));
        const e = (u - .9) * 40;
        worst.exp = Math.max(worst.exp, ulps(Det.exp(e), Math.exp(e)));
        worst.atan2 = Math.max(worst.atan2, ulps(Det.atan2(v, angle * 7 + .1), Math.atan2(v, angle * 7 + .1)));
        worst.hypot = Math.max(worst.hypot, ulps(Det.hypot(v, angle), Math.hypot(v, angle)));
    }
    for (const [name, value] of Object.entries(worst)) assert.ok(value <= 3, `${name} is ${value} ulps from Math.${name}`);
});

test('special values follow Math', () => {
    for (const name of ['sin', 'cos', 'tan', 'exp']) {
        assert.ok(Number.isNaN(Det[name](NaN)), `${name}(NaN)`);
    }
    assert.ok(Number.isNaN(Det.sin(Infinity)));
    assert.ok(Object.is(Det.sin(-0), -0));
    assert.equal(Det.cos(0), 1);
    assert.equal(Det.exp(0), 1);
    assert.equal(Det.exp(1000), Infinity);
    assert.equal(Det.exp(-1000), 0);
    assert.ok(Det.exp(-740) > 0, 'subnormal results survive');
    assert.equal(Det.hypot(0, 0), 0);
    assert.equal(Det.hypot(3, 4), 5);
    assert.equal(Det.hypot(-Infinity, NaN), Infinity);
    assert.ok(Object.is(Det.atan2(0, 1), 0));
    assert.ok(Object.is(Det.atan2(-0, 1), -0));
    assert.equal(Det.atan2(0, -1), Math.PI);
    assert.equal(Det.atan2(-0, -1), -Math.PI);
    assert.equal(Det.atan2(1, 0), Math.PI / 2);
    assert.equal(Det.atan2(-1, 0), -Math.PI / 2);
    assert.equal(Det.atan2(Infinity, Infinity), Math.PI / 4);
    assert.equal(Det.atan2(1, -Infinity), Math.PI);
});

test('the core never calls engine-approximated Math functions', () => {
    const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? files(path) : path.endsWith('.ts') ? [path] : [];
    });
    const banned = /\bMath\.(sin|cos|tan|asin|acos|atan2?|sinh|cosh|tanh|asinh|acosh|atanh|exp|expm1|log(1p|2|10)?|pow|cbrt|hypot)\s*\(/;
    for (const path of files('src/game')) {
        if (path === join('src', 'game', 'math.ts')) continue;
        const code = readFileSync(path, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        assert.doesNotMatch(code, banned, `${path} uses an engine-approximated Math function`);
    }
});
