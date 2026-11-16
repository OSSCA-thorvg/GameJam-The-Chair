import assert from 'node:assert/strict';
import test from 'node:test';
import { GOLDEN_SCENARIOS } from './support/golden.mjs';

const EXPECTED = {
    'office route': 'b27974219fbce37d',
    'office crash': '06817621d12dbf01',
    'building exit': '145f988e0770e074',
    'building lift': '86f1401716b3c088',
    'rooftop to sky': '028fcb4f54cca5db',
    'rooftop duct': '50eab8b7e0d3c44f',
};

for (const [name, run] of Object.entries(GOLDEN_SCENARIOS)) {
    test(`gameplay fingerprint is unchanged: ${name}`, () => assert.equal(run(), EXPECTED[name]));
}
