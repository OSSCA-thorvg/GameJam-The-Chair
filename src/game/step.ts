import { skyStep } from './systems/sky';
import { rooftopStep, firstFlightStep, rooftopEntranceStep } from './systems/rooftop';
import { LEVEL, FIXED_STEP } from './level';
import type { GameEvent, Mode } from './types';
import { clamp, contact } from './geometry';
import { resetAttempt, startStage, snapshot, type GameState } from './state';
import { PRACTICE_PILE, STAGES, inCheckpointArea } from './stages';
import type { DeepReadonly, Point } from './types';
import { applyCommand, spray, type Command } from './commands';
import { focusStep, advanceFocusLoss } from './systems/focus';
import { shoot, particlesStep } from './systems/papers';
import { cleaningStep } from './systems/cleaning';
import { geyserHits } from './systems/geyser';
import { applyGeyserHits, applyMonitorContact } from './apply';
import { monitorContact } from './systems/monitor';
import { fail, impactStep } from './systems/impact';
import { meetingStep, corridorStep, landInConvoy, liftRideStep } from './systems/corridor';
import { binEnter } from './systems/bin';

// Modes in which fixed steps advance the game. Others wait for a command.
export const SIMULATED: readonly Mode[] = ['play', 'impact', 'focuslost'];

/**
 * One fixed step (1/120 s): applies the commands that arrived before it, then advances any simulated mode.
 * Depends only on its arguments, so the same state and commands always give the same result and events.
 */
export function stepGame(s: GameState, commands: readonly Command[] = []): GameEvent[] {
    const out: GameEvent[] = [];
    for (const command of commands) applyCommand(s, command, out);
    if (!SIMULATED.includes(s.mode)) return out;
    s.tick++;
    if (s.mode === 'play') playStep(s, out, FIXED_STEP);
    else if (s.mode === 'impact') impactStep(s, out, FIXED_STEP);
    else advanceFocusLoss(s, out, FIXED_STEP);
    return out;
}

export type CommandLog = readonly (readonly [tick: number, command: Command])[];

/**
 * Re-runs the commands recorded after `s` was saved, then steps on to `endTick`. Returns every event emitted.
 * The log must start where the saved state was taken (see the createGame recording hooks).
 */
export function replayCommands(s: GameState, log: CommandLog, endTick: number): GameEvent[] {
    const events: GameEvent[] = [];
    const advanceTo = (tick: number) => {
        while (s.tick < tick && SIMULATED.includes(s.mode)) events.push(...stepGame(s));
    };
    for (const [tick, command] of log) {
        if (tick < s.tick) throw new Error(`Command at tick ${tick} precedes the saved state at tick ${s.tick}.`);
        advanceTo(tick);
        applyCommand(s, command, events);
    }
    advanceTo(endTick);
    return events;
}

