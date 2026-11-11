export function driveStageFour(game, visit = () => {}) {
    const route = ['arrival-roof', 'window-one', 'window-two', 'wind-sign', 'rest', 'drawer-desk', 'little-desk', 'upper-rest', 'last-sign', 'finish'];
    let targetIndex = 0;
    for (let frame = 0; frame < 120 * 160; frame++) {
        const state = game.getSnapshot(), p = state.player, sky = state.sky;
        visit(state, targetIndex);
        if (state.mode === 'won') return state;
        if (state.deaths > 0) throw new Error(`Fall approaching ${route[targetIndex]} at ${JSON.stringify(p)}`);
        if (sky.phase === 'reveal') game.setInput();
        else if (sky.phase === 'depth') game.setInput('forward');
        else if (sky.phase === 'arrival') game.setInput('right');
        else {
            const id = route[targetIndex];
            if (state.ground && sky.standing === id) {
                if (id !== 'drawer-desk' || sky.drawer >= 1) { targetIndex++; }
            }
            const targets = {
                'arrival-roof': [2840, -1720], 'window-one': [3130, -1810 - sky.lift * 80],
                'window-two': [3330, -1930 - sky.lift * 80], 'wind-sign': [3615, -2050],
                rest: [3845, -2050], 'drawer-desk': [4205, -2150], 'little-desk': [4490, -2230],
                'upper-rest': [4600, -2230], 'last-sign': [4885, -2310], finish: [5370, -2310],
            };
            const [x, y] = targets[route[targetIndex]] ?? targets.finish;
            const dx = x - p.x;
            const wantedSpeed = Math.max(-170, Math.min(170, dx * 2.7));
            const keys = [];
            if (p.vx < wantedSpeed - 12) keys.push('right');
            if (p.vx > wantedSpeed + 12) keys.push('left');
            // Release thrust above the target and let the chair settle onto it.
            if ((state.ground && Math.abs(dx) > 65) || (!state.ground && p.y > y - 115 && (Math.abs(dx) > 65 || p.y > y - 23))) keys.push('spray');
            game.setInput(...keys);
        }
        game.step(1 / 120); game.drainEvents();
    }
    throw new Error(`Stage 4 timed out at target ${targetIndex}: ${JSON.stringify(game.getSnapshot().player)} ${JSON.stringify(game.getSnapshot().sky)}`);
}
