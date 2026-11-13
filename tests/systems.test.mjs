import assert from 'node:assert/strict';
import test from 'node:test';
import { bundled } from './support/load.mjs';

// Unit tests for pure system decisions: same input, same answer, no state writes.
const sys = await bundled({
    stdin: { contents: `export * from './src/game/stages/office/geyser/decide'; export * from './src/game/stages/office/monitor/decide'; export * from './src/game/stages/office/bin/decide'; export { fellOffFloor } from './src/game/physics'; export * from './src/game/stages/office/cleaning/decide'; export * from './src/game/stages/office/copier/decide'; export * from './src/game/stages/rooftop/course/decide'; export * from './src/game/stages/sky/course/decide'; export * from './src/game/systems/focus/decide'; export * from './src/game/systems/impact/decide'; export * from './src/game/stages/building/corridor/decide';`, resolveDir: process.cwd() },
    bundle: true, write: false, platform: 'node', format: 'esm',
});
const F = 420;

test('geyser launches only during a burst, near the vent and low enough', () => {
    const burstAt = 3.2; // geyser 0: period 3.5, offset 0, burst from 3.1
    assert.equal(sys.geyserHits({ x: 2600, y: F - 28 }, 1, 7).length, 0, 'resting');
    assert.equal(sys.geyserHits({ x: 2700, y: F - 28 }, burstAt, 7).length, 0, 'too far');
    assert.equal(sys.geyserHits({ x: 2600, y: F - 200 }, burstAt, 7).length, 0, 'too high');
    const [hit] = sys.geyserHits({ x: 2590, y: F - 28 }, burstAt, 7);
    assert.equal(hit.push, -90, 'pushes away from the vent');
    assert.ok(Math.abs(hit.spin) <= 3);
    assert.notEqual(hit.rng, 7, 'spin consumes the physics stream');
    assert.deepEqual(sys.geyserHits({ x: 2590, y: F - 28 }, burstAt, 7), [hit], 'deterministic');
    assert.deepEqual(hit.focus, { kind: 'paper', id: 1000, damage: 30 });
});

test('a lit monitor pushes the chair back the way it came', () => {
    const lit = 1; // monitor 0: active from .8 to 2.1
    assert.equal(sys.monitorContact({ x: 2110, y: 392 }, 2100, .2), null, 'warning only');
    assert.equal(sys.monitorContact({ x: 2110, y: 200 }, 2100, lit), null, 'above the screens');
    assert.deepEqual(sys.monitorContact({ x: 2110, y: 392 }, 2100, lit), { index: 0, x: 2065, vx: -65, focus: { kind: 'light', id: 0, damage: 30 } });
    assert.equal(sys.monitorContact({ x: 2110, y: 392 }, 2120, lit).vx, 65, 'from the right');
});

test('the office bin catches a falling chair over its opening only', () => {
    const over = { x: 1660, y: 380, vx: 0, vy: 50, a: 0, w: 0 };
    assert.equal(sys.fallsIntoBin(over, 0), true);
    assert.equal(sys.fallsIntoBin({ ...over, vy: -10 }, 0), false, 'rising');
    assert.equal(sys.fallsIntoBin(over, .5), false, 'cooling down');
    assert.equal(sys.fallsIntoBin({ ...over, x: 1590 }, 0), false, 'on the rim');
    assert.equal(sys.fellOffFloor({ x: 0, y: 671 }), true);
    assert.equal(sys.fellOffFloor({ x: 0, y: 670 }), false);
    assert.throws(() => { sys.BIN_REST.x = 0; });
});