function playStep(s: GameState, out: GameEvent[], dt: number) {
    const F = LEVEL.floor;
    s.history.push(snapshot(s));
    if (s.history.length > 60) s.history.shift();
    s.time += dt;
    s.copier.cool = Math.max(0, s.copier.cool - dt);
    s.binCooldown = Math.max(0, s.binCooldown - dt);
    s.paperPenaltyRemaining = Math.max(0, s.paperPenaltyRemaining - dt);
    s.rollCooldown = Math.max(0, s.rollCooldown - dt);
    s.reverseCooldown = Math.max(0, s.reverseCooldown - dt);
    s.slipCooldown = Math.max(0, s.slipCooldown - dt);
    s.lightPenaltyRemaining = Math.max(0, s.lightPenaltyRemaining - dt);
    s.lightCooldown = Math.max(0, s.lightCooldown - dt);
    s.sprayCooldown = Math.max(0, s.sprayCooldown - dt);
    s.sprayBurst = Math.max(0, s.sprayBurst - dt);
    if (s.keys.includes('spray')) spray(s, out);
    out.push({ type: 'tick', dt });
    if (s.stage === 3) {
        if (rooftopEntranceStep(s, dt)) return;
        const flight = firstFlightStep(s, dt);
        if (flight) {
            if (flight === 'arrived') {
                if (s.completedStage < 3) s.completedStage = 3;
                const arrival = { ...s.p };
                startStage(s, 4, out);
                s.p = arrival;
                s.ground = false;
            }
            return;
        }
    }
    if (s.stage === 4) {
        skyStep(s, dt);
        return;
    }
    if (s.stage === 2 && meetingStep(s, dt)) return;
    if (s.stage === 2 && liftRideStep(s, out, dt)) return;
    if (s.stage === 1 && (s.volley > 0 || Math.abs(s.p.x - s.copier.x) < 350) && s.copier.cool === 0 && s.copier.burst === 0) {
        s.copier.dir = s.p.x < s.copier.x ? -1 : 1;
        s.volley++;
        s.copier.burst = 4;
        s.copier.next = .75;
        s.copier.cool = 1.45;
    }
    if (s.copier.burst > 0) {
        s.copier.next -= dt;
        if (s.copier.next <= 0) {
            shoot(s, out);
            s.copier.burst--;
            s.copier.next = .19;
        }
    }
    particlesStep(s, out, dt);
    if (s.mode !== 'play') return;
    if (s.stage === 1) {
        cleaningStep(s, out, dt);
        applyGeyserHits(s, out, geyserHits(s.p, s.time, s.rng.physics));
    }
    if (s.mode !== 'play') return;

    const p = s.p;
    const was = s.ground;
    const inputDir = (s.keys.includes('right') ? 1 : 0) - (s.keys.includes('left') ? 1 : 0);
    const prev = p.x;
    s.coyote = s.ground ? .1 : Math.max(0, s.coyote - dt);
    s.jumpQ = Math.max(0, s.jumpQ - dt);
    s.slip = was && s.cleaning.spilled && p.x > s.cleaning.a && p.x < s.cleaning.a + Math.min(1, s.cleaning.age / .8) * (s.cleaning.b - s.cleaning.a) && p.y > F - 55;
    if (s.slip && !s.wetSeen) s.wetSeen = true;
    if (s.slip && s.slipCooldown === 0 && Math.abs(p.vx) > 65) {
        out.push({ type: 'cue', id: 'slipping' });
        s.slipCooldown = 7;
    }
    if (s.jumpQ > 0 && s.coyote > 0) {
        if (p.x < 300) s.practiceJump = true;
        p.vy = -380;
        p.w -= inputDir * .12;
        s.ground = false;
        if (s.stage === 2 && s.corridor.convoy === 'carried') s.corridor.convoy = 'airborne';
        s.coyote = 0;
        s.jumpQ = 0;
    }
    const convoyJump = s.stage === 2 && s.corridor.convoy === 'airborne' && !s.ground;
    const expressJump = convoyJump && s.corridor.pace === 'express';
    const dir = s.stage === 2 && s.corridor.convoy === 'carried' ? 0 : inputDir;
    const balancing = s.keys.includes('q') || s.keys.includes('e');
    const tilt = (s.keys.includes('e') ? 1 : 0) - (s.keys.includes('q') ? 1 : 0) + (was || balancing ? 0 : dir);
    p.w += tilt * (was ? 4.3 : 6.4) * dt;
    if (p.x < 300 || s.stage >= 3) {
        p.w += (-Math.sin(p.a) * 20 - p.w * 7) * dt;
    }
    if (convoyJump && dir) {
        p.vx += dir * (expressJump ? 1400 : 1200) * dt;
    } else if (was && dir) {
        p.vx += dir * (s.slip ? 110 : 305) * dt;
    } else if (!was && dir) {
        p.vx += dir * 55 * dt;
    }
    p.vy += 950 * dt;
    p.vx *= Math.exp(-(convoyJump ? 0 : was ? (s.slip ? .015 : .55) : .09) * dt);
    p.w *= Math.exp(-(was ? (s.slip ? .9 : 1.8) : .75) * dt);
    const horizontalLimit = expressJump ? 760 : convoyJump ? 700 : 315;
    p.vx = clamp(p.vx, -horizontalLimit, horizontalLimit);
    p.vy = clamp(p.vy, -500, 850);
    p.w = clamp(p.w, -5.8, 5.8);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.a += p.w * dt;
    const bin = LEVEL.bin;
    if (s.stage === 1 && s.binCooldown === 0 && p.x > bin.a + 25 && p.x < bin.b - 25 && p.y + 28 >= bin.rim && p.vy >= 0) {
        binEnter(s, out);
        return;
    }
    if (s.stage === 2) corridorStep(s, dt, prev);
    const solids = stageSolids(s);
    const parts = LEVEL.playerContacts;
    s.ground = false;
    let c = Math.cos(p.a);
    let sn = Math.sin(p.a);
    const head = parts[7];
    const hx = p.x - head.y * sn;
    const hy = p.y + head.y * c;
    for (const ob of solids) {
        const hit = contact(hx, hy, head.r, ob);
        if (hit && hit.ny < -.25 && hit.depth > .05) {
            fail(s, out, { x: hx, y: hy });
            return;
        }
    }
    for (let iter = 0; iter < 5; iter++) {
        for (const part of parts) {
            c = Math.cos(p.a);
            sn = Math.sin(p.a);
            const rx = part.x * c - part.y * sn;
            const ry = part.x * sn + part.y * c;
            for (const ob of solids) {
                const hit = contact(p.x + rx, p.y + ry, part.r, ob);
                if (!hit) continue;
                if (part.head && hit.ny < -.25 && hit.depth > .05) {
                    fail(s, out, { x: p.x + rx, y: p.y + ry });
                    return;
                }
                p.x += hit.nx * hit.depth * .78;
                p.y += hit.ny * hit.depth * .78;
                const vn = (p.vx - p.w * ry) * hit.nx + (p.vy + p.w * rx) * hit.ny;
                const cr = rx * hit.ny - ry * hit.nx;
                if (vn < 0) {
                    const impulse = -1.035 * vn / (1 + cr * cr / 2500);
                    p.vx += hit.nx * impulse;
                    p.vy += hit.ny * impulse;
                    p.w += cr * impulse / 2500;
                }
                if (part.wheel && hit.ny < -.45) {
                    s.ground = true;
                }
            }
        }
    }
    if (s.stage === 3) rooftopStep(s, out, dt);
    if (s.stage === 2) landInConvoy(s);
    if (s.stage === 1) {
        applyMonitorContact(s, out, monitorContact(p, prev, s.time));
    }
    if (s.mode !== 'play') return;
    // The rooftop saves only once the extinguisher is in hand; picking it up is checkpoint 1.
    if (s.stage !== 3 || s.hasExtinguisher) reachCheckpoints(s, out);
    focusStep(s, dt);
    if (s.ground) {
        p.w -= Math.sin(p.a) * dt;
    }
    if (p.x < 40) {
        p.x = 40;
        p.vx = Math.max(0, p.vx);
    }
    s.lessons.moved ||= p.x > 140;
    if (s.stage <= 2 && !s.lessons.jumped && s.practiceJump && s.ground && p.x < 330) {
        s.lessons.jumped = true;
        out.push({ type: 'cue', id: 'practice-cleared' });
    }
    s.actualSpeed += (Math.abs(p.x - prev) / dt - s.actualSpeed) * (1 - Math.exp(-dt / .12));
    if (s.ground && dir && Math.abs(p.vx) > 95 && s.rollCooldown === 0) {
        out.push({ type: 'cue', id: 'rolling' });
        s.rollCooldown = 9;
    }
    if (s.people.length > 0 && p.vx < -60 && s.reverseCooldown === 0) {
        const n = s.people.reduce((a, b) => Math.abs(a.x - p.x) < Math.abs(b.x - p.x) ? a : b);
        if (Math.abs(n.x - p.x) < 300) {
            out.push({ type: 'cue', id: 'reverse-comment', person: { ...n } });
            s.reverseCooldown = 7;
        }
    }
    for (const n of s.people) {
        if (!n.said && Math.min(Math.abs(p.x - n.x), Math.abs(prev - n.x)) < 100) {
            n.said = true;
            out.push({ type: 'cue', id: 'person-comment', person: { ...n } });
        }
    }
    if (s.slip && Math.abs(p.vx) > 90 && Math.floor(s.time * 30) !== Math.floor((s.time - dt) * 30)) {
        out.push({ type: 'speck', x: p.x - 15, vx: -p.vx * .2 });
    }
    if (p.y > F + 250) {
        if (s.stage >= 2) {
            s.deaths++;
            resetAttempt(s, out);
            return;
        }
        binEnter(s, out);
        return;
    }
    if (s.stage <= 2 && p.x > STAGES[s.stage].goal) {
        if (s.stage > s.completedStage) s.completedStage = s.stage;
        s.mode = 'won';
        s.keys = [];
        out.push({ type: 'cue', id: 'stage-clear' });
    }
}
// Static terrain plus the practice pile, which stays until the first jump lesson is done.
export function stageSolids(s: GameState): readonly DeepReadonly<Point[]>[] {
    const terrain = STAGES[s.stage].terrain;
    return s.stage <= 2 && !s.lessons.jumped ? [...terrain, PRACTICE_PILE] : terrain;
}

function reachCheckpoints(s: GameState, out: GameEvent[]) {
    const stage = STAGES[s.stage];
    if (stage.checkpointRule === 'land' && !s.ground) return;
    for (let i = s.checkpoint + 1; i < stage.checkpoints.length; i++) {
        if (!inCheckpointArea(stage.checkpoints[i], s.p)) continue;
        s.checkpoint = i;
        s.focus = 100;
        s.focusClock = 0;
        out.push({ type: 'cue', id: 'checkpoint' });
    }
}
