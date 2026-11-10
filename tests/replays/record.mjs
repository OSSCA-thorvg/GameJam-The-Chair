// Regenerates the checked-in replay fixtures: node tests/replays/record.mjs
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { balancePolicy } from '../replay-harness.mjs';
const bundle = await build({ stdin: { contents: `export { createGame } from './src/game/game'; export * from './src/game/replay';`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });
const R = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const recorder = R.createRecorder(() => R.REPLAY_DEFAULTS, 31);
const game = R.createGame({ seed: 31, ...recorder });
game.startStage(1);
for (let i = 0; i < 120 * 20; i++) { const s = game.getSnapshot(); if (s.mode !== 'play') break; balancePolicy(s, game); game.step(); }
const file = recorder.latest();
writeFileSync('tests/replays/office-route.json', JSON.stringify(file));
console.log(file.endTick - file.start.tick, file.commands.length, file.hashes.length, JSON.stringify(file).length);