test('the bucket tips once when approached, splashes nearby riders and must refill', () => {
    const cleaning = { x: 1095, a: 1035, b: 1360, spilled: false, age: 0, followup: false, splashDir: 0 };
    const bucket = { age: 2.2, armed: true, spills: 0 };
    const input = { p: { x: 1000, y: 392 }, cleaning, bucket, soakedOnSpill: 0 };
    const first = sys.cleaningStep(input, 1 / 120);
    assert.equal(first.splash, true);
    assert.equal(first.cleaning.splashDir, -1);
    assert.deepEqual(first.soak, { kind: 'water', id: 1, damage: 30 });
    assert.equal(cleaning.spilled, false, 'input untouched');
    const again = sys.cleaningStep({ ...input, cleaning: first.cleaning, bucket: first.bucket, soakedOnSpill: 1 }, 1 / 120);
    assert.equal(again.splash, false, 'not refilled yet');
    assert.equal(again.soak, null, 'one soak per spill');
    const far = sys.cleaningStep({ ...input, p: { x: 600, y: 392 } }, 1 / 120);
    assert.equal(far.splash, false);
});

test('the copier aims, waits, then fires a four-sheet burst; the first shot is harmless', () => {
    const copier = { x: 750, cool: 0, burst: 0, next: 0, dir: -1 };
    assert.equal(sys.copierStep(copier, 0, 200, true, 1 / 120).volley, 0, 'too far to notice');
    assert.equal(sys.copierStep(copier, 0, 500, false, 1 / 120).volley, 0, 'only in the office');
    let state = { copier, volley: 0 };
    let shots = 0;
    for (let i = 0; i < 200; i++) {
        const r = sys.copierStep(state.copier, state.volley, 500, true, 1 / 120);
        state = r;
        if (r.fire) shots++;
    }
    assert.equal(state.volley, 1);
    assert.equal(state.copier.dir, -1);
    assert.equal(shots, 4);
    const first = sys.paperShot(state.copier, 1, 0);
    assert.equal(first.length, 4);
    assert.ok(first.every(paper => paper.safe && paper.vx < 0));
    assert.ok(sys.paperShot(state.copier, 1, 1).every(paper => !paper.safe));
});

test('sheets that reach the rider are reported once, in order, without touching the input', () => {
    const paper = { x: 500, y: 342, vx: 0, vy: 0, a: 0, w: 0, life: 5, hit: false, landed: false, volley: 2, safe: false };
    const papers = [paper, { ...paper, volley: 3 }, { ...paper, safe: true }];
    const r = sys.papersStep(papers, { x: 500, y: 392 }, false, 1 / 120);
    assert.deepEqual(r.hits.map(hit => [hit.index, hit.focus.id]), [[0, 2], [1, 3]]);
    assert.equal(paper.hit, false);
    assert.equal(sys.papersStep(r.papers, { x: 500, y: 392 }, false, 1 / 120).hits.length, 0);
    assert.equal(sys.papersStep(papers, { x: 500, y: 392 }, true, 1 / 120).hits.length, 0, 'safe inside the bin');
    assert.equal(sys.trimPapers([{ ...paper, life: -1 }, paper]).length, 1);
});

test('rooftop door scene rolls the chair out and hands over control when closed', () => {
    const mid = sys.entranceStep({ kind: 'opening', age: 1 }, 1 / 120);
    assert.equal(mid.done, false);
    assert.ok(mid.pose.vx > 0 && mid.pose.x > 100 && mid.pose.x < 235);
    const end = sys.entranceStep({ kind: 'opening', age: 2.6 }, 1 / 120);
    assert.deepEqual([end.done, end.entrance.kind, end.pose.x, end.pose.vx], [true, 'ready', 235, 0]);
});

