// Drives the stage-four sky course. The course is deterministic in time (wind, rocking desks, papers and birds),
// so before each hop the driver tries launches at different moments on a saved copy of the game and replays the
// first one that lands cleanly on the next platform.
import { loadSource } from './load.mjs';
const { skyPlatforms, STAGE_FOUR } = await loadSource(`export { skyPlatforms, STAGE_FOUR } from './src/game/stages/sky/data';`);
// The last hop waits out the whole stage four ending before stage five starts.
const { settle, turn, hold } = STAGE_FOUR.reveal;
const FINISH_TIME = 6 + settle + turn + hold;

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
    if (here) steer(state.player, here.x + here.width * .5, 160, keys);
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

// Plays one hop. Returns 'won', 'missed' (a fall, lost focus, a knock on a clean try or a timeout) or the id of
// the platform the chair next settles on (the target, or wherever the wind and hazards put it instead).
function run(game, plan, id, visit) {
    let frames = 0, launched = false;
    const limit = Math.round((plan.wait + (id === 'finish' ? FINISH_TIME : 5)) / STEP);
    while (frames++ < limit) {
        const state = game.getSnapshot();
        if (state.stage === 5) return 'won';
        visit?.(state);
        if (state.sky.phase === 'reveal' || state.sky.phase === 'depth') { game.setInput(); game.step(STEP); game.drainEvents(); continue; }
        if (state.deaths > plan.deaths || state.mode !== 'play' || (plan.clean && state.sky.knock > 0)) return 'missed';
        if (state.ground && state.sky.standing !== null && (state.sky.standing !== plan.from || (launched && state.sky.standing === id))) return state.sky.standing;
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

// Tries launches on a saved copy and keeps the best: a clean landing on the target, then any landing on it,
// then any landing further along the route, then (last resort) any safe landing to re-plan from.
function plan(game, from, id, route, minWait) {
    const saved = game.serialize(), deaths = game.getSnapshot().deaths;
    const order = platform => platform === 'won' || platform === id ? 2 : route.indexOf(platform) > route.indexOf(from) ? 1 : 0;
    let fallback = null, forward = null;
    for (const clean of [true, false]) for (let wait = minWait; wait < 9; wait += .2) for (const launch of ['spray', 'jump']) {
        const attempt = { wait, launch, clean, from, deaths };
        game.restore(saved);
        const result = run(game, attempt, id);
        if (result === 'missed' || !route.includes(result) && result !== 'won') continue;
        const rank = order(result);
        if (rank === 2) { game.restore(saved); return attempt; }
        if (rank === 1) forward ??= attempt;
        else if (!clean) fallback ??= attempt;
    }
    game.restore(saved);
    return forward ?? fallback;
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
    for (let hop = 0; hop < 40; hop++) {
        const id = route[route.indexOf(from) + 1];
        if (!id) break;
        const chosen = plan(game, from, id, route, from === 'drawer-desk' ? .8 : 0);
        if (!chosen) throw new Error(`No safe hop from ${from} to ${id}: ${JSON.stringify(game.getSnapshot().player)}`);
        const result = run(game, chosen, id, visit);
        if (result === 'won') return game.getSnapshot();
        if (result === 'missed') throw new Error(`Planned hop from ${from} to ${id} did not replay`);
        from = result;
    }
    for (let frame = 0; frame < 120 * 30; frame++) {
        const state = game.getSnapshot();
        if (state.stage === 5) return state;
        visit(state);
        game.setInput(); game.step(STEP); game.drainEvents();
    }
    throw new Error(`Stage 4 did not finish: ${JSON.stringify(game.getSnapshot().sky)}`);
}
