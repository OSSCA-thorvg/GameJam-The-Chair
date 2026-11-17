import assert from 'node:assert/strict';
import test from 'node:test';

import { loadSource } from './support/load.mjs';

const {
    createGame,
    parseState,
    STAGES,
    applyHeadHit,
    applyFocusHit,
    stepGame,
} = await loadSource(`
export { createGame, parseState, stepGame } from './src/game/game';
export { STAGES } from './src/game/stages/index';
export { applyHeadHit } from './src/game/systems/impact/apply';
export { applyFocusHit } from './src/game/systems/focus/apply';
`);

function playingState() {
    const game = createGame({ seed: 42 });
    game.reset();
    return parseState(game.serialize());
}

function headImpact() {
    const state = playingState();
    applyHeadHit(state, [], { x: 10, y: 20 });
    return state;
}

const contradictions = [
    {
        name: 'impact without data',
        create: () => ({
            ...playingState(),
            mode: 'impact',
            lossReason: 'head',
        }),
    },
    {
        name: 'impact with the wrong reason',
        create: () => ({ ...headImpact(), lossReason: 'focus' }),
    },
    {
        name: 'focus loss with the wrong reason',
        create: () => ({
            ...playingState(),
            mode: 'focuslost',
            lossReason: 'head',
        }),
    },
    {
        name: 'focus loss with remaining focus',
        create: () => ({
            ...playingState(),
            mode: 'focuslost',
            lossReason: 'focus',
        }),
    },
    {
        name: 'play with a loss reason',
        create: () => ({ ...playingState(), lossReason: 'bin' }),
    },
    {
        name: 'play with impact data',
        create: () => ({ ...headImpact(), mode: 'play', lossReason: null }),
    },
    {
        name: 'death without a reason',
        create: () => ({ ...playingState(), mode: 'dead' }),
    },
    {
        name: 'head death without impact data',
        create: () => ({ ...playingState(), mode: 'dead', lossReason: 'head' }),
    },
    {
        name: 'bin death with impact data',
        create: () => ({ ...headImpact(), mode: 'dead', lossReason: 'bin' }),
    },
    {
        name: 'focus death with remaining focus',
        create: () => ({
            ...playingState(),
            mode: 'dead',
            lossReason: 'focus',
        }),
    },
];

for (const { name, create } of contradictions) {
    test(`restore rejects ${name} without changing the running game`, () => {
        const game = createGame({ seed: 7 });
        game.reset();
        const before = game.serialize();
        assert.throws(
            () => game.restore(JSON.stringify(create())),
            /state\.(impact|lossReason|focus)/,
        );
        assert.equal(game.serialize(), before);
    });
}

for (const stage of Object.values(STAGES)) {
    test(`stage ${stage.id} accepts its last checkpoint and rejects the next index`, () => {
        const game = createGame();
        game.startStage(stage.id);
        const state = parseState(game.serialize());
        state.checkpoint = stage.checkpoints.length - 1;
        assert.deepEqual(parseState(JSON.stringify(state)), state);
        state.checkpoint++;
        assert.throws(() => parseState(JSON.stringify(state)), /checkpoint/);
    });
}

function assertFailureRoundTrip(state, mode) {
    assert.equal(state.mode, mode);
    assert.deepEqual(parseState(JSON.stringify(state)), state);
    let next = state;
    for (let i = 0; i < 1000 && next.mode !== 'dead'; i++) {
        next = stepGame(next).state;
    }
    assert.equal(next.mode, 'dead');
    assert.equal(next.lossReason, state.lossReason);
    assert.deepEqual(parseState(JSON.stringify(next)), next);
    const game = createGame();
    game.restore(JSON.stringify(next));
    game.restart();
    const restarted = parseState(game.serialize());
    assert.equal(restarted.mode, 'play');
    assert.equal(restarted.lossReason, null);
    assert.equal(restarted.impact, null);
}

test('head impact remains restorable through death and restart', () => {
    assertFailureRoundTrip(headImpact(), 'impact');
});

test('focus loss remains restorable through death and restart', () => {
    const state = playingState();
    applyFocusHit(state, [], { kind: 'paper', id: 1, damage: 100 });
    assertFailureRoundTrip(state, 'focuslost');
});
