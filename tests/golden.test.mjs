import assert from 'node:assert/strict';
import test from 'node:test';
import { GOLDEN_SCENARIOS } from './support/golden.mjs';

// Building fingerprints include the orientation hops and the required player jump from the express ramp.
// Update only for an intended gameplay change: run `npm run golden:update` and say why in the PR.
const EXPECTED = {
    'office route': 'b27974219fbce37d',
    'office crash': '06817621d12dbf01',
    'building exit': 'af0e0e2344fdce1a',
    'building lift': '9821efa48e5b6ac2',
    'rooftop to sky': '028fcb4f54cca5db',
    'rooftop duct': '50eab8b7e0d3c44f',
};

for (const [name, run] of Object.entries(GOLDEN_SCENARIOS)) {
    test(`gameplay fingerprint is unchanged: ${name}`, () => assert.equal(run(), EXPECTED[name]));
}
