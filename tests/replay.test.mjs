import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame } from './support/harness.mjs';
import { testRealtimeReplay } from './support/realtime-replay.mjs';

testRealtimeReplay(1);
testRealtimeReplay(2);

test('held keys are recorded only when they change', () => {
    const log = [];
    const game = createGame({ onCommand: (tick, command) => log.push([tick, command]) });
    game.reset();
    for (let i = 0; i < 5; i++) game.press('right');
    game.setInput('right');
    game.release('left');
    game.step();
    game.release('right');
    assert.deepEqual(log.map(([tick, command]) => [tick, command.type, command.keys]), [
        [0, 'reset', undefined],
        [0, 'keys', ['right']],
        [1, 'keys', []],
    ]);
});
