import assert from 'node:assert/strict';
import test from 'node:test';
import { GOLDEN_SCENARIOS } from './support/golden.mjs';

// Recorded from main behaviour before splitting systems (step 6) and the core (step 7).
// Update only for an intended gameplay change: run `npm run golden:update` and say why in the PR.
// Updated when merging main's stage 4 course: snapshots gained `sky`, and the sky stage itself changed.
// Stages 1-3 traces were checked to match the previous hashes with `sky` removed.
// Updated when stage code moved into stages/<stage>/: the office copier no longer runs in other stages, so their
// ticks stop emitting the paper `particles-step` event, and the office no longer creates the building's chairs
// (unused there). With those two removed from the old run, all six traces matched.
// Updated when the sleeping rooftop duct started waking from further away (260 instead of 170 in front, 120 instead
// of 80 vertically): the stage-three route now sets off the first sneeze earlier. Only 'rooftop to sky' changed.
const EXPECTED = {
    'office route': 'b44f75772237eac8',
    'office crash': '812fe21e31464a0f',
    'building exit': '9ea83d27fd4d405c',
    'building lift': '55c6191b1aca87c7',
    'rooftop to sky': 'c9c0ddc7dfb63c75',
    'rooftop duct': '5a37466f95ddf268',
};

for (const [name, run] of Object.entries(GOLDEN_SCENARIOS)) {
    test(`gameplay fingerprint is unchanged: ${name}`, () => assert.equal(run(), EXPECTED[name]));
}
