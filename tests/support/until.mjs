import assert from 'node:assert/strict';

/** Bounds simulated steps so a missing transition fails instead of hanging the test process. */
export function runUntil(done, step, { maxSteps, message }) {
    for (let steps = 0; !done(); steps++) {
        assert.ok(steps < maxSteps, `${message} (limit: ${maxSteps} steps)`);
        step();
    }
}
