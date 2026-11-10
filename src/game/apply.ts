import type { GameState } from './state';
import type { GameEvent } from './types';
import { focusAfterHit, focusBlocked, focusLossStep, focusRecovery, type FocusHit } from './systems/focus';
import type { GeyserHit } from './systems/geyser';
import type { MonitorContact } from './systems/monitor';
import { RULES } from './level';
import { BIN_REST } from './systems/bin';
import type { CleaningResult } from './systems/cleaning';
import { paperShot, trimPapers, type CopierResult, type PaperHit } from './systems/papers';
import type { Input, Paper } from './types';
import { skyStep } from './systems/sky';
import { impactReplay, impactStep } from './systems/impact';
import { MEETING_SEAT, canEnterMeeting, convoyLanding, corridorStep, liftRide, meetingExit, meetingStep } from './systems/corridor';
import type { Point } from './types';
import { STAGES } from './stages';
import { ductSprayed, entranceStep, flightStep, launchShot, rooftopStep } from './systems/rooftop';

// The only place where system decisions are written into game state. Systems decide; these apply.
// Each applier returns false when the attempt stopped (focus lost, death) so the step can end early.

// Player updates keep the same object: the play step holds a reference to it for the whole tick.
export function setPlayer(s: GameState, p: Readonly<GameState['p']>) {
    Object.assign(s.p, p);
}

// Returns false once play has stopped, so callers skip the rest of their effects.
export function applyFocusHit(s: GameState, out: GameEvent[], hit: FocusHit) {
    if (s.mode !== 'play') return false;
    const r = focusAfterHit(s, hit);
    if (!r) return true;
    s.focus = r.focus;
    s.focusClock = r.focusClock;
    s.focusEvents = [...r.focusEvents];
    s.focusNotice = r.focusNotice;
    if (r.lost) applyFocusFailure(s, out);
    return s.mode === 'play';
}

function applyFocusFailure(s: GameState, out: GameEvent[]) {
    s.mode = 'focuslost';
    s.lossReason = 'focus';
    s.focusLossTime = 0;
    s.focus = 0;
    s.focusClock = 0;
    s.deaths++;
    s.keys = [];
    out.push({ type: 'cue', id: 'focus-lost' });
}

export function applyFocusLoss(s: GameState, out: GameEvent[], dt: number) {
    if (s.mode !== 'focuslost') return;
    const r = focusLossStep(s.focusLossTime, dt);
    s.focusLossTime = r.time;
    if (r.over) {
        s.mode = 'dead';
        out.push({ type: 'cue', id: 'focus-game-over' });
    }
}

export function applyFocusRecovery(s: GameState, dt: number) {
    Object.assign(s, focusRecovery(s, focusBlocked(s), dt));
}

export function applyGeyserHits(s: GameState, out: GameEvent[], hits: readonly GeyserHit[]) {
    for (const hit of hits) {
        s.p.vy = -520;
        s.p.vx += hit.push;
        s.p.w += hit.spin;
        s.rng.physics = hit.rng;
        if (!applyFocusHit(s, out, hit.focus)) return false;
        out.push({ type: 'cue', id: 'light-hit' });
    }
    return true;
}

export function applyMonitorContact(s: GameState, out: GameEvent[], contact: MonitorContact | null) {
    if (!contact) return true;
    s.p.x = contact.x;
    s.p.vx = contact.vx;
    s.p.w *= .45;
    s.lightPenaltyRemaining = RULES.lightPenalty;
    out.push({ type: 'light-contact' });
    if (s.lightCooldown !== 0) return true;
    s.lightHits++;
    s.lightCooldown = 1.4;
    if (!applyFocusHit(s, out, contact.focus)) return false;
    out.push({ type: 'cue', id: 'light-hit' });
    out.push({ type: 'cue', id: 'light-comment', monitorIndex: contact.index });
    return true;
}

export function applyBinFall(s: GameState, out: GameEvent[]) {
    if (s.mode !== 'play') return;
    s.inBin = true;
    s.dirty = true;
    s.binFalls++;
    s.deaths++;
    s.lossReason = 'bin';
    setPlayer(s, BIN_REST);
    s.keys = [];
    s.mode = 'dead';
    out.push({ type: 'cue', id: 'bin-fall' });
    out.push({ type: 'cue', id: 'bin-comment' });
    out.push({ type: 'cue', id: 'bin-game-over' });
}

