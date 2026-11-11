import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame } from './support/harness.mjs';
import { bundled } from './support/load.mjs';

// The public surface that UI, preview scenes and tests depend on. Keep it stable through the core refactor.
const PUBLIC_API = [
    'reset', 'restart', 'startStage', 'jump', 'spray', 'interact', 'leaveMeeting', 'pause',
    'setInput', 'press', 'release', 'clearInput',
    'step', 'advance', 'advanceImpact', 'advanceFocusLoss',
    'getSnapshot', 'status', 'drainEvents', 'send', 'serialize', 'restore',
];

test('createGame keeps its public API', () => {
    const game = createGame();
    for (const name of PUBLIC_API) assert.equal(typeof game[name], 'function', name);
});

test('game configuration is frozen and versioned', async () => {
    const { build } = await import('esbuild');
    const { GAME_CONFIG, CONFIG_VERSION, STAGES } = await bundled({ stdin: { contents: `export { GAME_CONFIG, CONFIG_VERSION, STAGES } from './src/game/stages/index';`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });
    assert.match(CONFIG_VERSION, /^[0-9a-f]{8}$/);
    assert.throws(() => { GAME_CONFIG.stageTwo.checkpoints[1].x = 0; });
    assert.throws(() => { GAME_CONFIG.rules.paperPenalty = 0; });
    assert.throws(() => { STAGES[3].terrain.push([]); });
    for (const stage of [1, 2, 3, 4]) assert.equal(STAGES[stage].id, stage);
});

test('status() reads the values UI code needs without copying the state', () => {
    const game = createGame();
    game.startStage(4);
    assert.deepEqual(game.status(), { mode: 'play', stage: 4, completedStage: 0, skyPhase: 'arrival' });
    const snapshot = game.getSnapshot();
    assert.equal(game.status().mode, snapshot.mode);
    assert.equal(game.status().skyPhase, snapshot.sky.phase);
});
