import assert from 'node:assert/strict';
import test from 'node:test';
import { GOLDEN_SCENARIOS } from './support/golden.mjs';

// Building fingerprints include the required player jump from the express ramp.
// Update only for an intended gameplay change: run `npm run golden:update` and say why in the PR.
const EXPECTED = {
    'office route': 'dc1474e26415d233',
    'office crash': '0652e26f05b10b96',
    'building exit': 'a7267f88d6718857',
    'building lift': 'b4afd30029ed6c11',
    'rooftop to sky': 'fb2bca14e9ce5a4f',
    'rooftop duct': '08d279f29312f7c7',
};

for (const [name, run] of Object.entries(GOLDEN_SCENARIOS)) {
    test(`gameplay fingerprint is unchanged: ${name}`, () => assert.equal(run(), EXPECTED[name]));
}
