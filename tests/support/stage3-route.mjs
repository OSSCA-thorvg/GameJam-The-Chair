// Exercise only public controls; no snapshots are written back into the game.
export function driveStageThree(game, stop = state => state.stage === 4 || state.mode !== 'play', observe = () => {}) {
    const targets = [
        { x: 235, y: 392 }, { x: 600, y: 368 }, { x: 1030, y: 210 },
        { x: 1120, y: 368 }, { x: 1350, y: 368 }, { x: 1448, y: 150 },
        { x: 1630, y: 248 }, { x: 1448, y: 0 }, { x: 1320, y: 108 },
        { x: 1448, y: -150 }, { x: 1630, y: -32 }, { x: 1710, y: -290 },
        { x: 1870, y: -172 }, { x: 2320, y: -172 }, { x: 2360, y: -300 },
    ];
    let phase = 0;
    for (let i = 0; i < 120 * 60; i++) {
        const state = game.getSnapshot(), p = state.player;
        observe(state, phase);
        if (stop(state)) return state;
        if (phase === 14) {
            game.setInput('spray');
            game.step(1 / 120);
            game.drainEvents();
            continue;
        }
        const target = targets[phase];
        const error = target.x - p.x - p.vx * .32;
        const keys = error > 12 ? ['right'] : error < -12 ? ['left'] : [];
        if (phase === 0) {
            game.setInput('right');
            if (p.x > 210 && state.ground) { game.jump(); phase++; }
        } else {
            if ([2, 5, 7, 9, 11, 14].includes(phase) && p.y + p.vy * .2 > target.y) keys.push('spray');
            if ([6, 8, 10, 12].includes(phase) && Math.abs(p.x - target.x) > 75 && p.y + p.vy * .2 > target.y - 40) keys.push('spray');
            game.setInput(...keys);
            if (phase === 1 && state.ground && ((p.x > 205 && p.x < 330) || (p.x > 370 && p.x < 450))) game.jump();
            if (phase === 1 && state.hasExtinguisher) phase++;
            else if ([3, 4, 6, 8, 10, 12, 13].includes(phase) && Math.abs(p.x - target.x) < 65 && state.ground) phase++;
            else if ([2, 5, 7, 9, 11].includes(phase) && Math.abs(p.x - target.x) < 65 && p.y < target.y + 15) phase++;
        }
        game.step(1 / 120);
        game.drainEvents();
    }
    throw new Error(`Stage-three route timed out at phase ${phase}`);
}
