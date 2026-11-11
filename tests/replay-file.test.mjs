import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { balancePolicy } from './replay-harness.mjs';

const bundle = await build({
    stdin: { contents: `export { createGame } from './src/game/game'; export * from './src/game/replay';`, resolveDir: process.cwd() },
    bundle: true, write: false, platform: 'node', format: 'esm',
});
const R = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

// Plays through the shell with recording hooks, like main.ts does.
function recordedGame(settings = {}, seed = 21) {
    const current = { ...R.REPLAY_DEFAULTS, ...settings };
    const recorder = R.createRecorder(() => current, seed);
    const errors = [];
    const game = R.createGame({ seed, ...recorder, onAttemptStart: recorder.onAttemptStart, onError: error => { recorder.onError(error); errors.push(error); } });
    return { game, recorder, errors, settings: current };
}

test('a recorded attempt replays to the same state with matching hashes and markers', () => {
    const { game, recorder } = recordedGame();
    game.startStage(1);
    for (let i = 0; i < 120 * 30; i++) {
        const state = game.getSnapshot();
        if (state.mode === 'dead') break;
        balancePolicy(state, game);
        game.advance([1 / 60, 1 / 144, .011][i % 3]);
    }
    const file = recorder.latest();
    assert.ok(file && file.hashes.length > 5);
    assert.equal(file.start.stage, 1);
    const timeline = R.buildTimeline(JSON.parse(JSON.stringify(file)));
    assert.equal(timeline.divergedAt, null);
    assert.equal(timeline.error, null);
    assert.equal(timeline.endTick, file.endTick);
    assert.ok(timeline.markers.some(marker => marker.kind === 'checkpoint'));
    assert.ok(timeline.markers.some(marker => marker.kind === 'death'));
    assert.equal(JSON.stringify(R.seekTimeline(timeline, timeline.endTick).state), game.serialize());
    // Seeking anywhere matches running straight through.
    const mid = Math.floor((timeline.startTick + timeline.endTick) / 2);
    const straight = R.createCursor(timeline.file);
    while (straight.state.tick < mid) straight.next();
    assert.equal(JSON.stringify(R.seekTimeline(timeline, mid).state), JSON.stringify(straight.state));
});

test('a changed command shows up as a divergence from the recorded hashes', () => {
    const { game, recorder } = recordedGame();
    game.startStage(2);
    game.setInput('right');
    for (let i = 0; i < 600; i++) game.step();
    game.setInput();
    for (let i = 0; i < 600; i++) game.step();
    const file = recorder.latest();
    file.commands[1] = [file.commands[1][0], { type: 'keys', keys: ['left'] }];
    const timeline = R.buildTimeline(file);
    assert.ok(timeline.divergedAt !== null);
    assert.ok(timeline.markers.some(marker => marker.kind === 'diverged'));
});

test('a throwing command is recorded and reproduced by the replay', () => {
    const { game, recorder, errors } = recordedGame();
    game.startStage(2);
    for (let i = 0; i < 100; i++) game.step();
    assert.throws(() => game.startStage(9));
    assert.equal(errors.length, 1);
    assert.equal(errors[0].at, 'command');
    const file = recorder.latest();
    assert.equal(file.error.message, errors[0].message);
    const timeline = R.buildTimeline(JSON.parse(JSON.stringify(file)));
    assert.equal(timeline.error.tick, errors[0].tick);
    assert.ok(timeline.markers.some(marker => marker.kind === 'error'));
});

test('recorder follows its settings: off, command limit and kept attempts', () => {
    const off = recordedGame({ enabled: false });
    off.game.startStage(1);
    for (let i = 0; i < 200; i++) off.game.step();
    assert.equal(off.recorder.latest(0), null);

    const short = recordedGame({ maxCommands: 100 });
    short.game.startStage(1);
    for (let i = 0; i < 300; i++) { short.game.setInput(i % 2 ? 'right' : 'left'); short.game.step(); }
    const cut = short.recorder.latest();
    assert.equal(cut.truncated, true);
    assert.equal(cut.commands.length, 100);
    assert.equal(R.buildTimeline(cut).divergedAt, null, 'a cut recording still replays up to the cut');

    const kept = recordedGame({ keepAttempts: 2 });
    for (let attempt = 0; attempt < 5; attempt++) {
        kept.game.startStage(1);
        for (let i = 0; i < 100; i++) kept.game.step();
    }
    assert.equal(kept.recorder.attempts().length, 3, 'current plus two finished');
    assert.ok(kept.recorder.attempts().every(file => file.commands.every(([, command]) => command.type !== 'startStage')), 'retry commands are trimmed');
});

test('settings are clamped and files are validated', () => {
    const settings = R.normalizeReplaySettings({ enabled: false, hashInterval: 1, keyframeInterval: '240', playbackSpeed: 99, maxErrors: 'x' });
    assert.deepEqual(settings, { ...R.REPLAY_DEFAULTS, enabled: false, hashInterval: 10, keyframeInterval: 240, playbackSpeed: 4 });
    assert.throws(() => R.parseReplay('{}'), /format/);
    assert.throws(() => R.parseReplay('nope'), /JSON/);
});

test('checked-in replay files still play back exactly', () => {
    for (const name of ['office-route.json']) {
        const file = R.parseReplay(readFileSync(new URL(`./replays/${name}`, import.meta.url), 'utf8'));
        const timeline = R.buildTimeline(file);
        assert.equal(timeline.divergedAt, null, name);
        assert.equal(timeline.error, null, name);
        assert.equal(timeline.endTick, file.endTick, name);
    }
});

test('replay data bundles, single files and old error logs all open as replay lists', () => {
    const { game, recorder } = recordedGame();
    game.startStage(1);
    for (let i = 0; i < 200; i++) game.step();
    game.startStage(2);
    for (let i = 0; i < 200; i++) game.step();
    const attempts = recorder.attempts();
    const bundle = { kind: 'the-chair-replay-data', format: 1, version: 'x', exportedAt: '', userAgent: '', attempts,
        errors: [{ tick: 3, at: 'step', message: 'boom', time: '', stage: 1, replay: attempts[1] }, { tick: 1, at: 'window', message: 'no replay', time: '', stage: null, replay: null }] };
    const fromBundle = R.readReplaySources(JSON.stringify(bundle)).sources;
    assert.deepEqual(fromBundle.map(source => source.kind), ['attempt', 'attempt', 'error']);
    assert.equal(fromBundle[2].error.message, 'boom');
    assert.deepEqual(R.readReplaySources(JSON.stringify(attempts[0])).sources.map(source => source.kind), ['file']);
    const errorLog = { kind: 'the-chair-error-log', entries: bundle.errors };
    assert.equal(R.readReplaySources(JSON.stringify(errorLog)).sources.length, 1);
    assert.throws(() => R.readReplaySources('{"kind":"the-chair-replay-data","attempts":[],"errors":[]}'), /no replays/);
});
