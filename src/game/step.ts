import { FIXED_STEP } from './level';
import type { DeepReadonly, GameEvent, Mode, Point } from './types';
import { cloneState, resetAttempt, startStage, snapshot, type GameState } from './state';
import { PRACTICE_PILE, STAGES, inCheckpointArea } from './stages';
import { runCommand, spray, type Command } from './commands';
import { drivePlayer, collide } from './physics';
import { copierStep, papersStep } from './systems/papers';
import { cleaningStep, slipping } from './systems/cleaning';
import { geyserHits } from './systems/geyser';
import { monitorContact } from './systems/monitor';
import { fallsIntoBin, fellOffFloor } from './systems/bin';
import {
    applyBinFall, applyCleaning, applyConvoyLanding, applyCopier, applyCorridor, applyFlight, applyFocusLoss,
    applyFocusRecovery, applyGeyserHits, applyHeadHit, applyImpact, applyLiftRide, applyMeeting, applyMonitorContact,
    applyPapers, applyRooftop, applyRooftopEntrance, applySky, setPlayer,
} from './apply';

// Modes in which fixed steps advance the game. Others wait for a command.
export const SIMULATED: readonly Mode[] = ['play', 'impact', 'focuslost'];

export type StepResult = { state: GameState; events: GameEvent[] };

/**
 * One fixed step (1/120 s): applies the commands that arrived before it, then advances the current mode.
 * Pure from the outside: `state` is never modified, so if anything throws the previous state stays intact.
 */
export function stepGame(state: Readonly<GameState>, commands: readonly Command[] = []): StepResult {
    const s = cloneState(state);
    const events: GameEvent[] = [];
    for (const command of commands) runCommand(s, command, events);
    advanceMode(s, events);
    return { state: s, events };
}

/** Applies one command between steps, without stepping. Pure like stepGame. */
export function applyCommand(state: Readonly<GameState>, command: Command): StepResult {
    const s = cloneState(state);
    const events: GameEvent[] = [];
    runCommand(s, command, events);
    return { state: s, events };
}

function advanceMode(s: GameState, out: GameEvent[]) {
    switch (s.mode) {
        case 'play':
            s.tick++;
            playStep(s, out, FIXED_STEP);
            return;
        case 'impact':
            s.tick++;
            applyImpact(s, out, FIXED_STEP);
            return;
        case 'focuslost':
            s.tick++;
            applyFocusLoss(s, out, FIXED_STEP);
            return;
        case 'intro': case 'pause': case 'dead': case 'won':
            return;
    }
}

export type CommandLog = readonly (readonly [tick: number, command: Command])[];

/**
 * Re-runs the commands recorded after `start` was saved, then steps on to `endTick`.
 * The log must start where the saved state was taken (see the createGame recording hooks).
 */
export function replayCommands(start: Readonly<GameState>, log: CommandLog, endTick: number): StepResult {
    const s = cloneState(start);
    const events: GameEvent[] = [];
    const advanceTo = (tick: number) => {
        while (s.tick < tick && SIMULATED.includes(s.mode)) advanceMode(s, events);
    };
    for (const [tick, command] of log) {
        if (tick < s.tick) throw new Error(`Command at tick ${tick} precedes the saved state at tick ${s.tick}.`);
        advanceTo(tick);
        runCommand(s, command, events);
    }
    advanceTo(endTick);
    return { state: s, events };
}

// One tick of normal play. Order matters: hazards, then driving, collisions, stage rules, scoring.
function playStep(s: GameState, out: GameEvent[], dt: number) {
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
        if (applyRooftopEntrance(s, dt)) return;
        const flight = applyFlight(s, dt);
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
        applySky(s, out, dt);
        return;
    }
    if (s.stage === 2 && applyMeeting(s, dt)) return;
    if (s.stage === 2 && applyLiftRide(s, out, dt)) return;
    applyCopier(s, out, copierStep(s.copier, s.volley, s.p.x, s.stage === 1, dt));
    applyPapers(s, out, papersStep(s.papers, s.p, s.inBin, dt), dt);
    if (s.mode !== 'play') return;
    if (s.stage === 1) {
        applyCleaning(s, out, cleaningStep(s, dt), dt);
        applyGeyserHits(s, out, geyserHits(s.p, s.time, s.rng.physics));
    }
    if (s.mode !== 'play') return;

    const p = s.p;
    const was = s.ground;
    const inputDir = (s.keys.includes('right') ? 1 : 0) - (s.keys.includes('left') ? 1 : 0);
    const prev = p.x;
    s.coyote = s.ground ? .1 : Math.max(0, s.coyote - dt);
    s.jumpQ = Math.max(0, s.jumpQ - dt);
    s.slip = slipping(p, s.cleaning, was);
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
    setPlayer(s, drivePlayer(p, { grounded: was, slip: s.slip, dir, tilt, upright: p.x < 300 || s.stage >= 3, convoyJump, expressJump }, dt));
    if (s.stage === 1 && fallsIntoBin(p, s.binCooldown)) {
        applyBinFall(s, out);
        return;
    }
    if (s.stage === 2) applyCorridor(s, dt, prev);
    const hit = collide(p, stageSolids(s));
    setPlayer(s, hit.p);
    s.ground = hit.ground;
    if (hit.headHit) {
        applyHeadHit(s, out, hit.headHit);
        return;
    }
    if (s.stage === 3) applyRooftop(s, out, dt);
    if (s.stage === 2) applyConvoyLanding(s);
    if (s.stage === 1) {
        applyMonitorContact(s, out, monitorContact(p, prev, s.time));
    }
    if (s.mode !== 'play') return;
    // The rooftop saves only once the extinguisher is in hand; picking it up is checkpoint 1.
    if (s.stage !== 3 || s.hasExtinguisher) reachCheckpoints(s, out);
    applyFocusRecovery(s, dt);
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
    if (fellOffFloor(p)) {
        if (s.stage >= 2) {
            s.deaths++;
            resetAttempt(s, out);
            return;
        }
        applyBinFall(s, out);
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
