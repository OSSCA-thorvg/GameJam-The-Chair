import { STAGE_TWO, createFurniture, elevatorAt, doorAt, chairFloorAt, type StageId } from './stage2';
import { STAGE_THREE, fanStrength } from './stage3';
import { LEVEL, RULES, FIXED_STEP } from './level';
import type { Input, DeepReadonly } from './types';
import { clamp, polyRect, contact } from './geometry';
import { createCore, snapshot } from './core';
import { focusHit, focusBlocked, focusStep, advanceFocusLoss } from './systems/focus';
import { shoot, particlesStep } from './systems/papers';
import { cleaningStep } from './systems/cleaning';
import { monitorPhase, monitorStep } from './systems/monitor';
import { fail, impactStep } from './systems/impact';
import { binEnter } from './systems/bin';

export function createGame(initialDeaths = 0, initialCompletedStage: 0 | StageId = 0) {
    const F = LEVEL.floor;
    const s = createCore(initialDeaths);
    let completedStage = initialCompletedStage;

    function build() {
        if (s.stage === 3) {
            s.solids = STAGE_THREE.terrain.map(p => ({ p: p.map(v => ({ ...v })) }));
            s.people = [];
            s.furniture = [];
            return;
        }
        if (s.stage === 2) {
            s.solids = STAGE_TWO.terrain.map(p => ({ p: p.map(v => ({ ...v })) }));
            s.people = [];
            s.furniture = createFurniture();
            return;
        }
        s.solids = [
            { p: polyRect(-400, F, s.bin.a + 400, 350) },
            { p: polyRect(s.bin.b, F, s.LEN - s.bin.b + 400, 350) },
        ];
        s.people = [
            { id: 'manager', x: 320, said: false },
            { id: 'cleaner', x: 1000, said: false },
            { id: 'admin', x: 1810, said: false },
        ];
    }

    function reset() {
        build();
        const spawn = s.stage === 3
            ? STAGE_THREE.checkpoints[s.checkpoint]
            : s.stage === 2
                ? STAGE_TWO.checkpoints[s.checkpoint]
                : { x: s.officeCheckpoint ? 1400 : 100, y: F - 28 };
        s.p = { ...spawn, vx: 0, vy: 0, a: 0, w: 0 };
        s.actualSpeed = 0;
        s.practiceJump = false;
        s.keys.clear();
        s.ground = false;
        s.coyote = 0;
        s.jumpQ = 0;
        s.escapeQueued = false;
        s.time = 0;
        s.t = 0;
        s.elevator = elevatorAt(0);
        s.acc = 0;
        s.dirty = false;
        s.inBin = false;
        s.binAge = 0;
        s.binCooldown = 0;
        s.slip = false;
        s.wetSeen = false;
        s.slipCooldown = 0;
        s.papers = [];
        s.paperPenaltyRemaining = 0;
        s.paperHits = 0;
        s.bursts = 0;
        s.binFalls = 0;
        s.history = [];
        s.impact = null;
        s.rollCooldown = 0;
        s.reverseCooldown = 0;
        s.focus = 100;
        s.focusClock = 0;
        s.focusEvents.clear();
        s.focusNotice = null;
        s.volley = 0;
        s.lossReason = null;
        s.focusLossTime = 0;
        s.soakedOnSpill = 0;
        Object.assign(s.cleaning, { spilled: false, age: 0, followup: false, splashDir: 0 });
        Object.assign(s.bucket, { age: RULES.bucketReset, armed: true, spills: 0 });
        s.lightPenaltyRemaining = 0;
        s.lightHits = 0;
        s.doorHits = 0;
        s.lightCooldown = 0;
        Object.assign(s.copier, { cool: 0, burst: 0, next: 0 });
        s.sprayAmmo = 4;
        s.sprayCooldown = 0;
        s.sprayCharge = 0;
        s.sprayBurst = 0;
        s.sprayDir = { x: 0, y: 1 };
        s.onFan = false;
        s.mode = 'play';
        s.events.length = 0;
        s.events.push({ type: 'reset' });
    }

    function jump() {
        if (s.mode !== 'play') return;
        s.jumpQ = .14;
    }

    function spray() {
        if (s.mode !== 'play' || s.stage !== 3) return;
        if (s.sprayCooldown > 0) return;
        if (s.sprayAmmo <= 0) {
            s.events.push({ type: 'cue', id: 'spray-empty' });
            return;
        }
        const dx = (s.keys.has('right') ? 1 : 0) - (s.keys.has('left') ? 1 : 0);
        const len = Math.hypot(dx, 1);
        const nx = dx / len;
        const ny = 1 / len;
        s.sprayDir = { x: nx, y: ny };
        s.p.vx -= nx * 220;
        s.p.vy -= ny * 260;
        s.sprayAmmo--;
        s.sprayCooldown = .35;
        s.sprayBurst = .32;
        s.lessons.sprayed = true;
        s.events.push({ type: 'cue', id: 'spray' });
    }

    function pause() {
        if (s.mode !== 'play' && s.mode !== 'pause') return;
        s.mode = s.mode === 'play' ? 'pause' : 'play';
        s.keys.clear();
        s.acc = 0;
    }

    function step(dt: number) {
        if (s.mode !== 'play') return;
        s.history.push(snapshot(s));
        if (s.history.length > 60) s.history.shift();
        s.time += dt;
        s.t += dt;
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
        if (s.ground && s.sprayAmmo < 4) {
            s.sprayCharge += dt;
            if (s.sprayCharge >= .7) {
                s.sprayAmmo++;
                s.sprayCharge = 0;
            }
        } else if (!s.ground) {
            s.sprayCharge = 0;
        }
        s.events.push({ type: 'tick', dt });
        if (s.stage === 1 && Math.abs(s.p.x - s.copier.x) < 180 && s.copier.cool === 0 && s.copier.burst === 0) {
            s.copier.dir = s.p.x < s.copier.x ? -1 : 1;
            s.volley++;
            s.copier.burst = 3;
            s.copier.next = .75;
            s.copier.cool = 4.6;
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
        }
        if (s.mode !== 'play') return;

        const p = s.p;
        const was = s.ground;
        const dir = (s.keys.has('right') ? 1 : 0) - (s.keys.has('left') ? 1 : 0);
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
            p.vy = -350;
            p.w -= dir * .12;
            s.ground = false;
            s.coyote = 0;
            s.jumpQ = 0;
        }
        const balancing = s.keys.has('q') || s.keys.has('e');
        const tilt = (s.keys.has('e') ? 1 : 0) - (s.keys.has('q') ? 1 : 0) + (was || balancing ? 0 : dir);
        p.w += tilt * (was ? 4.3 : 6.4) * dt;
        if (p.x < 300) {
            p.w += (-Math.sin(p.a) * 20 - p.w * 7) * dt;
        }
        if (was && dir) {
            p.vx += dir * (s.slip ? 110 : 305) * dt;
        } else if (!was && dir) {
            p.vx += dir * 55 * dt;
        }
        p.vy += 800 * dt;
        p.vx *= Math.exp(-(was ? (s.slip ? .015 : .55) : .09) * dt);
        p.w *= Math.exp(-(was ? (s.slip ? .9 : 1.8) : .75) * dt);
        p.vx = clamp(p.vx, -315, 315);
        p.vy = clamp(p.vy, -500, 850);
        p.w = clamp(p.w, -5.8, 5.8);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.a += p.w * dt;
        if (s.stage === 1 && s.binCooldown === 0 && p.x > s.bin.a + 25 && p.x < s.bin.b - 25 && p.y + 28 >= s.bin.rim && p.vy >= 0) {
            binEnter(s);
            return;
        }
        if (s.stage === 3) {
            s.solids = STAGE_THREE.terrain.map(poly => ({ p: poly.map(v => ({ ...v })) }));
            s.onFan = false;
            for (const fan of STAGE_THREE.fans) {
                const str = fanStrength(fan, s.t);
                if (str > 60 && p.x > fan.x - fan.width / 2 && p.x < fan.x + fan.width / 2 && p.y > fan.y - fan.height && p.y < fan.y + 40) {
                    p.vy -= str * dt;
                    p.w += (p.x - fan.x) / fan.width * 2.4 * dt;
                    s.onFan = true;
                }
            }
            for (let i = s.checkpoint + 1; i < STAGE_THREE.checkpoints.length; i++) {
                const mark = STAGE_THREE.checkpoints[i];
                if (p.x >= mark.x && Math.abs(p.y - mark.y) < 65) {
                    s.checkpoint = i;
                    s.events.push({ type: 'cue', id: 'checkpoint' });
                }
            }
        }
        if (s.stage === 2) {
            const oldElevator = s.elevator;
            s.elevator = elevatorAt(s.t);
            if (was && Math.abs(p.y + 28 - oldElevator.y) < 12 && p.x > oldElevator.x - 15 && p.x < oldElevator.x + oldElevator.width + 15) {
                p.x += s.elevator.x - oldElevator.x;
            }
            for (const item of s.furniture) {
                const reach = item.width / 2 + 44;
                if (Math.abs(p.x - item.x) < reach && p.y + 20 > item.y - item.height && p.y - 45 < item.y) {
                    const side = p.x < item.x ? -1 : 1;
                    item.vx += p.vx * dt * 8;
                    p.vx *= Math.exp(-2 * dt);
                    p.x = item.x + side * reach;
                }
                item.x += item.vx * dt;
                item.vx *= Math.exp(-3 * dt);
                item.x = clamp(item.x, item.kind === 'cabinet' ? 2050 : 40, item.kind === 'cabinet' ? 2295 : s.LEN - 40);
                if (item.kind === 'chair') {
                    item.y = chairFloorAt(item.x);
                }
            }
            for (let i = 0; i < s.furniture.length; i++) {
                for (let j = i + 1; j < s.furniture.length; j++) {
                    const a = s.furniture[i];
                    const b = s.furniture[j];
                    const overlap = (a.width + b.width) / 2 - Math.abs(a.x - b.x);
                    if (overlap > 0 && a.kind === b.kind) {
                        const sign = a.x < b.x ? -1 : 1;
                        a.x += sign * overlap / 2;
                        b.x -= sign * overlap / 2;
                        a.vx = b.vx = (a.vx + b.vx) / 2;
                    }
                }
            }
            s.solids = STAGE_TWO.terrain.map(p => ({ p: p.map(v => ({ ...v })) }));
            for (const item of s.furniture) {
                s.solids.push({ p: polyRect(item.x - item.width / 2, item.y - item.height, item.width, item.height) });
            }
            s.solids.push({ p: polyRect(s.elevator.x, s.elevator.y, s.elevator.width, s.elevator.height) });
            const door = doorAt(s.t);
            if (!door.open && Math.abs(p.x - door.x) < 47 && p.y > 260) {
                const side = prev < door.x ? -1 : 1;
                p.x = door.x + side * 48;
                p.vx = side * 70;
                p.w *= .5;
                focusHit(s, 'door', ++s.doorHits);
                if (s.mode !== 'play') return;
            }
            for (let i = s.checkpoint + 1; i < STAGE_TWO.checkpoints.length; i++) {
                const mark = STAGE_TWO.checkpoints[i];
                if (p.x >= mark.x && Math.abs(p.y - mark.y) < 65) {
                    s.checkpoint = i;
                    s.events.push({ type: 'cue', id: 'checkpoint' });
                }
            }
        }
        s.solids = s.solids.filter(ob => !ob.practice);
        if (!s.lessons.jumped) {
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
        s.lessons.binJumped ||= s.stage === 1 && p.x > s.bin.b && p.y < F;
        if (!s.lessons.jumped && s.practiceJump && s.ground && p.x < 330) {
            s.lessons.jumped = true;
            s.events.push({ type: 'cue', id: 'practice-cleared' });
        }
        s.actualSpeed += (Math.abs(p.x - prev) / dt - s.actualSpeed) * (1 - Math.exp(-dt / .12));
        if (s.stage === 1 && !s.officeCheckpoint && p.x >= 1400 && p.x < s.bin.a - 25) {
            s.officeCheckpoint = true;
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
        if (s.slip && Math.abs(p.vx) > 90 && Math.floor(s.t * 30) !== Math.floor((s.t - dt) * 30)) {
            s.events.push({ type: 'speck', x: p.x - 15, vx: -p.vx * .2 });
        }
        if (p.y > F + 250) {
            if (s.stage === 2 || s.stage === 3) {
                s.deaths++;
                reset();
                return;
            }
            binEnter(s);
            return;
        }
        if (p.x > s.GOAL) {
            if (s.stage > completedStage) completedStage = s.stage;
            s.mode = 'won';
            s.keys.clear();
            s.events.push({ type: 'cue', id: 'stage-clear' });
        }
    }

    build();

    function getSnapshot() {
        const predictedAngle = Math.atan2(Math.sin(s.p.a), Math.cos(s.p.a)) + s.p.w * .2;
        const balanceHint: 'q' | 'e' | null = s.mode === 'play' && Math.abs(predictedAngle) > .18 ? (predictedAngle > 0 ? 'q' : 'e') : null;
        return structuredClone({
            game: s.stage === 1 ? 'office-stage-one' : s.stage === 2 ? 'building-stage-two' : 'rooftop-stage-three',
            fans: s.stage === 3 ? STAGE_THREE.fans.map(f => ({ ...f, active: fanStrength(f, s.t) > 60, power: fanStrength(f, s.t) })) : [],
            spray: { ammo: s.sprayAmmo, burst: s.sprayBurst, cooldown: s.sprayCooldown, dir: s.sprayDir },
            onFan: s.onFan,
            lessons: s.lessons,
            officeCheckpoint: s.officeCheckpoint,
            actualSpeed: s.mode === 'play' ? s.actualSpeed : 0,
            tutorialAssist: s.mode === 'play' && s.p.x < 300,
            balanceHint,
            stage: s.stage,
            completedStage,
            hasExtinguisher: s.stage === 3,
            checkpoint: s.checkpoint,
            furniture: s.furniture,
            elevator: s.elevator,
            door: doorAt(s.t),
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
            monitor: { ...s.monitor, ...monitorPhase(s) },
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
        if (s.mode === 'play') {
            s.acc += dt;
            while (s.acc >= FIXED_STEP) {
                step(FIXED_STEP);
                s.acc -= FIXED_STEP;
                if (s.mode !== 'play') {
                    s.acc = 0;
                    break;
                }
            }
        } else {
            s.acc = 0;
            if (s.mode === 'impact') impactStep(s, dt);
            if (s.mode === 'focuslost') advanceFocusLoss(s, dt);
        }
    }

    return {
        reset,
        jump,
        spray,
        pause,
        step,
        advance,
        startStage(id: StageId) {
            s.stage = id;
            s.checkpoint = 0;
            s.officeCheckpoint = false;
            s.lessons = { moved: false, jumped: false, binJumped: false, sprayed: false };
            s.LEN = s.stage === 1 ? LEVEL.length : s.stage === 2 ? STAGE_TWO.length : STAGE_THREE.length;
            s.GOAL = s.stage === 1 ? LEVEL.goal : s.stage === 2 ? STAGE_TWO.goal : STAGE_THREE.goal;
            reset();
        },
        restart() {
            if (s.mode === 'play') s.deaths++;
            reset();
        },
        advanceImpact: (dt: number) => impactStep(s, dt),
        advanceFocusLoss: (dt: number) => advanceFocusLoss(s, dt),
        setInput(...input: Input[]) {
            s.keys = new Set(input);
        },
        press(input: Input) {
            if (s.mode === 'play') s.keys.add(input);
        },
        release(input: Input) {
            s.keys.delete(input);
        },
        clearInput() {
            s.keys.clear();
        },
        getSnapshot: getSnapshot as () => DeepReadonly<ReturnType<typeof getSnapshot>>,
        drainEvents() {
            return s.events.splice(0);
        },
    };
}

export type Game = ReturnType<typeof createGame>;
export type GameState = ReturnType<Game['getSnapshot']>;
