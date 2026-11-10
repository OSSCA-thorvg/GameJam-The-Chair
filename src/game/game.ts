import { STAGE_TWO, type StageId } from './stage2';
import { skyStep } from './systems/sky';
import { rooftopStep, firstFlightStep, rooftopEntranceStep, rooftopLaunchShot, ductSpray } from './systems/rooftop';
import { LEVEL, FIXED_STEP } from './level';
import type { Input, DeepReadonly, Mode } from './types';
import { clamp, contact } from './geometry';
import { createCore, resetAttempt, startStage as beginStage, serializeState, restoreState, snapshot, type Progress } from './core';
import { focusBlocked, focusStep, advanceFocusLoss } from './systems/focus';
import { shoot, particlesStep } from './systems/papers';
import { cleaningStep } from './systems/cleaning';
import { geyserStep } from './systems/geyser';
import { monitorPhase, monitorStep } from './systems/monitor';
import { fail, impactStep } from './systems/impact';
import { canEnterMeeting, interactMeeting, leaveMeeting, meetingStep, corridorStep, landInConvoy, liftRideStep } from './systems/corridor';
import { binEnter } from './systems/bin';

export type GameOptions = {
    // Same seed, start and commands always produce the same run. The browser passes a random seed.
    seed?: number;
    progress?: Partial<Pick<Progress, 'deaths' | 'completedStage'>>;
};

// Modes in which fixed steps advance the game. Others wait for a command.
const SIMULATED: readonly Mode[] = ['play', 'impact', 'focuslost'];

