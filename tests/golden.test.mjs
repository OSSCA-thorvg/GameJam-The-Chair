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
// Updated when the duct shaft became a zig-zag chimney (alternating ledges, pipes, a parapet slot, steam vents,
// slippery printouts, an awake duct that keeps gusting and a flag halfway up): 'rooftop to sky' follows the new
// route, and 'rooftop duct' changes because the duct now gusts on its own after waking.
// Updated when stage three capped the extinguisher at three bursts per time in the air: both rooftop traces
// change, and every final snapshot gains `airSprays`. Without that field the four office/building hashes
// still matched, so their play is unchanged.
// Updated when the office gained the executive printer's urgent-report mode: every final snapshot gains
// `office.urgent` and paper `kind`, and the office routes now pass its volleys.
const EXPECTED = {
    'office route': '384df579e67b7be8',
    'office crash': '95beeba2d857d4c1',
    'building exit': 'd9977bb81547d1ab',
    'building lift': '8073926b292ed8fb',
    'rooftop to sky': '6eaed670ba29c3b7',
    'rooftop duct': '7b197da464e60d87',
};

for (const [name, run] of Object.entries(GOLDEN_SCENARIOS)) {
    test(`gameplay fingerprint is unchanged: ${name}`, () => assert.equal(run(), EXPECTED[name]));
}
