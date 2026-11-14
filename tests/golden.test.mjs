import assert from 'node:assert/strict';
import test from 'node:test';
import { GOLDEN_SCENARIOS } from './support/golden.mjs';

// Building fingerprints include the orientation hops and the required player jump from the express ramp.
// Update only for an intended gameplay change: run `npm run golden:update` and say why in the PR.
const EXPECTED = {
    'office route': '3613a58c65781fb3',
    'office crash': 'b3b1dec63a856d38',
    'building exit': '5f4ce03bc0f2e549',
    'building lift': '8d6ed6a224e00edc',
    'rooftop to sky': '01b8dd452ad39297',
    'rooftop duct': '0b29e3a86198f382',
};

for (const [name, run] of Object.entries(GOLDEN_SCENARIOS)) {
    test(`gameplay fingerprint is unchanged: ${name}`, () => assert.equal(run(), EXPECTED[name]));
}
