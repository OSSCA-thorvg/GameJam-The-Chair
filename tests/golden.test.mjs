import assert from 'node:assert/strict';
import test from 'node:test';
import { GOLDEN_SCENARIOS } from './golden.mjs';

// Recorded from main behaviour before splitting systems (step 6) and the core (step 7).
// Update only for an intended gameplay change, and say why in the PR.
const EXPECTED = {
    'office route': 'd74348f9e82055d7',
    'office crash': '3a01be0b6f7cf8ef',
    'building exit': '0f11812530db7c6d',
    'building lift': '00cb9515c4984f84',
    'rooftop to sky': '996e728f8127693b',
    'rooftop duct': '438d3e1beab5f2f0',
};

for (const [name, run] of Object.entries(GOLDEN_SCENARIOS)) {
    test(`gameplay fingerprint is unchanged: ${name}`, () => assert.equal(run(), EXPECTED[name]));
}
