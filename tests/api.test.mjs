import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame } from './replay-harness.mjs';

// The public surface that UI, preview scenes and tests depend on. Keep it stable through the core refactor.
const PUBLIC_API = [
    'reset', 'restart', 'startStage', 'jump', 'spray', 'interact', 'leaveMeeting', 'pause',
    'setInput', 'press', 'release', 'clearInput',
    'step', 'advance', 'advanceImpact', 'advanceFocusLoss',
    'getSnapshot', 'drainEvents', 'send', 'serialize', 'restore',
];

test('createGame keeps its public API', () => {
    const game = createGame();
    for (const name of PUBLIC_API) assert.equal(typeof game[name], 'function', name);
});

test('game configuration is frozen and versioned', async () => {
    const { build } = await import('esbuild');
    const bundle = await build({ stdin: { contents: `export { GAME_CONFIG, CONFIG_VERSION, STAGES } from './src/game/stages/index';`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });
    const { GAME_CONFIG, CONFIG_VERSION, STAGES } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
    assert.match(CONFIG_VERSION, /^[0-9a-f]{8}$/);
    assert.throws(() => { GAME_CONFIG.stageTwo.checkpoints[1].x = 0; });
    assert.throws(() => { GAME_CONFIG.rules.paperPenalty = 0; });
    assert.throws(() => { STAGES[3].terrain.push([]); });
    for (const stage of [1, 2, 3, 4]) assert.equal(STAGES[stage].id, stage);
});
