import assert from 'node:assert/strict';
import test from 'node:test';
import { GOLDEN_SCENARIOS } from './support/golden.mjs';

// Building fingerprints include the orientation hops and the required player jump from the express ramp.
// The route lets go of the keys aboard the convoy: left and right roll within a gap and pick the side a hop clears.
// Update only for an intended gameplay change: run `npm run golden:update` and say why in the PR.
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
