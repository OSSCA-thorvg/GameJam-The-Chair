import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { applyCommand, balancePolicy, createGame, stepGame } from './support/harness.mjs';

function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const child of Object.values(value)) deepFreeze(child);
        Object.freeze(value);
    }
    return value;
}

test('stepGame never writes into the state it is given', () => {
    const game = createGame({ seed: 3 });
    game.startStage(1);
    let state = deepFreeze(JSON.parse(game.serialize()));
    for (let tick = 0; tick < 120 * 20; tick++) {
        const commands = [];
        balancePolicy(stepView(state), { setInput: (...keys) => commands.push({ type: 'keys', keys }), jump: () => commands.push({ type: 'jump' }), reset: () => commands.push({ type: 'reset' }) });
        state = deepFreeze(stepGame(state, commands).state);
    }
    assert.ok(state.tick > 0);
});

// The policy only needs a few snapshot fields.
function stepView(s) {
    const geysers = [{ period: 3.5, offset: 0, wall: 2110 }, { period: 3.5, offset: 2.1, wall: 2560 }, { period: 3.5, offset: 1, wall: 2980 }];
    const monitors = geysers.map(m => {
        const phase = ((s.time + m.offset) % m.period + m.period) % m.period;
        return { ...m, active: phase >= .8 && phase < 2.1 };
    });
    return { player: s.p, ground: s.ground, stage: s.stage, time: s.time, mode: s.mode, monitors };
}

test('a command or step that throws leaves the previous state intact', () => {
    const game = createGame({ seed: 1 });
    game.startStage(2);
    for (let i = 0; i < 30; i++) game.step();
    const before = game.serialize();
    assert.throws(() => game.startStage(9));
    assert.equal(game.serialize(), before);
    const state = JSON.parse(before);
    assert.throws(() => applyCommand(state, { type: 'startStage', id: 9 }));
    assert.equal(JSON.stringify(state), before);
});

test('the game core has no hidden time or randomness sources', () => {
    const files = [];
    const walk = dir => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) walk(path);
            else if (path.endsWith('.ts')) files.push(path);
        }
    };
    walk('src/game');
    for (const path of files) {
        const source = readFileSync(path, 'utf8').replace(/\/\/.*$/gm, '');
        assert.doesNotMatch(source, /Math\.random|Date\.|new Date|performance\.|requestAnimationFrame|localStorage/, path);
    }
});
