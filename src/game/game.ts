import { LEVEL, RULES, FIXED_STEP } from './level';
import type { Point, Player, Snapshot, Person, Paper, Input, GameEvent, DeepReadonly } from './types';
export function createGame(initialDeaths = 0) {
    const F = LEVEL.floor;
    const LEN = LEVEL.length;
    const GOAL = LEVEL.goal;
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const monitor = { ...LEVEL.monitor };
    const copier = { ...LEVEL.copier, cool: 0, burst: 0, next: 0, dir: -1 };
    const cleaning = { ...LEVEL.cleaning, spilled: false, age: 0, followup: false, splashDir: 0 };
    const bucket: { age: number; armed: boolean; spills: number } = { age: RULES.bucketReset, armed: true, spills: 0 };
    const bin = { ...LEVEL.bin };
    const parts = LEVEL.playerContacts;
    const events: GameEvent[] = [];
    let mode = 'intro';
    let p: Player = { x: 100, y: F - 28, vx: 0, vy: 0, a: 0, w: 0 };
    let keys = new Set<Input>();
    let ground = false;
    let coyote = 0;
    let jumpQ = 0;
    let time = 0;
    let t = 0;
    let acc = 0;
    let deaths = initialDeaths;
    let dirty = false;
    let inBin = false;
    let binAge = 0;
    let binCooldown = 0;
    let escapeQueued = false;
    let slip = false;
    let wetSeen = false;
    let slipCooldown = 0;
    let papers: Paper[] = [];
    let paperPenaltyRemaining = 0;
    let paperHits = 0;
    let bursts = 0;
    let binFalls = 0;
    let history: Snapshot[] = [];
    let impact: {
        frames: Snapshot[];
        elapsed: number;
        point: Point;
    } | null = null;
    let rollCooldown = 0;
    let reverseCooldown = 0;
    let people: Person[] = [];
    let solids: {
        p: Point[];
    }[] = [];
    let soakedOnSpill = 0;
    let lightPenaltyRemaining = 0;
    let lightHits = 0;
    let lightCooldown = 0;
    let focus = 100;
    let focusClock = 0;
    let focusEvents = new Set<string>();
    let focusNotice: {
        kind: 'paper' | 'water' | 'light';
        life: number;
    } | null = null;
    let volley = 0;
    let lossReason: string | null = null;
    let focusLossTime = 0;
    function polyRect(x: number, y: number, w: number, h: number) {
        return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
    }
    function build() {
        solids = [{ p: polyRect(-400, F, bin.a + 400, 350) }, { p: polyRect(bin.b, F, LEN - bin.b + 400, 350) }];
        people = [{ id: 'manager', x: 320, said: false }, { id: 'cleaner', x: 1000, said: false }, { id: 'admin', x: 1810, said: false }];
    }
    function reset() {
        build();
        p = { x: 100, y: F - 28, vx: 0, vy: 0, a: 0, w: 0 };
        keys.clear();
        ground = false;
        coyote = 0;
        jumpQ = 0;
        escapeQueued = false;
        time = 0;
        t = 0;
        acc = 0;
        dirty = false;
        inBin = false;
        binAge = 0;
        binCooldown = 0;
        slip = false;
        wetSeen = false;
        slipCooldown = 0;
        papers = [];
        paperPenaltyRemaining = 0;
        paperHits = 0;
        bursts = 0;
        binFalls = 0;
        history = [];
        impact = null;
        rollCooldown = 0;
        reverseCooldown = 0;
        focus = 100;
        focusClock = 0;
        focusEvents.clear();
        focusNotice = null;
        volley = 0;
        lossReason = null;
        focusLossTime = 0;
        soakedOnSpill = 0;
        Object.assign(cleaning, { spilled: false, age: 0, followup: false, splashDir: 0 });
        Object.assign(bucket, { age: RULES.bucketReset, armed: true, spills: 0 });
        lightPenaltyRemaining = 0;
        lightHits = 0;
        lightCooldown = 0;
        Object.assign(copier, { cool: 0, burst: 0, next: 0 });
        mode = 'play';
        events.length = 0;
        events.push({ type: 'reset' });
    }
    function jump() {
        if (mode !== 'play') {
            return;
        }
        jumpQ = .14;
    }
    function pause() {
        if (mode !== 'play' && mode !== 'pause') {
            return;
        }
        mode = mode === 'play' ? 'pause' : 'play';
        keys.clear();
        acc = 0;
    }
    function contact(cx: number, cy: number, r: number, poly: Point[]) {
        let best = Infinity;
        let nx = 0;
        let ny = 0;
        let inside = true;
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % poly.length];
            const ex = b.x - a.x;
            const ey = b.y - a.y;
            const den = ex * ex + ey * ey;
            const u = clamp(((cx - a.x) * ex + (cy - a.y) * ey) / den, 0, 1);
            const dx = cx - a.x - u * ex;
            const dy = cy - a.y - u * ey;
            const d = Math.hypot(dx, dy);
            if (ex * (cy - a.y) - ey * (cx - a.x) < 0) {
                inside = false;
            }
            if (d < best) {
                best = d;
                nx = d > .00001 ? dx / d : ey / Math.sqrt(den);
                ny = d > .00001 ? dy / d : -ex / Math.sqrt(den);
            }
        }
        return inside ? { nx: -nx, ny: -ny, depth: r + best } : best < r ? { nx, ny, depth: r - best } : null;
    }
    function snapshot() {
        return { p: { ...p } };
    }
    function fail(point: Point) {
        if (mode !== 'play' || inBin) {
            return;
        }
        deaths++;
        lossReason = 'head';
        keys.clear();
        impact = { frames: history.slice(-42).concat(snapshot()), elapsed: 0, point };
        mode = 'impact';
        events.push({ type: 'cue', id: 'head-hit' });
        events.push({ type: 'cue', id: 'head-comment' });
    }
    function impactStep(dt: number) {
        if (!impact) {
            return;
        }
        impact.elapsed += dt;
        const n = impact.frames.length - 1;
        const u = Math.min(n, impact.elapsed * .25 * 120);
        const i = Math.min(n - 1, Math.floor(u));
        const f = u - i;
        const a = impact.frames[Math.max(0, i)];
        const b = impact.frames[Math.max(0, i + 1)];
        if (a && b) {
            p = { ...a.p };
            for (const k of ['x', 'y', 'vx', 'vy', 'a', 'w'] as const) {
                p[k] = a.p[k] + (b.p[k] - a.p[k]) * f;
            }
        }
        if (impact.elapsed > n / 120 / .25 + .35) {
            mode = 'dead';
            events.push({ type: 'cue', id: 'head-game-over' });
        }
    }
    function shoot() {
        const dir = copier.dir;
        for (let i = 0; i < 4; i++) {
            papers.push({ x: copier.x + dir * 48, y: F - 90 - i * 4, vx: dir * (200 + i * 24), vy: -60 - i * 27, a: i * .8, w: dir * (3 + i), life: 5, hit: false, landed: false, volley });
        }
        bursts++;
        events.push({ type: 'volley' });
        if (bursts === 1) {
            events.push({ type: 'cue', id: 'first-volley' });
        }
    }
    function particlesStep(dt: number) {
        for (const z of papers) {
            z.life -= dt;
            z.x += z.vx * dt;
            z.y += z.vy * dt;
            z.vx *= Math.exp(-.8 * dt);
            z.vy += 210 * dt;
            z.a += z.w * dt;
            const pit = z.x > bin.a && z.x < bin.b;
            if (z.y > F - 4 && !pit) {
                z.y = F - 4;
                z.vy = 0;
                z.vx *= Math.exp(-4 * dt);
                z.w *= .9;
                z.landed = true;
            }
            if (!z.hit && !z.landed && !inBin && Math.hypot(z.x - p.x, z.y - (p.y - 50)) < 48) {
                z.hit = true;
                paperHits++;
                focusHit('paper', z.volley);
                if (mode !== 'play') {
                    return;
                }
                p.vx *= .88;
                p.w += z.vx * .0009;
                paperPenaltyRemaining = RULES.paperPenalty;
                events.push({ type: 'cue', id: 'paper-hit' });
            }
        }
        papers = papers.filter(z => z.life > 0).slice(-60);
        events.push({ type: 'particles-step', dt });
    }
    function cleaningStep(dt: number) {
        const nearBucket = Math.abs(p.x - cleaning.x) < 150;
        const upright = bucket.age >= RULES.bucketReset;
        if (upright && !nearBucket) {
            bucket.armed = true;
        }
        if (upright && bucket.armed && nearBucket && p.y > F - 200) {
            bucket.age = 0;
            bucket.armed = false;
            bucket.spills++;
            cleaning.spilled = true;
            cleaning.splashDir = p.x < cleaning.x ? -1 : 1;
            events.push({ type: 'water-splash', x: cleaning.x, side: cleaning.splashDir });
            events.push({ type: 'cue', id: 'water-spilled' });
            events.push({ type: 'cue', id: 'water-comment' });
        }
        if (cleaning.spilled) {
            bucket.age += dt;
            cleaning.age += dt;
            if (!cleaning.followup && cleaning.age > 2.75) {
                cleaning.followup = true;
                events.push({ type: 'cue', id: 'water-followup' });
            }
            if (soakedOnSpill !== bucket.spills && waterExposureActive()) {
                soakedOnSpill = bucket.spills;
                focusHit('water', bucket.spills);
                if (mode !== 'play') {
                    return;
                }
            }
        }
        events.push({ type: 'water-step', dt });
    }
    function binEnter() {
        if (mode !== 'play') {
            return;
        }
        inBin = true;
        dirty = true;
        binFalls++;
        deaths++;
        lossReason = 'bin';
        p.x = bin.x;
        p.y = F + 66;
        p.vx = p.vy = p.w = 0;
        p.a = .1;
        keys.clear();
        mode = 'dead';
        events.push({ type: 'cue', id: 'bin-fall' });
        events.push({ type: 'cue', id: 'bin-comment' });
        events.push({ type: 'cue', id: 'bin-game-over' });
    }
    function focusHit(kind: 'paper' | 'water' | 'light', id: number) {
        if (mode !== 'play') {
            return;
        }
        const token = kind + ':' + id;
        if (focusEvents.has(token)) {
            return;
        }
        focusEvents.add(token);
        focus = Math.max(0, focus - 20);
        focusClock = 0;
        focusNotice = { kind, life: 1.7 };
        if (focus === 0) {
            focusFailure();
            return;
        }
    }
    function focusFailure() {
        if (mode !== 'play') {
            return;
        }
        mode = 'focuslost';
        lossReason = 'focus';
        focusLossTime = 0;
        focus = 0;
        focusClock = 0;
        deaths++;
        keys.clear();
        acc = 0;
        events.push({ type: 'cue', id: 'focus-lost' });
    }
    function advanceFocusLoss(dt: number) {
        if (mode !== 'focuslost') {
            return;
        }
        focusLossTime += dt;
        if (focusLossTime >= 1.7) {
            mode = 'dead';
            events.push({ type: 'cue', id: 'focus-game-over' });
        }
    }
    function waterExposureActive() {
        return bucket.age < RULES.waterExposure && Math.abs(p.x - cleaning.x) < 210 && p.y > F - 150;
    }
    function focusBlocked() {
        return paperPenaltyRemaining > 0 || lightPenaltyRemaining > 0 || waterExposureActive();
    }
    function focusStep(dt: number) {
        if (focusNotice && (focusNotice.life -= dt) <= 0) {
            focusNotice = null;
        }
        if (focusBlocked()) {
            focusClock = 0;
            return;
        }
        if (focus >= 100) {
            focusClock = 0;
            return;
        }
        focusClock += dt;
        if (focusClock >= 2 - 1e-9) {
            const amount = Math.floor((focusClock + 1e-9) / 2);
            focus = Math.min(100, focus + amount);
            focusClock = Math.max(0, focusClock - amount * 2);
        }
    }
    function step(dt: number) {
        if (mode !== 'play') {
            return;
        }
        history.push(snapshot());
        if (history.length > 60) {
            history.shift();
        }
        time += dt;
        t += dt;
        copier.cool = Math.max(0, copier.cool - dt);
        binCooldown = Math.max(0, binCooldown - dt);
        paperPenaltyRemaining = Math.max(0, paperPenaltyRemaining - dt);
        rollCooldown = Math.max(0, rollCooldown - dt);
        reverseCooldown = Math.max(0, reverseCooldown - dt);
        slipCooldown = Math.max(0, slipCooldown - dt);
        lightPenaltyRemaining = Math.max(0, lightPenaltyRemaining - dt);
        lightCooldown = Math.max(0, lightCooldown - dt);
        events.push({ type: 'tick', dt });
        if (Math.abs(p.x - copier.x) < 180 && copier.cool === 0 && copier.burst === 0) {
            copier.dir = p.x < copier.x ? -1 : 1;
            volley++;
            copier.burst = 3;
            copier.next = 0;
            copier.cool = 4.6;
        }
        if (copier.burst > 0) {
            copier.next -= dt;
            if (copier.next <= 0) {
                shoot();
                copier.burst--;
                copier.next = .19;
            }
        }
        particlesStep(dt);
        if (mode !== 'play') {
            return;
        }
        cleaningStep(dt);
        if (mode !== 'play') {
            return;
        }
        const was = ground;
        const dir = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
        const prev = p.x;
        coyote = ground ? .1 : Math.max(0, coyote - dt);
        jumpQ = Math.max(0, jumpQ - dt);
        slip = was && cleaning.spilled && p.x > cleaning.a && p.x < cleaning.a + Math.min(1, cleaning.age / .8) * (cleaning.b - cleaning.a) && p.y > F - 55;
        if (slip && !wetSeen) {
            wetSeen = true;
        }
        if (slip && slipCooldown === 0 && Math.abs(p.vx) > 65) {
            events.push({ type: 'cue', id: 'slipping' });
            slipCooldown = 7;
        }
        if (jumpQ > 0 && coyote > 0) {
            p.vy = -350;
            p.w -= dir * .12;
            ground = false;
            coyote = 0;
            jumpQ = 0;
        }
        const tilt = (keys.has('e') ? 1 : 0) - (keys.has('q') ? 1 : 0) + (was ? 0 : dir);
        p.w += tilt * (was ? 4.3 : 6.4) * dt;
        if (was && dir) {
            p.vx += dir * (slip ? 110 : 305) * dt;
        }
        else if (!was && dir) {
            p.vx += dir * 55 * dt;
        }
        if (keys.has('brake') && was) {
            p.vx *= Math.exp(-(slip ? .38 : 6) * dt);
            p.w *= Math.exp(-4 * dt);
        }
        p.vy += 800 * dt;
        p.vx *= Math.exp(-(was ? (slip ? .015 : .55) : .09) * dt);
        p.w *= Math.exp(-(was ? (slip ? .9 : 1.8) : .75) * dt);
        p.vx = clamp(p.vx, -315, 315);
        p.vy = clamp(p.vy, -500, 850);
        p.w = clamp(p.w, -5.8, 5.8);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.a += p.w * dt;
        if (binCooldown === 0 && p.x > bin.a + 25 && p.x < bin.b - 25 && p.y + 28 >= bin.rim && p.vy >= 0) {
            binEnter();
            return;
        }
        ground = false;
        let c = Math.cos(p.a);
        let sn = Math.sin(p.a);
        let head = parts[7];
        let hx = p.x - head.y * sn;
        let hy = p.y + head.y * c;
        for (const ob of solids) {
            const hit = contact(hx, hy, head.r, ob.p);
            if (hit && hit.ny < -.25 && hit.depth > .05) {
                fail({ x: hx, y: hy });
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
                    const hit = contact(p.x + rx, p.y + ry, part.r, ob.p);
                    if (!hit) {
                        continue;
                    }
                    if (part.head && hit.ny < -.25 && hit.depth > .05) {
                        fail({ x: p.x + rx, y: p.y + ry });
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
                        ground = true;
                    }
                }
            }
        }
        monitorStep(dt, prev);
        if (mode !== 'play') {
            return;
        }
        focusStep(dt);
        if (ground) {
            p.w -= Math.sin(p.a) * dt;
        }
        if (p.x < 40) {
            p.x = 40;
            p.vx = Math.max(0, p.vx);
        }
        if (ground && dir && Math.abs(p.vx) > 95 && rollCooldown === 0) {
            events.push({ type: 'cue', id: 'rolling' });
            rollCooldown = 9;
        }
        if (p.vx < -60 && reverseCooldown === 0) {
            const n = people.reduce((a, b) => Math.abs(a.x - p.x) < Math.abs(b.x - p.x) ? a : b);
            if (Math.abs(n.x - p.x) < 300) {
                events.push({ type: 'cue', id: 'reverse-comment', person: { ...n } });
                reverseCooldown = 7;
            }
        }
        for (const n of people) {
            if (!n.said && Math.min(Math.abs(p.x - n.x), Math.abs(prev - n.x)) < 100) {
                n.said = true;
                events.push({ type: 'cue', id: 'person-comment', person: { ...n } });
            }
        }
        if (slip && Math.abs(p.vx) > 90 && Math.floor(t * 30) !== Math.floor((t - dt) * 30)) {
            events.push({ type: 'speck', x: p.x - 15, vx: -p.vx * .2 });
        }
        if (p.y > F + 250) {
            binEnter();
            return;
        }
        if (p.x > GOAL) {
            mode = 'won';
            keys.clear();
            events.push({ type: 'cue', id: 'stage-clear' });
        }
    }
    function monitorPhase() {
        const phase = t % monitor.period;
        return { phase, warning: phase < .8, active: phase >= .8 && phase < 2.1, remaining: phase < .8 ? .8 - phase : phase < 2.1 ? 2.1 - phase : monitor.period - phase };
    }
    function monitorStep(_dt: number, previousX: number) {
        const m = monitorPhase();
        if (!m.active || p.y + 28 < 300) {
            return;
        }
        // A timed light curtain crosses the route; both travel directions use the same boundary.
        if (p.x + 35 > monitor.wall - 8 && p.x - 35 < monitor.wall + 22) {
            const side = previousX < monitor.wall ? -1 : 1;
            p.x = monitor.wall + side * 45;
            p.vx = side * 65;
            p.w *= .45;
            lightPenaltyRemaining = RULES.lightPenalty;
            events.push({ type: 'light-contact' });
            if (lightCooldown === 0) {
                lightHits++;
                lightCooldown = 1.4;
                focusHit('light', Math.floor(t / monitor.period));
                if (mode !== 'play') {
                    return;
                }
                events.push({ type: 'cue', id: 'light-hit' });
                events.push({ type: 'cue', id: 'light-comment' });
            }
        }
    }
    build();
    function getSnapshot() {
        // Detached data: even untyped renderers cannot mutate the live simulation.
        return structuredClone({
            game: 'office-stage-one', mode, focus, focusClock, focusLossTime, focusNotice, lossReason,
            player: p, ground, slip, dirty, inBin, binAge, time, deaths, bursts, paperHits, binFalls,
            dirtyWaterExperienced: wetSeen, cleaningSpilled: cleaning.spilled, soaked: soakedOnSpill > 0,
            bucketAge: bucket.age,
            paperPenaltyRemaining, lightPenaltyRemaining, cleaning, lightHits,
            monitor: { ...monitor, ...monitorPhase() }, papers, people, solids, copier, bin,
            focusBlocked: focusBlocked()
        });
    }
    function advance(dt: number) {
        if (!Number.isFinite(dt) || dt < 0) {
            return;
        }
        if (mode === 'play') {
            acc += dt;
            while (acc >= FIXED_STEP) {
                step(FIXED_STEP);
                acc -= FIXED_STEP;
                if (mode !== 'play') {
                    acc = 0;
                    break;
                }
            }
        }
        else {
            acc = 0;
            if (mode === 'impact') {
                impactStep(dt);
            }
            if (mode === 'focuslost') {
                advanceFocusLoss(dt);
            }
        }
    }
    return {
        reset, jump, pause, step, advance,
        restart() {
            if (mode === 'play') {
                deaths++;
            }
            reset();
        },
        advanceImpact: impactStep, advanceFocusLoss,
        setInput(...input: Input[]) {
            keys = new Set(input);
        },
        press(input: Input) {
            if (mode === 'play') {
                keys.add(input);
            }
        },
        release(input: Input) {
            keys.delete(input);
        },
        clearInput() {
            keys.clear();
        },
        getSnapshot: getSnapshot as () => DeepReadonly<ReturnType<typeof getSnapshot>>,
        drainEvents() {
            return events.splice(0);
        }
    };
}
export type Game = ReturnType<typeof createGame>;
export type GameState = ReturnType<Game['getSnapshot']>;
