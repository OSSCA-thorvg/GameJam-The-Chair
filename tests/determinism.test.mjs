import assert from 'node:assert/strict';
import test from 'node:test';
import { begin, runWith, sampleCommands } from './support/harness.mjs';
import { determinismTests } from './support/determinism.mjs';

// Scripted inputs in every stage. Closed-loop routes are in determinism-routes.test.mjs.
const scenarios = [
    { name: 'office', start: { stage: 1 }, ticks: 120 * 40 },
    { name: 'building', start: { stage: 2 }, ticks: 120 * 30 },
    { name: 'rooftop', start: { stage: 3 }, ticks: 120 * 20, spray: true },
    { name: 'sky', start: { stage: 4 }, ticks: 120 * 5 },
];

for (const scenario of scenarios) {
    determinismTests(scenario.name, scenario.start, sampleCommands(scenario.ticks, { spray: scenario.spray }), scenario.ticks);
}

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