test('a chair falling onto the slumping sales graph rides it up and climbs to the sky', () => {
    const base = { p: { x: 2500, y: -188, vx: 200, vy: 0, a: 0, w: 0 }, ground: false, hasExtinguisher: true, firstFlight: { kind: 'course' }, ductReaction: { kind: 'idle', rest: 0 }, time: 0 };
    const caught = sys.rooftopStep(base, 1 / 120).firstFlight;
    assert.equal(caught.kind, 'ride');
    assert.equal(sys.rooftopStep({ ...base, p: { ...base.p, y: -280 } }, 1 / 120).firstFlight.kind, 'course', 'too high above the line');
    assert.equal(sys.rooftopStep({ ...base, p: { ...base.p, vx: -100, vy: -50 } }, 1 / 120).firstFlight.kind, 'course', 'rising away from the line does not board');
    assert.equal(sys.rooftopStep({ ...base, hasExtinguisher: false }, 1 / 120).firstFlight.kind, 'course');
    let flight = caught, p = base.p, top = Infinity, right = 0;
    for (let i = 0; i < 120 * 10 && flight.kind === 'ride'; i++) {
        const r = sys.graphRideStep(flight, p, 1 / 120);
        assert.ok(Math.hypot(r.p.x - p.x, r.p.y - p.y) < 20, 'the ride moves on smoothly');
        flight = r.flight; p = r.p; top = Math.min(top, p.y); right = Math.max(right, p.x);
    }
    assert.equal(flight.kind, 'flight');
    assert.ok(top < -900 && p.vy <= -320 && right > 2850, 'the line carries the chair up and to the right');
    const climb = sys.flightStep({ kind: 'flight', age: 0 }, { ...p, y: -1819, vy: -300 }, 1 / 120);
    assert.equal(climb.arrived, true);
});

test('the duct sneezes on its timer at a rider in front of it once the inhale ends', () => {
    const p = { x: 1600, y: 226, vx: 0, vy: 0, a: 0, w: 0 };
    const reacting = sys.rooftopStep({ p, ground: true, hasExtinguisher: true, firstFlight: { kind: 'course' }, ductReaction: { kind: 'idle', rest: 5.999 }, time: 0 }, 1 / 120).ductReaction;
    assert.equal(reacting.kind, 'reacting');
    const age = reacting.bursts[0].age;
    assert.equal(sys.rooftopStep({ p, ground: true, hasExtinguisher: true, firstFlight: { kind: 'course' }, ductReaction: { kind: 'idle', rest: 1 }, time: 0 }, 1 / 120).ductReaction.kind, 'idle', 'not yet time');
    let input = { p, ground: true, hasExtinguisher: true, firstFlight: { kind: 'course' }, ductReaction: reacting, time: 0 };
    let knocked = false;
    for (let i = 0; i < 30; i++) {
        const r = sys.rooftopStep(input, 1 / 120);
        knocked ||= r.p.vx < 0 && !r.ground;
        input = { ...input, p: r.p, ground: r.ground, ductReaction: r.ductReaction };
    }
    assert.ok(knocked);
    assert.equal(reacting.bursts[0].age, age, 'input untouched');
});

test('the sky hovers in and lands on the arrival roof without touching its input', () => {
    const sky = { phase: 'arrival', age: 0, lift: 0, drawer: 0, deskTilt: 0, signTilt: -1.28, standing: null, depth: 0, depthTravel: 0, airSprays: 0, knock: 0, knockKind: null };
    const base = { sky, p: { x: 2380, y: -1820, vx: 0, vy: 0, a: 0, w: 0 }, ground: false, coyote: 0, jumpQ: 0, checkpoint: 0, time: 0, direction: 1, length: 6100, sprayBurst: 0, sprayDir: { x: 0, y: 1 } };
    let r = sys.skyStep(base, 1 / 120);
    assert.ok(r.p.x > 2380 && r.sprayBurst === .24 && r.speed > 0);
    assert.equal(sky.age, 0, 'input untouched');
    let input = base;
    let landed = false;
    for (let i = 0; i < 120 * 8 && !landed; i++) {
        r = sys.skyStep({ ...input, time: i / 120 }, 1 / 120);
        landed = r.ground && r.sky.standing === 'arrival-roof';
        input = { ...input, sky: r.sky, p: r.p, ground: r.ground, coyote: r.coyote, jumpQ: r.jumpQ, checkpoint: r.checkpoint };
    }
    assert.ok(landed, 'the chair settles on the arrival roof');
    assert.equal(r.checkpoint, 0, 'the only flag waits halfway along the course');
    const depth = sys.skyStep({ ...base, sky: { ...sky, phase: 'depth', age: 4 } }, 1 / 120);
    assert.equal(depth.won, true);
    assert.equal(depth.speed, 0);
});

