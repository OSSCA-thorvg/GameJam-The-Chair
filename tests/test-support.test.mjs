import assert from 'node:assert/strict';
import test from 'node:test';

import { runUntil } from './support/until.mjs';

test('bounded simulation stops on the target and does not step an already satisfied condition', () => {
    let ticks = 0;
    const advance = () => ticks++;
    runUntil(() => ticks === 3, advance, {
        maxSteps: 3,
        message: 'target tick',
    });
    assert.equal(ticks, 3);
    runUntil(() => true, advance, { maxSteps: 0, message: 'already there' });
    assert.equal(ticks, 3);
});

test('an unreachable simulation target fails after the allowed steps', () => {
    let ticks = 0;
    assert.throws(
        () =>
            runUntil(
                () => false,
                () => ticks++,
                {
                    maxSteps: 3,
                    message: 'beam never locked',
                },
            ),
        { code: 'ERR_ASSERTION', message: /beam never locked.*3 steps/ },
    );
    assert.equal(ticks, 3);
});
