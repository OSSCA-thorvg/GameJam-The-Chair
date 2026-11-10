import assert from 'node:assert/strict';
import test from 'node:test';
import { GOLDEN_SCENARIOS } from './golden.mjs';

// Recorded from main behaviour before splitting systems (step 6) and the core (step 7).
// Update only for an intended gameplay change, and say why in the PR.
// Updated when merging main's stage 4 course: snapshots gained `sky`, and the sky stage itself changed.
// Stages 1-3 traces were checked to match the previous hashes with `sky` removed.
const EXPECTED = {
    'office route': 'e040a20119763c4e',
    'office crash': '99dde0c3b7445744',
    'building exit': '2958553c7b0520ff',
    'building lift': '44aa1dd32573d7a4',
    'rooftop to sky': 'bffae866bd80ed0a',
    'rooftop duct': '6a76706fdb06a00c',
};

for (const [name, run] of Object.entries(GOLDEN_SCENARIOS)) {
    test(`gameplay fingerprint is unchanged: ${name}`, () => assert.equal(run(), EXPECTED[name]));
}
