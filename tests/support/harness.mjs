import { load } from './load.mjs';

export const { createGame, replayCommands, stepGame, applyCommand } =
    await load('src/game/game.ts');

export function begin(seed, start = {}) {
    const game = createGame({ seed, progress: start.progress });
    if (start.stage) {
        game.startStage(start.stage);
    } else {
        game.reset();
    }
    return game;
}

export function play(game, commands, from, to) {
    let next = commands.findIndex(([tick]) => tick >= from);
    if (next < 0) {
        next = commands.length;
    }
    for (let tick = from; tick < to; tick++) {
        while (next < commands.length && commands[next][0] === tick) {
            const [, method, ...args] = commands[next++];
            game[method](...args);
        }
        game.step(1 / 120);
        game.drainEvents();
    }
    return game;
}

export function runWith(seed, start, commands, ticks) {
    return play(begin(seed, start), commands, 0, ticks);
}

export function sampleCommands(
    ticks,
    { restartAt = Math.floor(ticks * 0.6), spray = false } = {},
) {
    /** @type {[number, string, ...string[]][]} */
    const commands = [[0, 'setInput', 'right']];
    for (let tick = 30; tick < ticks; tick += 75) {
        commands.push([tick, 'jump']);
        if (spray && tick % 150 === 30) {
            commands.push([tick, 'spray']);
        }
        commands.push([tick + 20, 'setInput', 'right', tick % 2 ? 'q' : 'e']);
        commands.push([tick + 40, 'setInput', 'right']);
    }
    commands.push([restartAt, 'restart']);
    commands.push([restartAt, 'setInput', 'right']);
    return commands.sort((a, b) => a[0] - b[0]);
}

export function recordCommands(seed, start, ticks, policy) {
    const game = begin(seed, start);
    const commands = [];
    const recorder = new Proxy(game, {
        get:
            (target, method) =>
            (...args) => {
                commands.push([tick, method, ...args]);
                return target[method](...args);
            },
    });
    let tick = 0;
    for (; tick < ticks; tick++) {
        policy(game.getSnapshot(), recorder);
        game.step();
        game.drainEvents();
    }
    return commands;
}

export function balancePolicy(state, game) {
    const p = state.player;
    let wait = false;
    if (state.stage === 1) {
        for (const m of state.monitors) {
            const phase =
                (((state.time + 0.5 + m.offset) % m.period) + m.period) %
                m.period;
            if (
                m.wall - p.x > 40 &&
                m.wall - p.x < 140 &&
                (m.active || phase < 2.1)
            ) {
                wait = true;
            }
        }
        if (state.ground && p.x > 1495 && p.x < 1575) {
            game.jump();
        }
    }
    const correction = -p.a * 12 - p.w * 4;
    const keys = wait ? [] : ['right'];
    if (correction < -0.4) {
        keys.push('q');
    }
    if (correction > 0.4) {
        keys.push('e');
    }
    game.setInput(...keys);
    if (state.mode === 'dead' || state.mode === 'won') {
        game.reset();
    }
}

const EXPRESS = { pit: { left: 10650, right: 10990 } };
const ORIENTATION = [
    4050, 4400, 4750, 5370, 5700, 5960, 6450, 6700, 6970, 7190, 7450, 7640,
    7830, 8110, 8330, 8590, 8790, 8990,
];
export function orientationHop(state) {
    const p = state.player;
    if (!state.ground) {
        return false;
    }
    return ORIENTATION.some((x) => {
        const time = (x - p.x) / Math.max(1, p.vx);
        return time > 0.36 && time < 0.44;
    });
}
export function createExpressRider(stayAboard = false) {
    let off = false;
    return (state, game) => {
        const p = state.player;
        const { convoy, pace } = state.corridor;
        if (off) {
            return ['right'];
        }
        if (pace !== 'express' && state.stage === 2 && orientationHop(state)) {
            game.jump();
        }
        if (convoy === 'free') {
            return null;
        }
        if (pace !== 'express') {
            return [];
        }
        if (convoy !== 'carried' || !state.ground) {
            return [];
        }
        const toLip = EXPRESS.pit.left - p.x;
        if (toLip > 0 && toLip < 35) {
            game.jump();
        }
        if (!stayAboard && p.x > EXPRESS.pit.right + 120) {
            game.jump();
            off = true;
            return ['right'];
        }
        return [];
    };
}

export function corridorPolicy(stayAboard) {
    let entered = false;
    const express = createExpressRider(stayAboard);
    return (state, game) => {
        const p = state.player;
        const correction = -p.a * 12 - p.w * 4;
        const keys = express(state, game) ?? ['right'];
        if (correction < -0.4) {
            keys.push('q');
        }
        if (correction > 0.4) {
            keys.push('e');
        }
        game.setInput(...keys);
        if (!entered && state.canEnterMeeting) {
            entered = true;
            game.interact();
        }
        if (state.mode === 'dead') {
            game.reset();
        }
    };
}
