import assert from 'node:assert/strict';
import test from 'node:test';
import { GOLDEN_SCENARIOS } from './support/golden.mjs';

// Recorded from main behaviour before splitting systems (step 6) and the core (step 7).
// Update only for an intended gameplay change: run `npm run golden:update` and say why in the PR.
const EXPECTED = {
    'office route': 'dc1474e26415d233',
    'office crash': '0652e26f05b10b96',
    'building exit': '9448ff990d402979',
    'building lift': 'd6f8f06b1a38a8f7',
    'rooftop to sky': 'fb2bca14e9ce5a4f',
    'rooftop duct': '08d279f29312f7c7',
};

for (const [name, run] of Object.entries(GOLDEN_SCENARIOS)) {
    test(`gameplay fingerprint is unchanged: ${name}`, () => assert.equal(run(), EXPECTED[name]));
}
