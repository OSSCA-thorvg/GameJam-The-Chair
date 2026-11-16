import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
    applyCommand,
    balancePolicy,
    createGame,
    stepGame,
} from './support/harness.mjs';

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
        balancePolicy(stepView(state), {
            setInput: (...keys) => commands.push({ type: 'keys', keys }),
            jump: () => commands.push({ type: 'jump' }),
            reset: () => commands.push({ type: 'reset' }),
        });
        state = deepFreeze(stepGame(state, commands).state);
    }
    assert.ok(state.tick > 0);
});

function stepView(s) {
    const geysers = [
        { period: 3.5, offset: 0, wall: 2110 },
        { period: 3.5, offset: 2.1, wall: 2560 },
        { period: 3.5, offset: 1, wall: 2980 },
    ];
    const monitors = geysers.map((m) => {
        const phase = (((s.time + m.offset) % m.period) + m.period) % m.period;
        return { ...m, active: phase >= 0.8 && phase < 2.1 };
    });
    return {
        player: s.p,
        ground: s.ground,
        stage: s.stage,
        time: s.time,
        mode: s.mode,
        monitors,
    };
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
    const walk = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) walk(path);
            else if (path.endsWith('.ts')) files.push(path);
        }
    };
    walk('src/game');
    for (const path of files) {
        const source = readFileSync(path, 'utf8').replace(/\/\/.*$/gm, '');
        assert.doesNotMatch(
            source,
            /Math\.random|Date\.|new Date|performance\.|requestAnimationFrame|localStorage/,
            path,
        );
    }
});

test('restoring grouped state preserves play data and restart resets attempt systems', () => {
    const game = createGame({ seed: 17 });
    game.startStage(1);
    const state = JSON.parse(game.serialize());
    state.focus = {
        value: 45,
        recoveryClock: 1.2,
        processedEvents: ['paper:2'],
        notice: { kind: 'paper', life: 0.8 },
    };
    state.extinguisher = {
        owned: true,
        cooldown: 0.1,
        burst: 0.2,
        direction: { x: -1, y: 0 },
    };
    Object.assign(state.office.copier, { volley: 3, bursts: 7 });
    game.restore(JSON.stringify(state));
    assert.deepEqual(JSON.parse(game.serialize()), state);
    const view = game.getSnapshot();
    assert.equal(view.focus, 45);
    assert.equal(view.focusNotice.kind, 'paper');
    assert.equal(view.hasExtinguisher, true);
    assert.deepEqual(view.spray, {
        burst: 0.2,
        cooldown: 0.1,
        dir: { x: -1, y: 0 },
    });
    assert.equal(view.bursts, 7);
    game.reset();
    const restarted = JSON.parse(game.serialize());
    assert.equal(restarted.focus.value, 100);
    assert.deepEqual(restarted.focus.processedEvents, []);
    assert.equal(restarted.focus.notice, null);
    assert.equal(restarted.extinguisher.owned, false);
    assert.equal(restarted.extinguisher.cooldown, 0);
    assert.equal(restarted.office.copier.volley, 0);
    assert.equal(restarted.office.copier.bursts, 0);
});

test('restore rejects malformed grouped state without replacing the current state', () => {
    const game = createGame({ seed: 17 });
    const saved = game.serialize();
    const invalid = [
        (state) => {
            state.focus.value = '100';
        },
        (state) => {
            state.focus.recoveryClock = null;
        },
        (state) => {
            state.focus.processedEvents = [123];
        },
        (state) => {
            state.focus.notice = { kind: 'invalid', life: 1 };
        },
        (state) => {
            state.extinguisher.owned = 1;
        },
        (state) => {
            state.extinguisher.cooldown = '0';
        },
        (state) => {
            delete state.extinguisher.direction.y;
        },
        (state) => {
            state.extinguisher.extra = true;
        },
        (state) => {
            state.office.copier.volley = 0.5;
        },
        (state) => {
            state.office.copier.bursts = -1;
        },
    ];
    for (const change of invalid) {
        const state = JSON.parse(saved);
        change(state);
        assert.throws(() => game.restore(JSON.stringify(state)));
        assert.equal(game.serialize(), saved);
    }
});
