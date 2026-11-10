import type { GameState } from './state';
import type { GameEvent } from './types';
import { focusHit, type FocusHit } from './systems/focus';
import type { GeyserHit } from './systems/geyser';
import type { MonitorContact } from './systems/monitor';
import { RULES } from './level';
import { BIN_REST } from './systems/bin';
import type { CleaningResult } from './systems/cleaning';
import { paperShot, trimPapers, type CopierResult, type PaperHit } from './systems/papers';
import type { Paper } from './types';
import { ductSprayed, entranceStep, flightStep, launchShot, rooftopStep } from './systems/rooftop';

// The only place where system decisions are written into game state. Systems decide; these apply.
// Each applier returns false when the attempt stopped (focus lost, death) so the step can end early.

// Player updates keep the same object: the play step holds a reference to it for the whole tick.
function setPlayer(s: GameState, p: Readonly<GameState['p']>) {
    Object.assign(s.p, p);
}

export function applyFocusHit(s: GameState, out: GameEvent[], hit: FocusHit) {
    focusHit(s, out, hit.kind, hit.id, hit.damage);
    return s.mode === 'play';
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
