import { readFileSync } from 'node:fs';

import { loadSource } from './load.mjs';
const { skyPlatforms, STAGE_FOUR, createGame } = await loadSource(
    `export { skyPlatforms, STAGE_FOUR } from './src/game/stages/sky/data'; export { createGame } from './src/game/game';`,
);
const { settle, turn, hold } = STAGE_FOUR.reveal;
const FINISH_TIME = 6 + settle + turn + hold;

export const STAGE_FOUR_ROUTE = [
    'arrival-roof',
    'window-one',
    'window-two',
    'wind-sign',
    'rest',
    'drawer-desk',
    'little-desk',
    'upper-rest',
    'last-sign',
    'finish',
];
export const STAGE_FOUR_RECORDING = new URL(
    '../replays/stage4-route.json',
    import.meta.url,
);
const STEP = 1 / 120;

function platform(state, id) {
    return skyPlatforms(state.sky, state.time).find((item) => item.id === id);
}

function steer(p, x, speed, keys) {
    const wanted = Math.max(-speed, Math.min(speed, (x - p.x) * 2.7));
    if (p.vx < wanted - 12) {
        keys.push('right');
    }
    if (p.vx > wanted + 12) {
        keys.push('left');
    }
}

function standKeys(state) {
    const keys = [];
    const here = platform(state, state.sky.standing);
    if (here) {
        steer(state.player, here.x + here.width * 0.5, 160, keys);
    }
    return keys;
}

function hopKeys(state, id) {
    const keys = [];
    const p = state.player;
    const target = platform(state, id);
    if (!target) {
        steer(p, p.x + 200, 200, keys);
        return keys;
    }
    const x = target.x + target.width * 0.5;
    const top = target.y;
    const dx = x - p.x;
    steer(p, x, 220, keys);
    const foot = p.y + 28;
    const short = Math.abs(dx) > target.width * 0.35;
    if (
        p.vy > -60 &&
        foot > top - 70 &&
        (short || foot > top - 8) &&
        state.sky.airSprays < 3
    ) {
        keys.push('spray');
    }
    return keys;
}

function startHop(plan, id) {
    return {
        plan,
        id,
        frames: 0,
        launched: false,
        limit: Math.round(
            (plan.wait + (id === 'finish' ? FINISH_TIME : 5)) / STEP,
        ),
    };
}

function hopFrame(sim, hop, visit) {
    const { game } = sim;
    const { plan, id } = hop;
    const state = sim.read();
    if (state.stage === 5) {
        return 'won';
    }
    visit?.(state);
    if (state.sky.phase === 'reveal' || state.sky.phase === 'depth') {
        game.setInput();
        game.step(STEP);
        game.drainEvents();
        return;
    }
    if (
        state.deaths > plan.deaths ||
        state.mode !== 'play' ||
        (plan.clean && state.sky.knock > 0)
    ) {
        return 'missed';
    }
    if (
        state.ground &&
        state.sky.standing !== null &&
        (state.sky.standing !== plan.from ||
            (hop.launched && state.sky.standing === id))
    ) {
        return state.sky.standing;
    }
    if (!hop.launched && hop.frames * STEP >= plan.wait) {
        hop.launched = true;
        const keys = hopKeys(state, id);
        if (plan.launch === 'jump') {
            game.setInput(...keys.filter((k) => k !== 'spray'));
            game.jump();
        } else {
            game.setInput(
                ...new Set([
                    ...keys.filter((k) => k !== 'left'),
                    'right',
                    'spray',
                ]),
            );
        }
    } else {
        game.setInput(
            ...(hop.launched ? hopKeys(state, id) : standKeys(state)),
        );
    }
    game.step(STEP);
    game.drainEvents();
}

function run(sim, hop, visit) {
    while (hop.frames++ < hop.limit) {
        const result = hopFrame(sim, hop, visit);
        if (result) {
            return result;
        }
    }
    return 'missed';
}

function scratch() {
    let core;
    const game = createGame({
        onStep: (state) => {
            core = state;
        },
    });
    return {
        game,
        read: () => ({
            stage: core.stage,
            mode: core.mode,
            deaths: core.deaths,
            ground: core.ground,
            time: core.time,
            player: core.p,
            sky: core.sky,
        }),
        restore(json) {
            game.restore(json);
            core = JSON.parse(json);
        },
    };
}

