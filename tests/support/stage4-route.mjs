// Drives the stage-four sky course. The course is deterministic in time (wind, rocking desks, papers and birds),
// so before each hop the driver tries launches at different moments on a saved copy of the game and replays the
// first one that lands cleanly on the next platform.
import { loadSource } from './load.mjs';
const { skyPlatforms } = await loadSource(`export { skyPlatforms } from './src/game/stages/sky/data';`);

export const STAGE_FOUR_ROUTE = ['arrival-roof', 'window-one', 'window-two', 'wind-sign', 'rest', 'drawer-desk', 'little-desk', 'upper-rest', 'last-sign', 'finish'];
const STEP = 1 / 120;

function platform(state, id) {
    return skyPlatforms(state.sky, state.time).find(item => item.id === id);
}

function steer(p, x, speed, keys) {
    const wanted = Math.max(-speed, Math.min(speed, (x - p.x) * 2.7));
    if (p.vx < wanted - 12) keys.push('right');
    if (p.vx > wanted + 12) keys.push('left');
}

// Keep the chair over the middle of the platform it stands on while waiting for a launch window.
function standKeys(state) {
    const keys = [], here = platform(state, state.sky.standing);
    if (here) steer(state.player, here.x + here.width * .45, 120, keys);
    return keys;
}

// Head for the target's middle and spend bursts only when about to drop below its top.
function hopKeys(state, id) {
    const keys = [], p = state.player, target = platform(state, id);
    if (!target) { steer(p, p.x + 200, 200, keys); return keys; }
    const x = target.x + target.width * .5, top = target.y;
    const dx = x - p.x;
    steer(p, x, 220, keys);
    const foot = p.y + 28;
    const short = Math.abs(dx) > target.width * .35;
    if (p.vy > -60 && foot > top - 70 && (short || foot > top - 8) && state.sky.airSprays < 3) keys.push('spray');
    return keys;
}

function run(game, plan, id, visit) {
    // plan: { wait, launch }. Returns 'landed' | 'missed' | 'won'.
    let frames = 0, launched = false;
    const limit = Math.round((plan.wait + (id === 'finish' ? 16 : 5)) / STEP);
    while (frames++ < limit) {
        const state = game.getSnapshot();
        if (state.stage === 5) return 'won';
        visit?.(state);
        if (state.sky.phase === 'reveal' || state.sky.phase === 'depth') { game.setInput(); game.step(STEP); game.drainEvents(); continue; }
        if (state.deaths > plan.deaths || (plan.clean && state.sky.knock > 0 && launched)) return 'missed';
        if (launched && state.ground && state.sky.standing === id) return 'landed';
        if (state.ground && state.sky.standing !== plan.from && (launched || state.sky.standing !== null)) return 'missed';
        if (!launched && frames * STEP >= plan.wait) {
            launched = true;
            const keys = hopKeys(state, id);
            if (plan.launch === 'jump') { game.setInput(...keys.filter(k => k !== 'spray')); game.jump(); }
            else game.setInput(...new Set([...keys.filter(k => k !== 'left'), 'right', 'spray']));
        } else game.setInput(...(launched ? hopKeys(state, id) : standKeys(state)));
        game.step(STEP); game.drainEvents();
    }
    return 'missed';
}

function plan(game, from, id, minWait) {
    const saved = game.serialize(), deaths = game.getSnapshot().deaths;
    const tries = [];
    for (const clean of [true, false]) for (let wait = minWait; wait < 9; wait += .2) for (const launch of ['spray', 'jump']) tries.push({ wait, launch, clean, from, deaths });
    for (const attempt of tries) {
        game.restore(saved);
        const result = run(game, attempt, id);
        if (result !== 'missed') { game.restore(saved); return attempt; }
    }
    game.restore(saved);
    return null;
}

export function driveStageFour(game, visit = () => {}, route = STAGE_FOUR_ROUTE) {
    // Hover in until the course starts and the chair settles on the arrival roof.
    for (let frame = 0; frame < 120 * 20; frame++) {
        const state = game.getSnapshot();
        visit(state);
        if (state.sky.phase === 'course' && state.ground) break;
        game.setInput(...(state.sky.phase === 'arrival' ? ['right'] : standKeys(state)));
        game.step(STEP); game.drainEvents();
    }
    let from = game.getSnapshot().sky.standing;
    for (const id of route.slice(route.indexOf(from) + 1)) {
        const chosen = plan(game, from, id, from === 'drawer-desk' ? .8 : 0);
        if (!chosen) throw new Error(`No clean hop from ${from} to ${id}: ${JSON.stringify(game.getSnapshot().player)}`);
        const result = run(game, chosen, id, visit);
        if (result === 'won') return game.getSnapshot();
        if (result !== 'landed') throw new Error(`Planned hop from ${from} to ${id} did not replay`);
        from = id;
    }
    for (let frame = 0; frame < 120 * 30; frame++) {
        const state = game.getSnapshot();
        if (state.stage === 5) return state;
        visit(state);
        game.setInput(); game.step(STEP); game.drainEvents();
    }
    throw new Error(`Stage 4 did not finish: ${JSON.stringify(game.getSnapshot().sky)}`);
}
