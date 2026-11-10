import assert from 'node:assert/strict';
import test from 'node:test';
import { balancePolicy, begin, play, recordCommands, runWith, sampleCommands } from './replay-harness.mjs';

// Enabled in step 3 of docs/refactor-deterministic-core.md (seeded RNG and fixed ticks).
const scenarios = [
    { name: 'office', start: { stage: 1 }, ticks: 120 * 40 },
    { name: 'building', start: { stage: 2 }, ticks: 120 * 30 },
    { name: 'rooftop', start: { stage: 3 }, ticks: 120 * 20, spray: true },
    { name: 'sky', start: { stage: 4 }, ticks: 120 * 5 },
];

// Closed-loop runs that reach the office geysers (physics randomness) and the corridor typing bubbles.
const routes = [
    { name: 'office route', start: { stage: 1 }, ticks: 120 * 45 },
    { name: 'building route', start: { stage: 2 }, ticks: 120 * 30 },
];

for (const scenario of [...scenarios, ...routes]) {
    const commands = scenario.start && routes.includes(scenario)
        ? recordCommands(31, scenario.start, scenario.ticks, balancePolicy)
        : sampleCommands(scenario.ticks, { spray: scenario.spray });

    test(`same seed and commands end in the same state (${scenario.name})`, () => {
        const a = runWith(31, scenario.start, commands, scenario.ticks).serialize();
        const b = runWith(31, scenario.start, commands, scenario.ticks).serialize();
        assert.equal(a, b);
    });

    // Fails whenever a value that affects play lives outside the serialized state.
    test(`saving and restoring mid-run matches an uninterrupted run (${scenario.name})`, () => {
        const whole = runWith(31, scenario.start, commands, scenario.ticks).serialize();
        for (const cut of [1, Math.floor(scenario.ticks / 3), Math.floor(scenario.ticks * .7)]) {
            const first = play(begin(31, scenario.start), commands, 0, cut);
            const resumed = begin(7);
            resumed.restore(JSON.parse(JSON.stringify(first.serialize())));
            assert.equal(play(resumed, commands, cut, scenario.ticks).serialize(), whole, `cut at tick ${cut}`);
        }
    });
}

test('the office route reaches the geysers and replays them exactly', () => {
    const commands = recordCommands(31, { stage: 1 }, 120 * 45, balancePolicy);
    const game = begin(31, { stage: 1 });
    let geyserHit = false;
    for (let tick = 0; tick < 120 * 45; tick++) {
        play(game, commands, tick, tick + 1);
        const state = game.getSnapshot();
        geyserHit ||= state.player.x > 2560 && state.player.vy < -400;
    }
    assert.ok(geyserHit, 'route should be launched by a geyser at least once');
});

test('different seeds change physics randomness', () => {
    const commands = recordCommands(31, { stage: 1 }, 120 * 45, balancePolicy);
    // Compare just before the focus loss that follows the geysers; later resets hide the difference.
    const player = seed => JSON.stringify(runWith(seed, { stage: 1 }, commands, 1790).getSnapshot().player);
    assert.notEqual(player(31), player(32), 'geyser spin depends on the physics stream');
});

test('game state round-trips through JSON at any stage', () => {
    for (const scenario of scenarios) {
        const game = runWith(5, scenario.start, sampleCommands(240, { spray: scenario.spray }), 240);
        const saved = game.serialize();
        const copy = begin(6);
        copy.restore(JSON.parse(JSON.stringify(saved)));
        assert.equal(copy.serialize(), saved, scenario.name);
        assert.deepEqual(copy.getSnapshot(), game.getSnapshot(), scenario.name);
    }
});
