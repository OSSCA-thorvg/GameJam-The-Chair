import assert from 'node:assert/strict';

export function runUntil(done, step, { maxSteps, message }) {
    for (let steps = 0; !done(); steps++) {
        assert.ok(steps < maxSteps, `${message} (limit: ${maxSteps} steps)`);
        step();
    }
}
