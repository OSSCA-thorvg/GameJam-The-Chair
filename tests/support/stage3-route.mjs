// Exercise only public controls; no snapshots are written back into the game.
// Stage three allows three extinguisher bursts per time in the air, and the duct shaft is a zig-zag
// chimney with a gusting duct and steam vents. The route therefore climbs one ledge at a time:
// it waits on each ledge for the hazards to go quiet, then spends its three bursts on one hop.
import { load } from './load.mjs';

const { STAGE_THREE, ventPhase } = await load('src/game/stages/rooftop/data.ts');
const LIMIT = STAGE_THREE.airSprayLimit;

// Seconds until `vent` next starts blowing, or 0 while it is hissing or blowing.
function quietFor(vent, time) {
    const phase = ventPhase(vent, time);
    if (phase.kind !== 'idle') return 0;
    return vent.period - vent.warn - vent.blow - phase.age;
}
const ventQuiet = (index, seconds) => state => quietFor(STAGE_THREE.vents[index], state.time) >= seconds;
// The duct has just finished a gust, so the next one is a full period away.
const ductJustGusted = state => state.ductReaction.kind === 'done' && state.ductReaction.rest < .4;
const ductQuietFor = seconds => state => state.ductReaction.kind === 'done' && state.ductReaction.rest < STAGE_THREE.duct.gustPeriod - seconds;

// Standing heights (chair centre) of the floor and the shaft ledges.
const FLOOR = 368, R1 = 248, L1 = 78, R2 = -92, L2 = -262, UPPER = -172;

// Steps in order. 'roll' drives along the ground; 'wait' waits for the duct's timed sneeze to end; 'hop' climbs from a ledge at `level` to `to`: roll to `takeoff`, wait until `ready`, then
// burst straight up (at most `ups` times, default 2) until high enough and spend the remaining bursts
// toward the target. A 'leap' first runs
// from `start` so the chair carries speed off the edge. 'board' rolls right onto the sales graph.
const ROUTE = [
    { how: 'start' },
    { how: 'pickup' },
    { how: 'rise', x: 1030, y: 210 },
    { how: 'roll', x: 1120 },
    { how: 'roll', x: 1370 },
    // Wait out of the gust's reach until the duct has just gusted, then hop up before the next one.
    { how: 'wait', x: 1370 },
    { how: 'hop', level: FLOOR, takeoff: 1460, to: [1600, R1], apex: 200, ready: ductQuietFor(2) },
    // R1 sits in the duct's gust: arrive right after a gust and leave before the next one.
    { how: 'hop', level: R1, takeoff: 1655, to: [1330, L1], apex: 50, ready: ductQuietFor(1.3) },
    // L2 roofs the column above L1, so this hop turns sideways after a single upward burst.
    { how: 'hop', level: L1, takeoff: 1372, to: [1690, R2], apex: -120, ups: 1, ready: ventQuiet(0, 1.4) },
    { how: 'hop', level: R2, takeoff: 1660, to: [1330, L2], apex: -290, ready: ventQuiet(1, 1.4) },
    { how: 'leap', level: L2, start: 1262, takeoff: 1505, to: [1880, UPPER], apex: -420, ready: state => ventQuiet(2, 1.45)(state) && ventQuiet(1, 1.2)(state) },
    { how: 'board' },
];
export const ROUTE_STEPS = ROUTE.length;

// The hop to retry after landing back on `y`: the first hop that starts from that height.
function retryFrom(y) {
    let best = -1;
    for (let i = 0; i < ROUTE.length; i++) if (ROUTE[i].level !== undefined && Math.abs(ROUTE[i].level - y) < 20) { best = i; break; }
    return best;
}

