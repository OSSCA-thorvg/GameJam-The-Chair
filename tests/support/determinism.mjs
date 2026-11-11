// The two determinism checks shared by the scripted and closed-loop determinism tests.
import assert from 'node:assert/strict';
import test from 'node:test';
import { begin, play, runWith } from './harness.mjs';

export function determinismTests(name, start, commands, ticks) {
    let reference = null;
    const whole = () => reference ??= runWith(31, start, commands, ticks).serialize();

    test(`same seed and commands end in the same state (${name})`, () => {
        assert.equal(runWith(31, start, commands, ticks).serialize(), whole());
    });

    // Fails whenever a value that affects play lives outside the serialized state.
    test(`saving and restoring mid-run matches an uninterrupted run (${name})`, () => {
        for (const cut of [1, Math.floor(ticks / 3), Math.floor(ticks * .7)]) {
            const first = play(begin(31, start), commands, 0, cut);
            const resumed = begin(7);
            resumed.restore(JSON.parse(JSON.stringify(first.serialize())));
            assert.equal(play(resumed, commands, cut, ticks).serialize(), whole(), `cut at tick ${cut}`);
        }
    });
}
