import assert from 'node:assert/strict';
import test from 'node:test';
import { GOLDEN_SCENARIOS } from './support/golden.mjs';

// Building fingerprints include the orientation hops and the required player jump from the express ramp.
// The route lets go of the keys aboard the convoy, since left and right roll between the chairs.
// Update only for an intended gameplay change: run `npm run golden:update` and say why in the PR.
const EXPECTED = {
    'office route': 'b27974219fbce37d',
    'office crash': '06817621d12dbf01',
    'building exit': '36e71924d7890bb8',
    'building lift': 'c237e3ef1906f47d',
    'rooftop to sky': '028fcb4f54cca5db',
    'rooftop duct': '50eab8b7e0d3c44f',
};

for (const [name, run] of Object.entries(GOLDEN_SCENARIOS)) {
    test(`gameplay fingerprint is unchanged: ${name}`, () => assert.equal(run(), EXPECTED[name]));
}
