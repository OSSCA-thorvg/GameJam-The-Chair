import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource } from './support/load.mjs';
const { createGame, isStageUnlocked, createErrorLog } = await loadSource(`
export { createGame } from './src/game/game';
export { isStageUnlocked } from './src/game/progression';
export { createErrorLog } from './src/ui/replay-store';
`);

test('a long frame discards excess time instead of catching up', () => {
    const game = createGame();
    game.reset();
    const result = game.advance(60);
    assert.ok(result.ticks <= 30);
    assert.ok(result.dropped >= 59.75);
    assert.equal(game.advance(0).ticks, 0);
});

test('each previous clear unlocks exactly the next stage', () => {
    for (let completed = 0; completed <= 5; completed++) {
        for (let stage = 1; stage <= 5; stage++) {
            assert.equal(
                isStageUnlocked(stage, completed),
                stage <= completed + 1,
            );
        }
    }
});

test('stored errors are validated and bounded before being exposed', () => {
    const previous = Object.getOwnPropertyDescriptor(
        globalThis,
        'localStorage',
    );
    const valid = {
        tick: 2,
        at: 'step',
        message: 'failure',
        time: new Date().toISOString(),
        stage: 1,
        replay: null,
    };
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem: () =>
                JSON.stringify([
                    valid,
                    null,
                    {},
                    { ...valid, tick: 'bad' },
                    valid,
                    valid,
                ]),
            setItem() {},
        },
    });
    try {
        assert.equal(createErrorLog(2).entries.length, 2);
        assert.equal(createErrorLog(0).entries.length, 0);
        assert.equal(createErrorLog(10).entries.length, 3);
    } finally {
        if (previous) {
            Object.defineProperty(globalThis, 'localStorage', previous);
        } else delete globalThis.localStorage;
    }
});
