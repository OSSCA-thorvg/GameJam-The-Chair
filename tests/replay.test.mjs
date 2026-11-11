import assert from 'node:assert/strict';
import test from 'node:test';
import { balancePolicy, createGame, replayCommands } from './support/harness.mjs';

// Plays like the browser does: irregular frame times through advance(), menu commands and a pause.
function playRecorded(seed, stage, frames) {
    const session = { start: null, log: [] };
    const attempt = { start: null, log: [] };
    const game = createGame({
        seed,
        progress: { deaths: 3, completedStage: 2 },
        onAttemptStart(state) {
            session.start ??= state;
            attempt.start = state;
            attempt.log = [];
        },
        onCommand(tick, command) {
            const entry = [tick, structuredClone(command)];
            session.log.push(entry);
            attempt.log.push(entry);
        },
    });
    game.startStage(stage);
    const dts = [1 / 60, 1 / 144, 1 / 30, .011, 1 / 90];
    for (let frame = 0; frame < frames; frame++) {
        balancePolicy(game.getSnapshot(), game);
        if (stage === 3 && frame % 45 === 0) game.spray();
        if (frame === 400) game.pause();
        if (frame === 430) game.pause();
        game.advance(dts[frame % dts.length]);
        game.drainEvents();
    }
    return { game, session, attempt };
}

for (const stage of [1, 2, 3]) {
    test(`recorded commands alone reproduce real-time play (stage ${stage})`, () => {
        const { game, session, attempt } = playRecorded(11 + stage, stage, 120 * 40);
        const final = game.serialize();
        const endTick = JSON.parse(final).tick;
        assert.ok(session.log.length > 10, 'play produced commands');

        const fromStart = replayCommands(JSON.parse(session.start), session.log, endTick).state;
        assert.equal(JSON.stringify(fromStart), final, 'whole session');

        const fromAttempt = replayCommands(JSON.parse(attempt.start), attempt.log, endTick).state;
        assert.equal(JSON.stringify(fromAttempt), final, 'last attempt');
    });
}

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
