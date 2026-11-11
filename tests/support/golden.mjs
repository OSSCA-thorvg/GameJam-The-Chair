// Behaviour fingerprints for the step 6-7 refactor: per-tick mode, player and events, plus the final snapshot.
// Any change in gameplay order or numbers changes a hash.
import { createHash } from 'node:crypto';
import { balancePolicy, corridorPolicy, createGame, sampleCommands } from './harness.mjs';
import { driveStageThree } from './stage3-route.mjs';

function traced(game) {
    const hash = createHash('sha256');
    let held = [];
    const wrapper = new Proxy(game, {
        get(target, key) {
            if (key === 'step') return () => {
                target.step();
                const events = target.drainEvents();
                held.push(...events);
                const s = target.getSnapshot();
                hash.update(JSON.stringify([s.mode, s.player, s.focus, events]));
            };
            if (key === 'drainEvents') return () => held.splice(0);
            return target[key];
        },
    });
    return { game: wrapper, digest: () => hash.update(JSON.stringify(game.getSnapshot())).digest('hex').slice(0, 16) };
}

function runPolicy(seed, stage, ticks, policy) {
    const { game, digest } = traced(createGame({ seed }));
    game.startStage(stage);
    for (let i = 0; i < ticks; i++) { policy(game.getSnapshot(), game); game.step(); }
    return digest();
}

function runCommands(seed, stage, ticks, commands) {
    const { game, digest } = traced(createGame({ seed }));
    game.startStage(stage);
    let next = 0;
    for (let tick = 0; tick < ticks; tick++) {
        while (next < commands.length && commands[next][0] === tick) {
            const [, method, ...args] = commands[next++];
            game[method](...args);
        }
        game.step();
    }
    return digest();
}

export const GOLDEN_SCENARIOS = {
    'office route': () => runPolicy(31, 1, 120 * 45, balancePolicy),
    'office crash': () => runCommands(4, 1, 120 * 40, sampleCommands(120 * 40)),
    'building exit': () => runPolicy(8, 2, 120 * 45, corridorPolicy(false)),
    'building lift': () => runPolicy(9, 2, 120 * 45, corridorPolicy(true)),
    'rooftop to sky': () => {
        const { game, digest } = traced(createGame({ seed: 12 }));
        game.startStage(3);
        driveStageThree(game);
        game.setInput('left');
        for (let i = 0; i < 600; i++) game.step();
        return digest();
    },
    'rooftop duct': () => runCommands(5, 3, 120 * 25, sampleCommands(120 * 25, { spray: true })),
};