test('each distraction costs focus once, and focus recovers only when undisturbed', () => {
    const fresh = { focus: 100, focusClock: 1, focusEvents: [], focusNotice: null };
    const hit = sys.focusAfterHit(fresh, { kind: 'paper', id: 2, damage: 30 });
    assert.deepEqual(hit, { focus: 70, focusClock: 0, focusEvents: ['paper:2'], focusNotice: { kind: 'paper', life: 1.7 }, lost: false });
    assert.equal(sys.focusAfterHit(hit, { kind: 'paper', id: 2, damage: 30 }), null, 'same volley again');
    assert.equal(sys.focusAfterHit({ ...hit, focus: 20 }, { kind: 'light', id: 0, damage: 30 }).lost, true);
    assert.equal(sys.focusRecovery({ ...hit, focusClock: 1.999 }, false, .01).focus, 71);
    assert.deepEqual(sys.focusRecovery({ ...hit, focusClock: 1.999 }, true, .01).focus, 70, 'blocked');
    assert.equal(sys.focusRecovery({ ...hit, focusNotice: { kind: 'paper', life: .005 } }, false, .01).focusNotice, null);
    assert.deepEqual(sys.focusLossStep(1.69, .01).over, true);
});

test('a head hit replays the last frames in slow motion, then holds', () => {
    const history = Array.from({ length: 60 }, (_, i) => ({ p: { x: i, y: 0, vx: 0, vy: 0, a: 0, w: 0 } }));
    const impact = sys.impactReplay(history, { x: 60, y: 0, vx: 0, vy: 0, a: 0, w: 0 }, { x: 60, y: -77 });
    assert.equal(impact.frames.length, 43);
    assert.equal(impact.frames[0].p.x, 18);
    const half = sys.impactStep(impact, 21 / 120 / .25);
    assert.equal(half.pose.x, 39);
    assert.equal(half.done, false);
    assert.equal(sys.impactStep(impact, 42 / 120 / .25 + .36).done, true);
    assert.equal(impact.elapsed, 0, 'input untouched');
});

test('corridor decisions: convoy landing, lift ride, meeting and chatter use their own copies', () => {
    const chairs = [0, 1, 2].map(i => ({ kind: 'chair', x: 1000 - i * 130, y: 420, width: 48, height: 40, vx: 185, released: true, cheer: 0 }));
    const corridor = { convoy: 'airborne', departure: { kind: 'none' } };
    assert.deepEqual(sys.convoyLanding(corridor, chairs, { x: 870, y: 392 }, true), { convoy: 'carried', vx: 185 });
    assert.deepEqual(sys.convoyLanding(corridor, chairs, { x: 500, y: 392 }, true), { convoy: 'free', vx: null });
    assert.equal(sys.convoyLanding(corridor, chairs, { x: 870, y: 392 }, false), null, 'still in the air');

    assert.equal(sys.liftRide({ kind: 'descending', age: 0, reason: 'companions' }, .1), null, 'only a captive rider rides down');
    const down = sys.liftRide({ kind: 'descending', age: 1.95, reason: 'abduction' }, .1);
    assert.deepEqual([down.lost, down.departure.kind, down.y], [true, 'lost', 557]);

    const meeting = sys.meetingStep({ kind: 'meeting', age: 5.99, returnX: 700 }, .02);
    assert.equal(meeting.leave, true);
    assert.deepEqual(sys.meetingExit(700, true), { x: 810, y: 392, vx: 180, vy: 0, a: 0, w: 0 });

    const base = {
        appearanceSeed: 1, room: { kind: 'corridor' }, meetingVisited: false, dispatchAge: 0, dispatchStarted: false,
        chat: { kind: 'waiting' }, convoy: 'free', pace: 'casual', departure: { kind: 'none' }, lift: { kind: 'waiting' },
        typingCooldown: 0, offices: [{ x: 220, life: 0, cooldown: 0, nearby: false, phrase: 0, offset: { x: 0, y: 0 } }],
    };
    const input = { corridor: base, furniture: chairs.map(chair => ({ ...chair, released: false })), p: { x: 230, y: 392, vx: 0, vy: 0, a: 0, w: 0 }, ground: true, steering: false, rng: 5, length: 4000 };
    const r = sys.corridorStep(input, 1 / 120, 230);
    assert.ok(r.corridor.offices[0].life > 0, 'a nearby office starts typing');
    assert.notEqual(r.rng, 5, 'bubble placement uses the cosmetic stream');
    assert.deepEqual(sys.corridorStep(input, 1 / 120, 230), r, 'deterministic');
    assert.equal(base.offices[0].life, 0, 'input untouched');
});

