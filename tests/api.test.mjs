import assert from 'node:assert/strict';
import test from 'node:test';

import { createGame } from './support/harness.mjs';
import { bundled } from './support/load.mjs';

const PUBLIC_API = [
    'reset',
    'restart',
    'startStage',
    'jump',
    'spray',
    'interact',
    'leaveMeeting',
    'pause',
    'setInput',
    'press',
    'release',
    'clearInput',
    'step',
    'advance',
    'advanceImpact',
    'advanceFocusLoss',
    'getSnapshot',
    'status',
    'drainEvents',
    'send',
    'serialize',
    'restore',
];

test('createGame keeps its public API', () => {
    const game = createGame();
    for (const name of PUBLIC_API) {
        assert.equal(typeof game[name], 'function', name);
    }
});

test('game configuration is frozen and versioned', async () => {
    const { GAME_CONFIG, CONFIG_VERSION, STAGES } = await bundled({
        stdin: {
            contents: `export { GAME_CONFIG, CONFIG_VERSION, STAGES } from './src/game/stages/index';`,
            resolveDir: process.cwd(),
        },
        bundle: true,
        write: false,
        platform: 'node',
        format: 'esm',
    });
    assert.match(CONFIG_VERSION, /^[0-9a-f]{8}$/);
    const checkpoint = GAME_CONFIG.stages[2].checkpoints[1];
    const before = checkpoint.x;
    assert.throws(() => {
        checkpoint.x = before + 1;
    }, TypeError);
    assert.equal(checkpoint.x, before);
    assert.throws(() => {
        GAME_CONFIG.rules.paperPenalty = 0;
    });
    assert.throws(() => {
        STAGES[3].terrain.push([]);
    });
    for (const [id, stage] of Object.entries(STAGES)) {
        assert.equal(stage.id, Number(id));
    }
});

test('status() reads the values UI code needs without copying the state', () => {
    const game = createGame();
    game.startStage(4);
    assert.deepEqual(game.status(), {
        mode: 'play',
        stage: 4,
        completedStage: 0,
        skyPhase: 'arrival',
    });
    const snapshot = game.getSnapshot();
    assert.equal(game.status().mode, snapshot.mode);
    assert.equal(game.status().skyPhase, snapshot.sky.phase);
});