export function createGame(options: GameOptions = {}) {
    const F = LEVEL.floor;
    const s = createCore({ seed: options.seed ?? 0, deaths: options.progress?.deaths, completedStage: options.progress?.completedStage });
    // Real frame time waiting to become fixed steps. Shell-only: it never reaches game state.
    let acc = 0;

    function reset() {
        resetAttempt(s);
    }
    function jump() {
        if (s.mode !== 'play' || s.corridor.room.kind === 'meeting' || s.rooftopEntrance.kind === 'opening') return;
        s.jumpQ = .14;
    }

    function spray() {
        if (s.mode !== 'play' || !s.hasExtinguisher || s.stage === 4 || s.firstFlight.kind === 'flight' || s.sprayCooldown > 0) return;
        const dx = (s.keys.includes('right') ? 1 : 0) - (s.keys.includes('left') ? 1 : 0);
        const len = Math.hypot(dx, 1);
        s.sprayDir = { x: -dx / len, y: 1 / len };
        s.p.vx += dx * 150;
        s.p.vy = Math.max(-500, Math.min(0, s.p.vy) - (dx ? 430 : 470));
        s.ground = false;
        s.coyote = 0;
        s.sprayCooldown = .24;
        s.sprayBurst = .24;
        s.events.push({ type: 'cue', id: 'spray' });
        ductSpray(s);
        rooftopLaunchShot(s, dx);
    }

    function pause() {
        if (s.mode !== 'play' && s.mode !== 'pause') return;
        s.mode = s.mode === 'play' ? 'pause' : 'play';
        s.keys = [];
        acc = 0;
    }

    // One fixed step in any mode. Every game advance goes through here.
    function tick() {
        if (!SIMULATED.includes(s.mode)) return;
        s.tick++;
        if (s.mode === 'play') playStep(FIXED_STEP);
        else if (s.mode === 'impact') impactStep(s, FIXED_STEP);
        else advanceFocusLoss(s, FIXED_STEP);
    }

    function playStep(dt: number) {
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
        if (s.keys.includes('spray')) spray();
        s.events.push({ type: 'tick', dt });
        if (s.stage === 3) {
            if (rooftopEntranceStep(s, dt)) return;
            const flight = firstFlightStep(s, dt);
            if (flight) {
                if (flight === 'arrived') {
                    if (s.completedStage < 3) s.completedStage = 3;
                    const arrival = { ...s.p };
                    beginStage(s, 4);
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
        if (s.stage === 2 && liftRideStep(s, dt)) return;
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
                shoot(s);
                s.copier.burst--;
                s.copier.next = .19;
            }
        }
        particlesStep(s, dt);
        if (s.mode !== 'play') return;
        if (s.stage === 1) {
            cleaningStep(s, dt);
            geyserStep(s, dt);
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
            s.events.push({ type: 'cue', id: 'slipping' });
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
        if (s.stage === 1 && s.binCooldown === 0 && p.x > s.bin.a + 25 && p.x < s.bin.b - 25 && p.y + 28 >= s.bin.rim && p.vy >= 0) {
            binEnter(s);
            return;
        }
        if (s.stage === 2) {
            corridorStep(s, dt, prev);
            for (let i = s.checkpoint + 1; i < STAGE_TWO.checkpoints.length; i++) {
                const mark = STAGE_TWO.checkpoints[i];
                if (p.x >= mark.x && Math.abs(p.y - mark.y) < 65) {
                    s.checkpoint = i;
                    s.focus = 100;
                    s.focusClock = 0;
                    s.events.push({ type: 'cue', id: 'checkpoint' });
                }
            }
        }
        s.solids = s.solids.filter(ob => !ob.practice);
        if (s.stage <= 2 && !s.lessons.jumped) {
            const pile = LEVEL.practicePaper;
            s.solids.push({
                p: [
                    { x: pile.x - pile.width / 2, y: F },
                    { x: pile.x - 3, y: F - pile.height },
                    { x: pile.x + 3, y: F - pile.height },
                    { x: pile.x + pile.width / 2, y: F },
                ],
                practice: true,
            });
        }
        s.ground = false;
        let c = Math.cos(p.a);
        let sn = Math.sin(p.a);
        const head = s.parts[7];
        const hx = p.x - head.y * sn;
        const hy = p.y + head.y * c;
        for (const ob of s.solids) {
            const hit = contact(hx, hy, head.r, ob.p);
            if (hit && hit.ny < -.25 && hit.depth > .05) {
                fail(s, { x: hx, y: hy });
                return;
            }
        }
        for (let iter = 0; iter < 5; iter++) {
            for (const part of s.parts) {
                c = Math.cos(p.a);
                sn = Math.sin(p.a);
                const rx = part.x * c - part.y * sn;
                const ry = part.x * sn + part.y * c;
                for (const ob of s.solids) {
                    const hit = contact(p.x + rx, p.y + ry, part.r, ob.p);
                    if (!hit) continue;
                    if (part.head && hit.ny < -.25 && hit.depth > .05) {
                        fail(s, { x: p.x + rx, y: p.y + ry });
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
        if (s.stage === 3) rooftopStep(s, dt);
        if (s.stage === 2) landInConvoy(s);
        if (s.stage === 1) {
            monitorStep(s, dt, prev);
        }
        if (s.mode !== 'play') return;
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
            s.events.push({ type: 'cue', id: 'practice-cleared' });
        }
        s.actualSpeed += (Math.abs(p.x - prev) / dt - s.actualSpeed) * (1 - Math.exp(-dt / .12));
        if (s.stage === 1 && !s.officeCheckpoint && p.x >= 1400 && p.x < s.bin.a - 25) {
            s.officeCheckpoint = true;
            s.focus = 100;
            s.focusClock = 0;
            s.events.push({ type: 'cue', id: 'checkpoint' });
        }
        if (s.ground && dir && Math.abs(p.vx) > 95 && s.rollCooldown === 0) {
            s.events.push({ type: 'cue', id: 'rolling' });
            s.rollCooldown = 9;
        }
        if (s.people.length > 0 && p.vx < -60 && s.reverseCooldown === 0) {
            const n = s.people.reduce((a, b) => Math.abs(a.x - p.x) < Math.abs(b.x - p.x) ? a : b);
            if (Math.abs(n.x - p.x) < 300) {
                s.events.push({ type: 'cue', id: 'reverse-comment', person: { ...n } });
                s.reverseCooldown = 7;
            }
        }
        for (const n of s.people) {
            if (!n.said && Math.min(Math.abs(p.x - n.x), Math.abs(prev - n.x)) < 100) {
                n.said = true;
                s.events.push({ type: 'cue', id: 'person-comment', person: { ...n } });
            }
        }
        if (s.slip && Math.abs(p.vx) > 90 && Math.floor(s.time * 30) !== Math.floor((s.time - dt) * 30)) {
            s.events.push({ type: 'speck', x: p.x - 15, vx: -p.vx * .2 });
        }
        if (p.y > F + 250) {
            if (s.stage >= 2) {
                s.deaths++;
                reset();
                return;
            }
            binEnter(s);
            return;
        }
        if (s.stage <= 2 && p.x > s.GOAL) {
            if (s.stage > s.completedStage) s.completedStage = s.stage;
            s.mode = 'won';
            s.keys = [];
            s.events.push({ type: 'cue', id: 'stage-clear' });
        }
    }

    function getSnapshot() {
        return structuredClone({
            game: s.stage === 1 ? 'office-stage-one' : s.stage === 2 ? 'building-stage-two' : s.stage === 3 ? 'rooftop-stage-three' : 'cloud-stage-four',
            spray: { burst: s.sprayBurst, cooldown: s.sprayCooldown, dir: s.sprayDir },
            lessons: s.lessons,
            officeCheckpoint: s.officeCheckpoint,
            skylineSeed: s.skylineSeed,
            actualSpeed: s.mode === 'play' ? s.actualSpeed : 0,
            tutorialAssist: s.mode === 'play' && s.p.x < 300,
            stage: s.stage,
            completedStage: s.completedStage,
            hasExtinguisher: s.hasExtinguisher,
            firstFlight: s.firstFlight,
            rooftopEntrance: s.rooftopEntrance,
            ductReaction: s.ductReaction,
            checkpoint: s.checkpoint,
            furniture: s.furniture,
            corridor: s.corridor,
            canEnterMeeting: canEnterMeeting(s),
            level: { length: s.LEN, goal: s.GOAL },
            mode: s.mode,
            focus: s.focus,
            focusClock: s.focusClock,
            focusLossTime: s.focusLossTime,
            focusNotice: s.focusNotice,
            lossReason: s.lossReason,
            player: s.p,
            ground: s.ground,
            slip: s.slip,
            dirty: s.dirty,
            inBin: s.inBin,
            binAge: s.binAge,
            time: s.time,
            deaths: s.deaths,
            bursts: s.bursts,
            paperHits: s.paperHits,
            binFalls: s.binFalls,
            dirtyWaterExperienced: s.wetSeen,
            cleaningSpilled: s.cleaning.spilled,
            soaked: s.soakedOnSpill > 0,
            bucketAge: s.bucket.age,
            paperPenaltyRemaining: s.paperPenaltyRemaining,
            lightPenaltyRemaining: s.lightPenaltyRemaining,
            cleaning: s.cleaning,
            lightHits: s.lightHits,
            doorHits: s.doorHits,
            monitors: LEVEL.monitors.map(monitor => ({ ...monitor, ...monitorPhase(monitor, s.time) })),
            papers: s.papers,
            people: s.people,
            solids: s.solids,
            copier: s.copier,
            bin: s.bin,
            focusBlocked: focusBlocked(s),
        });
    }

    function advance(dt: number) {
        if (!Number.isFinite(dt) || dt < 0) return;
        if (!SIMULATED.includes(s.mode)) {
            acc = 0;
            return;
        }
        acc += dt;
        while (acc >= FIXED_STEP) {
            const mode = s.mode;
            tick();
            acc -= FIXED_STEP;
            // A new mode starts counting from the next frame, as before fixed ticks.
            if (s.mode !== mode) {
                acc = 0;
                break;
            }
        }
    }

    function startStage(id: StageId) {
        beginStage(s, id);
        acc = 0;
    }

    return {
        reset() {
            reset();
            acc = 0;
        },
        jump,
        interact: () => interactMeeting(s),
        leaveMeeting: () => { if (s.mode === 'play') leaveMeeting(s); },
        spray,
        pause,
        /** One fixed step (1/120 s). The argument is ignored and kept for older callers. */
        step: (_dt?: number) => tick(),
        advance,
        startStage,
        restart() {
            if (s.mode === 'play') s.deaths++;
            reset();
            acc = 0;
        },
        // Preview-only scrubbing at arbitrary frame times. Never used by real play or replays.
        advanceImpact: (dt: number) => impactStep(s, dt),
        advanceFocusLoss: (dt: number) => advanceFocusLoss(s, dt),
        setInput(...input: Input[]) {
            s.keys = [...new Set(input)];
        },
        press(input: Input) {
            if (s.mode === 'play' && !s.keys.includes(input)) s.keys.push(input);
        },
        release(input: Input) {
            s.keys = s.keys.filter(key => key !== input);
        },
        clearInput() {
            s.keys = [];
        },
        /** Full game state as JSON. Restoring it into any game continues the run exactly. */
        serialize: () => serializeState(s),
        restore(json: string) {
            restoreState(s, json);
            acc = 0;
        },
        getSnapshot: getSnapshot as () => DeepReadonly<ReturnType<typeof getSnapshot>>,
        drainEvents() {
            return s.events.splice(0);
        },
    };
}

export type Game = ReturnType<typeof createGame>;
export type GameState = ReturnType<Game['getSnapshot']>;
