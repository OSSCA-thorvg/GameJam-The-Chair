import assert from 'node:assert/strict';
import test from 'node:test';

import { GOLDEN_SCENARIOS } from './support/golden.mjs';

// Canonical JSON fingerprints verified against unchanged gameplay at 867ac0a.
const EXPECTED = {
    'office route': '674b270a2aee5b1f',
    'office crash': 'b18a7a4073407019',
    'building exit': 'c257a2471db3a892',
    'building lift': '12cd32921b3f04a2',
    'rooftop to sky': 'e0c6fb6d705954cc',
    'rooftop duct': '0331a8e9043e23b7',
};

for (const [name, run] of Object.entries(GOLDEN_SCENARIOS)) {
    test(`gameplay fingerprint is unchanged: ${name}`, () =>
        assert.equal(run(), EXPECTED[name]));
}
