import assert from 'node:assert/strict';
import test from 'node:test';
import { balancePolicy, begin, play, recordCommands, runWith } from './support/harness.mjs';
import { determinismTests } from './support/determinism.mjs';

// Closed-loop runs that reach the office geysers (physics randomness) and the corridor typing bubbles.
// Each route is recorded once and reused by every test below.
const OFFICE_TICKS = 120 * 45;
const office = recordCommands(31, { stage: 1 }, OFFICE_TICKS, balancePolicy);
const BUILDING_TICKS = 120 * 30;
const building = recordCommands(31, { stage: 2 }, BUILDING_TICKS, balancePolicy);

determinismTests('office route', { stage: 1 }, office, OFFICE_TICKS);
determinismTests('building route', { stage: 2 }, building, BUILDING_TICKS);

test('the office route reaches the geysers and replays them exactly', () => {
    const game = begin(31, { stage: 1 });
    let geyserHit = false;
    for (let tick = 0; tick < OFFICE_TICKS && !geyserHit; tick++) {
        play(game, office, tick, tick + 1);
        const state = game.getSnapshot();
        geyserHit = state.player.x > 2560 && state.player.vy < -400;
    }
    assert.ok(geyserHit, 'route should be launched by a geyser at least once');
});

test('different seeds change physics randomness', () => {
    // Compare just before the focus loss that follows the geysers; later resets hide the difference.
    const player = seed => JSON.stringify(runWith(seed, { stage: 1 }, office, 1790).getSnapshot().player);
    assert.notEqual(player(31), player(32), 'geyser spin depends on the physics stream');
});
