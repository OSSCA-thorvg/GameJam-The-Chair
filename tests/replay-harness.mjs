// Shared driver for determinism tests. Uses only the public createGame API.
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/game/game.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
export const { createGame } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

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