export function applyCleaning(s: GameState, out: GameEvent[], result: CleaningResult, dt: number) {
    s.cleaning = result.cleaning;
    s.bucket = result.bucket;
    if (result.splash) {
        out.push({ type: 'water-splash', x: s.cleaning.x, side: s.cleaning.splashDir });
        out.push({ type: 'cue', id: 'water-spilled' });
        out.push({ type: 'cue', id: 'water-comment' });
    }
    if (result.followup) out.push({ type: 'cue', id: 'water-followup' });
    if (result.soak) {
        s.soakedOnSpill = s.bucket.spills;
        if (!applyFocusHit(s, out, result.soak)) return false;
    }
    out.push({ type: 'water-step', dt });
    return true;
}

export function applyCopier(s: GameState, out: GameEvent[], result: CopierResult) {
    s.copier = result.copier;
    s.volley = result.volley;
    if (!result.fire) return;
    s.papers.push(...paperShot(s.copier, s.volley, s.bursts));
    s.bursts++;
    out.push({ type: 'volley' });
    if (s.bursts === 1) out.push({ type: 'cue', id: 'first-volley' });
}

export function applyPapers(s: GameState, out: GameEvent[], result: { papers: Paper[]; hits: readonly PaperHit[] }, dt: number) {
    for (const hit of result.hits) {
        s.paperHits++;
        if (!applyFocusHit(s, out, hit.focus)) {
            // Play stops at this sheet: later sheets keep their previous positions this tick.
            s.papers = [...result.papers.slice(0, hit.index + 1), ...s.papers.slice(hit.index + 1)];
            return false;
        }
        s.p.vx *= .88;
        s.p.w += hit.vx * .0009;
        s.paperPenaltyRemaining = RULES.paperPenalty;
        out.push({ type: 'cue', id: 'paper-hit' });
    }
    s.papers = trimPapers(result.papers);
    out.push({ type: 'particles-step', dt });
    return true;
}

// Returns true while the rooftop door scene owns the chair.
export function applyRooftopEntrance(s: GameState, dt: number) {
    if (s.rooftopEntrance.kind !== 'opening') return false;
    const r = entranceStep(s.rooftopEntrance, dt);
    s.rooftopEntrance = r.entrance;
    setPlayer(s, r.pose);
    s.ground = true;
    if (r.done) {
        s.keys = [];
        s.jumpQ = 0;
    }
    return true;
}

export function applyRooftop(s: GameState, out: GameEvent[], dt: number) {
    const r = rooftopStep(s, dt);
    setPlayer(s, r.p);
    s.ground = r.ground;
    s.ductReaction = r.ductReaction;
    s.firstFlight = r.firstFlight;
    if (r.pickup) {
        s.hasExtinguisher = true;
        s.checkpoint = 1;
        out.push({ type: 'cue', id: 'extinguisher-pickup' });
        out.push({ type: 'cue', id: 'checkpoint' });
    }
}

// A spray on the rooftop can wake the duct and counts toward the launch.
export function applyRooftopSpray(s: GameState, direction: number) {
    if (s.stage !== 3) return;
    s.ductReaction = ductSprayed(s.ductReaction, s.p);
    const r = launchShot(s.firstFlight, s.p, s.time, direction);
    s.firstFlight = r.firstFlight;
    setPlayer(s, r.p);
    if (r.takeoff) {
        s.keys = [];
        s.jumpQ = 0;
    }
}

// Returns 'flight' while climbing, 'arrived' on reaching the sky, false when not flying.
export function applyFlight(s: GameState, dt: number): false | 'flight' | 'arrived' {
    if (s.firstFlight.kind !== 'flight') return false;
    const r = flightStep(s.firstFlight, s.p, dt);
    s.firstFlight = r.flight;
    setPlayer(s, r.p);
    s.sprayBurst = .24;
    s.sprayDir = { x: 0, y: 1 };
    return r.arrived ? 'arrived' : 'flight';
}

