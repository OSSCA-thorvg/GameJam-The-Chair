// Exercise only public controls; no snapshots are written back into the game.
// The shaft is a zig-zag chimney with steam vents, so the route waits on each ledge for a quiet vent.
import { load } from './load.mjs';

const { STAGE_THREE, ventPhase } = await load('src/game/stages/rooftop/data.ts');

// Seconds until `vent` next starts blowing, or 0 while it is hissing or blowing.
function quietFor(vent, time) {
    const phase = ventPhase(vent, time);
    if (phase.kind !== 'idle') return 0;
    return vent.period - vent.warn - vent.blow - phase.age;
}

// Each step: where to go, how ('roll' drives along the floor, 'land' flies there and touches down,
// 'rise' climbs above `y`, 'cross' holds height while flying across),
// and optionally a vent whose quiet window must last `quiet` seconds before leaving the ledge.
const ROUTE = [
    { x: 235, y: 392, how: 'start' },
    { x: 600, y: 368, how: 'pickup' },
    { x: 1030, y: 210, how: 'rise' },
    { x: 1120, y: 368, how: 'roll' },
    { x: 1425, y: 368, how: 'roll' },
    { x: 1425, y: 215, how: 'rise' },
    { x: 1560, y: 248, how: 'land' },
    { x: 1605, y: 45, how: 'rise' },
    { x: 1330, y: 78, how: 'land' },
    { x: 1410, y: -125, how: 'rise', vent: 0, quiet: 1.6 },
    { x: 1560, y: -92, how: 'land' },
    { x: 1610, y: -295, how: 'rise', vent: 1, quiet: 1.6 },
    { x: 1400, y: -262, how: 'land' },
    { x: 1400, y: -405, how: 'rise', vent: 2, quiet: 1.7 },
    { x: 1880, y: -405, how: 'cross' },
    { x: 1880, y: -172, how: 'land' },
    { x: 2320, y: -172, how: 'land' },
    { x: 2360, y: -300, how: 'launch' },
];
export const ROUTE_STEPS = ROUTE.length;

export function driveStageThree(game, stop = state => state.stage === 4 || state.mode !== 'play', observe = () => {}) {
    let phase = 0;
    for (let i = 0; i < 120 * 90; i++) {
        const state = game.getSnapshot(), p = state.player;
        observe(state, phase);
        if (stop(state)) return state;
        const target = ROUTE[phase];
        if (target.how === 'launch') {
            game.setInput('spray');
            game.step(1 / 120);
            game.drainEvents();
            continue;
        }
        const error = target.x - p.x - p.vx * .32;
        const keys = error > 12 ? ['right'] : error < -12 ? ['left'] : [];
        if (target.how === 'start') {
            game.setInput('right');
            if (p.x > 210 && state.ground) { game.jump(); phase++; }
        } else if (target.how === 'pickup') {
            game.setInput('right');
            if (state.ground && ((p.x > 205 && p.x < 330) || (p.x > 370 && p.x < 450))) game.jump();
            if (state.hasExtinguisher) phase++;
        } else if (target.how === 'rise') {
            const waiting = target.vent !== undefined && state.ground && quietFor(STAGE_THREE.vents[target.vent], state.time) < target.quiet;
            if (!waiting && p.y + p.vy * .2 > target.y) keys.push('spray');
            game.setInput(...(waiting ? [] : keys));
            if (Math.abs(p.x - target.x) < 40 && p.y < target.y + 15) phase++;
        } else if (target.how === 'cross') {
            if (p.y + p.vy * .25 > target.y) keys.push('spray');
            game.setInput(...keys);
            if (p.x > target.x - 50) phase++;
        } else if (target.how === 'roll') {
            game.setInput(...keys);
            if (Math.abs(p.x - target.x) < 55 && state.ground) phase++;
        } else {
            if (Math.abs(p.x - target.x) > 70 && p.y + p.vy * .2 > target.y - 30 && !state.ground) keys.push('spray');
            game.setInput(...keys);
            if (Math.abs(p.x - target.x) < 55 && state.ground && Math.abs(p.y - target.y) < 20) phase++;
        }
        game.step(1 / 120);
        game.drainEvents();
    }
    throw new Error(`Stage-three route timed out at phase ${phase} (${ROUTE[phase].how} ${ROUTE[phase].x},${ROUTE[phase].y})`);
}
