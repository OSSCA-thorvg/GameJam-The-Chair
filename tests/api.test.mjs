import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame } from './replay-harness.mjs';

// The public surface that UI, preview scenes and tests depend on. Keep it stable through the core refactor.
const PUBLIC_API = [
    'reset', 'restart', 'startStage', 'jump', 'spray', 'interact', 'leaveMeeting', 'pause',
    'setInput', 'press', 'release', 'clearInput',
    'step', 'advance', 'advanceImpact', 'advanceFocusLoss',
    'getSnapshot', 'drainEvents',
];

test('createGame keeps its public API', () => {
    const game = createGame();
    for (const name of PUBLIC_API) assert.equal(typeof game[name], 'function', name);
});
