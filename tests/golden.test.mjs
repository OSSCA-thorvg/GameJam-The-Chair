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
// Updated when the rooftop's three-spray launch pad was replaced by dropping off the roof onto the sales
// graph: every final snapshot's `rooftop.flight` lost `verticalShots`/`lastShotAt`, and 'rooftop to sky'
// now rolls off the roof edge onto the billboard's graph and rides it straight up.
// Updated when the office gained the executive printer's urgent-report mode: every final snapshot gains
// `office.urgent` and paper `kind`, and the office routes now pass its volleys.
// Updated when the stage-two express got its rush-hour corridor (one speed bump to hop, a launch ramp the
// convoy flies off over a construction hole, the lift and exit moved on): both building routes now ride it.
// Updated when the rooftop duct stopped reacting to the rider's spray and started sneezing on a timer (first
// sneeze `firstSneezeAt` into the attempt, then a gust every `gustPeriod`): the idle duct state gained `rest`,
// so every final snapshot changes, and both rooftop traces follow the new duct timing. The office replay
// fixture was re-recorded for the same `rest` field.
const EXPECTED = {
    'office route': '6d4e4ff9cb972640',
    'office crash': 'ffcea9a999e97afd',
    'building exit': '262bf2bedd003e8a',
    'building lift': '1df1eef9e4fcc9de',
    'rooftop to sky': 'dd3c527edcf3b54b',
    'rooftop duct': '766afd664a275c9b',
};

for (const [name, run] of Object.entries(GOLDEN_SCENARIOS)) {
    test(`gameplay fingerprint is unchanged: ${name}`, () => assert.equal(run(), EXPECTED[name]));
}
