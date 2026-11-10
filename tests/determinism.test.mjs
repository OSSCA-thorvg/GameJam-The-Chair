import assert from 'node:assert/strict';
import test from 'node:test';
import { begin, play, runWith, sampleCommands } from './replay-harness.mjs';

// Enabled in step 3 of docs/refactor-deterministic-core.md (seeded RNG and fixed ticks).
const scenarios = [
    { name: 'office', start: { stage: 1 }, ticks: 120 * 40 },
    { name: 'building', start: { stage: 2 }, ticks: 120 * 30 },
    { name: 'rooftop', start: { stage: 3 }, ticks: 120 * 20, spray: true },
    { name: 'sky', start: { stage: 4 }, ticks: 120 * 5 },
];

for (const scenario of scenarios) {
    const commands = sampleCommands(scenario.ticks, { spray: scenario.spray });

    test.skip(`same seed and commands end in the same state (${scenario.name})`, () => {
        const a = runWith(1234, scenario.start, commands, scenario.ticks).serialize();
        const b = runWith(1234, scenario.start, commands, scenario.ticks).serialize();
        assert.equal(a, b);
    });

    // Fails whenever a value that affects play lives outside the serialized state.
    test.skip(`saving and restoring mid-run matches an uninterrupted run (${scenario.name})`, () => {
        const whole = runWith(99, scenario.start, commands, scenario.ticks).serialize();
        for (const cut of [1, Math.floor(scenario.ticks / 3), Math.floor(scenario.ticks * .7)]) {
            const first = play(begin(99, scenario.start), commands, 0, cut);
            const resumed = begin(7);
            resumed.restore(JSON.parse(JSON.stringify(first.serialize())));
            assert.equal(play(resumed, commands, cut, scenario.ticks).serialize(), whole, `cut at tick ${cut}`);
        }
    });
}