test('the executive printer scans before every urgent volley and follows a fixed pattern order', () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(sys.urgentPattern), ['low', 'lob', 'fan', 'bundle', 'fan', 'bundle', 'fan']);
    let c = sys.createUrgentCopier();
    const dt = 1 / 120;
    assert.equal(sys.urgentCopierStep(c, c.x - 600, dt).copier.volley, 0, 'asleep while the chair is far away');
    let r = sys.urgentCopierStep(c, c.x - 300, dt);
    assert.equal(r.started, true);
    assert.equal(r.copier.dir, -1, 'faces the approaching chair');
    c = r.copier;
    let firstShot = null;
    for (let i = 1; i < 240 && firstShot === null; i++) {
        r = sys.urgentCopierStep(c, c.x - 300, dt);
        c = r.copier;
        if (r.fire) firstShot = i * dt;
    }
    assert.ok(firstShot >= .6 - dt && firstShot < .62, `the scan warns for 0.6 s (fired at ${firstShot})`);
});

test('urgent sheets: skimming ones need a jump, a stapled bundle shoves the chair back', () => {
    const F = 420, dt = 1 / 120;
    const flyAt = (papers, chair) => {
        let list = papers, hits = [];
        for (let i = 0; i < 240 && !hits.length; i++) ({ papers: list, hits } = sys.papersStep(list, chair(i * dt), false, dt));
        return hits;
    };
    const copier = { ...sys.createUrgentCopier(), dir: -1, volley: 1, burst: 1 };
    const low = sys.urgentShot(copier);
    const standing = () => ({ x: copier.x - 180, y: F - 28 });
    const jumping = () => ({ x: copier.x - 180, y: F - 28 - 76 });
    assert.ok(flyAt(low, standing).length > 0, 'skimming sheets hit a chair on the floor');
    assert.equal(flyAt(sys.urgentShot(copier), jumping).length, 0, 'a jump clears them');
    const bundle = sys.urgentShot({ ...copier, volley: 4, burst: 3 });
    assert.equal(bundle.length, 1, 'the bundle flies alone, its loose pages follow in the next shot');
    assert.equal(bundle[0].kind, 'bundle');
    const hit = flyAt(bundle, standing)[0];
    assert.ok(hit.heavy && hit.focus.damage === 20 && hit.vx < 0, 'a bundle costs eight sheets\' worth');
    assert.ok(hit.focus.id > 1000, 'urgent volleys count apart from the office copier');
});

test('every urgent volley is 20 sheets\' worth, and each sheet that hits costs focus on its own', () => {
    for (let volley = 1; volley <= 4; volley++) {
        const shots = { 1: 5, 2: 4, 3: 5, 4: 4 }[volley];
        const papers = [];
        for (let burst = shots - 1; burst >= 0; burst--) papers.push(...sys.urgentShot({ ...sys.createUrgentCopier(), volley, burst }));
        const worth = papers.reduce((sum, z) => sum + (z.kind === 'bundle' ? 8 : 1), 0);
        assert.equal(worth, 20, `volley ${volley}`);
        assert.equal(new Set(papers.map(z => z.volley)).size, papers.length, 'each sheet has its own focus id');
    }
    const focus = { focus: 100, focusClock: 0, focusEvents: [], focusNotice: null };
    let f = focus;
    const sheets = [];
    for (let burst = 4; burst >= 0; burst--) sheets.push(...sys.urgentShot({ ...sys.createUrgentCopier(), volley: 1, burst }));
    for (const z of sheets) f = { ...f, ...sys.focusAfterHit(f, { kind: 'paper', id: z.volley, damage: 2.5 }) };
    assert.equal(f.focus, 50, 'a whole volley takes half the focus bar');
});