function plan(sim, saved, from, id, deaths) {
    const order = (result) =>
        result === 'won' || result === id
            ? 2
            : STAGE_FOUR_ROUTE.indexOf(result) > STAGE_FOUR_ROUTE.indexOf(from)
              ? 1
              : 0;
    const minWait = from === 'drawer-desk' ? 0.8 : 0;
    let fallback = null;
    let forward = null;
    for (const clean of [true, false]) {
        const waiting = startHop(
            { wait: Infinity, launch: null, clean, from, deaths },
            id,
        );
        let state = saved;
        let ended = null;
        for (let wait = minWait; wait < 9; wait += 0.2) {
            if (!ended) {
                sim.restore(state);
                while (!ended && (waiting.frames + 1) * STEP < wait) {
                    waiting.frames++;
                    ended = hopFrame(sim, waiting);
                }
                if (!ended) {
                    state = sim.game.serialize();
                }
            }
            for (const launch of ['spray', 'jump']) {
                const attempt = { wait, launch, clean, from, deaths };
                let result = ended;
                if (!result) {
                    sim.restore(state);
                    result = run(sim, {
                        ...startHop(attempt, id),
                        frames: waiting.frames,
                    });
                }
                if (
                    result === 'missed' ||
                    (!STAGE_FOUR_ROUTE.includes(result) && result !== 'won')
                ) {
                    continue;
                }
                const rank = order(result);
                if (rank === 2) {
                    return attempt;
                }
                if (rank === 1) {
                    forward ??= attempt;
                } else if (!clean) {
                    fallback ??= attempt;
                }
            }
        }
    }
    return forward ?? fallback;
}

function drive(game, choose, visit) {
    const sim = { game, read: () => game.getSnapshot() };
    for (let frame = 0; frame < 120 * 20; frame++) {
        const state = sim.read();
        visit(state);
        if (state.sky.phase === 'course' && state.ground) {
            break;
        }
        game.setInput(
            ...(state.sky.phase === 'arrival' ? ['right'] : standKeys(state)),
        );
        game.step(STEP);
        game.drainEvents();
    }
    let from = sim.read().sky.standing;
    for (let hop = 0; hop < 40; hop++) {
        const id = STAGE_FOUR_ROUTE[STAGE_FOUR_ROUTE.indexOf(from) + 1];
        if (!id) {
            break;
        }
        const chosen = {
            ...choose(hop, from, id),
            from,
            deaths: sim.read().deaths,
        };
        const result = run(sim, startHop(chosen, id), visit);
        if (result === 'won') {
            return sim.read();
        }
        if (result === 'missed') {
            throw new Error(
                `Planned hop from ${from} to ${id} did not replay. If stage four gameplay changed on purpose, run: npm run route:update`,
            );
        }
        from = result;
    }
    for (let frame = 0; frame < 120 * 30; frame++) {
        const state = sim.read();
        if (state.stage === 5) {
            return state;
        }
        visit(state);
        game.setInput();
        game.step(STEP);
        game.drainEvents();
    }
    throw new Error(
        `Stage 4 did not finish: ${JSON.stringify(game.getSnapshot().sky)}`,
    );
}

let recording;

export function driveStageFour(game, visit = () => {}) {
    recording ??= JSON.parse(readFileSync(STAGE_FOUR_RECORDING, 'utf8'));
    return drive(
        game,
        (hop, from, id) => {
            const step = recording[hop];
            if (step?.from !== from || step.to !== id) {
                throw new Error(
                    `The stage four route recording expects ${step?.from} → ${step?.to} at hop ${hop}, but the chair is on ${from}. If stage four gameplay changed on purpose, run: npm run route:update`,
                );
            }
            return { wait: step.wait, launch: step.launch, clean: step.clean };
        },
        visit,
    );
}

export function planStageFour() {
    const game = createGame();
    const sim = scratch();
    const hops = [];
    game.startStage(4);
    drive(
        game,
        (hop, from, id) => {
            const chosen = plan(
                sim,
                game.serialize(),
                from,
                id,
                game.getSnapshot().deaths,
            );
            if (!chosen) {
                throw new Error(
                    `No safe hop from ${from} to ${id}: ${JSON.stringify(game.getSnapshot().player)}`,
                );
            }
            hops.push({
                from,
                to: id,
                wait: chosen.wait,
                launch: chosen.launch,
                clean: chosen.clean,
            });
            return chosen;
        },
        () => {},
    );
    return hops;
}