export function applySky(s: GameState, out: GameEvent[], dt: number) {
    const held = (input: Input) => s.keys.includes(input) ? 1 : 0;
    const r = skyStep({
        sky: s.sky, p: s.p, ground: s.ground, coyote: s.coyote, jumpQ: s.jumpQ, checkpoint: s.checkpoint, time: s.time,
        direction: held('right') - held('left'), depthDir: held('forward') - held('back'),
        length: STAGES[s.stage].length, sprayBurst: s.sprayBurst, sprayDir: s.sprayDir,
    }, dt);
    s.sky = r.sky;
    setPlayer(s, r.p);
    s.ground = r.ground;
    s.coyote = r.coyote;
    s.jumpQ = r.jumpQ;
    s.checkpoint = r.checkpoint;
    s.sprayBurst = r.sprayBurst;
    s.sprayDir = r.sprayDir;
    if (r.speed !== null) s.actualSpeed = r.speed;
    if (r.reached) out.push({ type: 'cue', id: 'checkpoint' });
    if (r.fell) s.deaths++;
    if (r.won) {
        s.mode = 'won';
        s.keys = [];
        out.push({ type: 'cue', id: 'stage-clear' });
    }
    // Reaching the depth reveal and moving through it counts as clearing the sky.
    if (s.sky.depthTravel > .65 && s.completedStage < 4) s.completedStage = 4;
}

export function applyHeadHit(s: GameState, out: GameEvent[], point: Point) {
    if (s.mode !== 'play' || s.inBin) return;
    s.deaths++;
    s.lossReason = 'head';
    s.keys = [];
    s.impact = impactReplay(s.history, s.p, point);
    s.mode = 'impact';
    out.push({ type: 'cue', id: 'head-hit' });
    out.push({ type: 'cue', id: 'head-comment' });
}

export function applyImpact(s: GameState, out: GameEvent[], dt: number) {
    if (!s.impact) return;
    const r = impactStep(s.impact, dt);
    s.impact = r.impact;
    if (r.pose) s.p = r.pose;
    if (r.done) {
        s.mode = 'dead';
        out.push({ type: 'cue', id: 'head-game-over' });
    }
}

export function applyConvoyLanding(s: GameState) {
    const r = convoyLanding(s.corridor, s.furniture, s.p, s.ground);
    if (!r) return;
    s.corridor.convoy = r.convoy;
    if (r.vx !== null) s.p.vx = r.vx;
}

// Returns true while the lift carries the rider down.
export function applyLiftRide(s: GameState, out: GameEvent[], dt: number) {
    const r = liftRide(s.corridor.departure, dt);
    if (!r) return false;
    s.corridor.departure = r.departure;
    setPlayer(s, { x: s.p.x, y: r.y, vx: 0, vy: 0, a: 0, w: 0 });
    s.ground = false;
    s.actualSpeed = 0;
    s.jumpQ = s.coyote = 0;
    if (r.lost) {
        s.corridor.lift = { kind: 'departed' };
        s.corridor.convoy = 'free';
        s.mode = 'dead';
        s.lossReason = 'lift';
        s.deaths++;
        s.keys = [];
        out.push({ type: 'cue', id: 'lift-game-over' });
    }
    return true;
}

export function applyCorridor(s: GameState, dt: number, previousX: number) {
    const r = corridorStep({
        corridor: s.corridor, furniture: s.furniture, p: s.p, ground: s.ground,
        steering: s.keys.includes('left') || s.keys.includes('right'),
        rng: s.rng.cosmetic, length: STAGES[s.stage].length,
    }, dt, previousX);
    s.corridor = r.corridor;
    s.furniture = r.furniture;
    setPlayer(s, r.p);
    s.rng.cosmetic = r.rng;
    if (r.stopRider) s.jumpQ = s.coyote = 0;
}

// Returns true while the meeting scene owns the rider.
export function applyMeeting(s: GameState, dt: number) {
    if (s.corridor.room.kind !== 'meeting') return false;
    const r = meetingStep(s.corridor.room, dt);
    s.corridor.room = r.room;
    s.p.x = r.x;
    if (r.leave) applyLeaveMeeting(s, true);
    return true;
}

export function applyLeaveMeeting(s: GameState, pushed = false) {
    const room = s.corridor.room;
    if (room.kind !== 'meeting') return;
    setPlayer(s, meetingExit(room.returnX, pushed));
    s.corridor.room = { kind: 'corridor' };
    s.keys = [];
    s.jumpQ = 0;
    s.ground = true;
    s.actualSpeed = 0;
}

export function applyInteract(s: GameState) {
    if (s.mode !== 'play') return;
    if (s.corridor.room.kind === 'meeting') { applyLeaveMeeting(s); return; }
    if (!canEnterMeeting(s)) return;
    s.corridor.room = { kind: 'meeting', age: 0, returnX: s.p.x };
    s.corridor.meetingVisited = true;
    setPlayer(s, MEETING_SEAT);
    s.keys = [];
    s.jumpQ = 0;
    s.actualSpeed = 0;
}
