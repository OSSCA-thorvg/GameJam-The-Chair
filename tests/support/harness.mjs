// Shared drivers for simulation tests. Uses only the public createGame API.
import { load } from './load.mjs';

export const { createGame, replayCommands, stepGame, applyCommand } = await load('src/game/game.ts');

// A command is [tick, method, ...args]; it runs before the given fixed step.
// start = { progress?, stage? } describes the state before the first step.
export function begin(seed, start = {}) {
    const game = createGame({ seed, progress: start.progress });
    if (start.stage) game.startStage(start.stage);
    else game.reset();
    return game;
}

export function play(game, commands, from, to) {
    let next = commands.findIndex(([tick]) => tick >= from);
    if (next < 0) next = commands.length;
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

// A rough route: hold right, hop regularly, balance, and restart once after a failure.
export function sampleCommands(ticks, { restartAt = Math.floor(ticks * .6), spray = false } = {}) {
    const commands = [[0, 'setInput', 'right']];
    for (let tick = 30; tick < ticks; tick += 75) {
        commands.push([tick, 'jump']);
        if (spray && tick % 150 === 30) commands.push([tick, 'spray']);
        commands.push([tick + 20, 'setInput', 'right', tick % 2 ? 'q' : 'e']);
        commands.push([tick + 40, 'setInput', 'right']);
    }
    commands.push([restartAt, 'restart']);
    commands.push([restartAt, 'setInput', 'right']);
    return commands.sort((a, b) => a[0] - b[0]);
}

// Records the commands a state-aware policy issues, so a closed-loop run becomes a fixed command list.
export function recordCommands(seed, start, ticks, policy) {
    const game = begin(seed, start);
    const commands = [];
    const recorder = new Proxy(game, {
        get: (target, method) => (...args) => { commands.push([tick, method, ...args]); return target[method](...args); },
    });
    let tick = 0;
    for (; tick < ticks; tick++) {
        policy(game.getSnapshot(), recorder);
        game.step();
        game.drainEvents();
    }
    return commands;
}

// Holds right, keeps the chair upright, hops the office bin and waits out monitor light.
// Geysers are driven through on purpose so their random spin gets exercised.
export function balancePolicy(state, game) {
    const p = state.player;
    let wait = false;
    if (state.stage === 1) {
        for (const m of state.monitors) {
            const phase = ((state.time + .5 + m.offset) % m.period + m.period) % m.period;
            if (m.wall - p.x > 40 && m.wall - p.x < 140 && (m.active || phase < 2.1)) wait = true;
        }
        if (state.ground && p.x > 1495 && p.x < 1575) game.jump();
    }
    const correction = -p.a * 12 - p.w * 4;
    const keys = wait ? [] : ['right'];
    if (correction < -.4) keys.push('q');
    if (correction > .4) keys.push('e');
    game.setInput(...keys);
    if (state.mode === 'dead' || state.mode === 'won') game.reset();
}

const EXPRESS = { bumps: [2480, 2760, 2900], pit: { left: 3080, right: 3420 } };
// Rides the express convoy through the rush-hour corridor: hops each cable cover (a jump without pushing
// on lands back on the chairs), leaps the construction hole (a jump while pushing on). With `stayAboard`
// the leap is short and the rider hops in place past the hole until the chairs sweep it into the lift.
// Returns the keys to hold this tick, or null when the convoy is not involved.
export function createExpressRider(stayAboard = false) {
    let leapAt = null;
    return (state, game) => {
        const p = state.player, { convoy, pace } = state.corridor;
        if (pace !== 'express') return null;
        if (leapAt === null) {
            if (convoy === 'airborne') return [];
            if (convoy !== 'carried') return null;
            const next = EXPRESS.bumps.map(x => x - p.x).find(d => d > 0);
            if (state.ground && next !== undefined && next < 70) game.jump();
            const toPit = EXPRESS.pit.left - p.x;
            if (state.ground && toPit > 0 && toPit < 60) { game.jump(); leapAt = state.time; return ['right']; }
            return [];
        }
        if (!stayAboard) return ['right'];
        if (state.time - leapAt < .08) return ['right'];
        // Past the hole: keep hopping in place until the chairs roll in underneath.
        if (convoy === 'free' && p.x > EXPRESS.pit.right && state.ground && Math.abs(p.vx) < 40) game.jump();
        return [];
    };
}

// Rides the building corridor: enters the meeting once, then rides the express convoy across the hole and
// off it again, unless `stayAboard`.
export function corridorPolicy(stayAboard) {
    let entered = false;
    const express = createExpressRider(stayAboard);
    return (state, game) => {
        const p = state.player;
        const correction = -p.a * 12 - p.w * 4;
        const keys = express(state, game) ?? ['right'];
        if (correction < -.4) keys.push('q');
        if (correction > .4) keys.push('e');
        game.setInput(...keys);
        if (!entered && state.canEnterMeeting) { entered = true; game.interact(); }
        if (state.mode === 'dead') game.reset();
    };
}