export function driveStageThree(game, stop = state => state.stage === 4 || state.mode !== 'play', observe = () => {}) {
    let phase = 0;
    let sub = 'go';
    for (let i = 0; i < 120 * 150; i++) {
        const state = game.getSnapshot(), p = state.player;
        observe(state, phase);
        if (stop(state)) return state;
        const step = ROUTE[phase];
        const toward = x => {
            const error = x - p.x - p.vx * .32;
            return error > 12 ? ['right'] : error < -12 ? ['left'] : [];
        };
        if (step.how === 'start') {
            game.setInput('right');
            if (p.x > 210 && state.ground) { game.jump(); phase++; }
        } else if (step.how === 'pickup') {
            game.setInput('right');
            if (state.ground && ((p.x > 205 && p.x < 330) || (p.x > 370 && p.x < 450))) game.jump();
            if (state.hasExtinguisher) phase++;
        } else if (step.how === 'rise') {
            const keys = toward(step.x);
            if (p.y + p.vy * .2 > step.y) keys.push('spray');
            game.setInput(...keys);
            if (Math.abs(p.x - step.x) < 40 && p.y < step.y + 15) phase++;
        } else if (step.how === 'roll') {
            game.setInput(...toward(step.x));
            if (Math.abs(p.x - step.x) < 40 && state.ground) phase++;
        } else if (step.how === 'wait') {
            // The duct sneezes on its own timer: hold position until its first sneeze has passed.
            game.setInput(...(state.ground ? toward(step.x) : []));
            if (ductJustGusted(state) && state.ground) { phase++; sub = 'go'; }
        } else if (step.how === 'hop' || step.how === 'leap') {
            const [tx, ty] = step.to;
            const onLevel = y => state.ground && Math.abs(p.y - y) < 20;
            // Touching down refills the bursts: line up and wait again before the next try.
            if (state.ground && (sub === 'air' || (sub === 'settle' && !onLevel(ty)))) sub = 'go';
            if (onLevel(ty) && Math.abs(p.x - tx) < (step.how === 'leap' ? 60 : 150)) {
                // Arrived: a hard landing may bounce, so only steer from here on.
                sub = 'settle';
                game.setInput(...toward(tx));
                if (Math.abs(p.vx) < 60) { phase++; sub = 'go'; }
            } else if (onLevel(ty)) {
                // Overshot along the target level: roll back to the spot (and its flag).
                game.setInput(...toward(tx));
            } else if (state.ground && !onLevel(step.level)) {
                // Knocked back down: retry the hop from wherever the chair landed.
                const retry = retryFrom(p.y);
                if (retry >= 0) { phase = retry; sub = 'go'; }
                game.setInput();
            } else if (state.ground && sub !== 'air') {
                const runUp = step.how === 'leap' && sub === 'go' ? step.start : step.takeoff;
                if (sub === 'go') {
                    game.setInput(...toward(runUp));
                    if (Math.abs(p.x - runUp) < 20 && Math.abs(p.vx) < 40) sub = 'ready';
                } else if (sub === 'ready') {
                    game.setInput(...toward(runUp));
                    if (step.ready(state)) sub = step.how === 'leap' ? 'run' : 'launch';
                } else if (sub === 'run') {
                    game.setInput('right');
                    if (p.x >= step.takeoff) sub = 'launch';
                }
                if (sub === 'launch') { game.setInput(...(step.how === 'leap' ? ['right', 'spray'] : ['spray'])); sub = 'air'; }
            } else if (sub === 'settle') {
                game.setInput(...(p.vy < 120 ? toward(tx) : []));
            } else {
                sub = state.ground ? sub : 'air';
                const keys = [];
                const high = p.y + p.vy * .25 <= step.apex;
                const left = LIMIT - state.airSprays;
                if (step.how === 'leap' && p.x > 1810) {
                    // Over the parapet: stop pushing and come down on the roof.
                    keys.push(...toward(tx));
                } else if (step.how === 'leap') {
                    keys.push('right');
                    if (!high && left > 0) keys.push('spray');
                } else if (!high && left > 1 && state.airSprays < (step.ups ?? 2)) {
                    keys.push('spray');
                } else if (left > 0 && Math.abs(tx - p.x) > 90 && p.vy > -160) {
                    keys.push(tx > p.x ? 'right' : 'left', 'spray');
                } else if (p.vy < 120) {
                    // Steer only while rising or near the top: leaning on the way down lands head first.
                    keys.push(...toward(tx));
                }
                game.setInput(...keys);
                if (state.ground) sub = 'go';
            }
        } else if (step.how === 'board') {
            game.setInput('right');
        }
        game.step(1 / 120);
        game.drainEvents();
    }
    const step = ROUTE[phase];
    throw new Error(`Stage-three route timed out at phase ${phase} (${step.how}${step.to ? ` to ${step.to}` : step.x ? ` ${step.x}` : ''}, ${sub})`);
}
