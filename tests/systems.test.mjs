import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

// Unit tests for pure system decisions: same input, same answer, no state writes.
const bundle = await build({
    stdin: { contents: `export * from './src/game/systems/geyser'; export * from './src/game/systems/monitor'; export * from './src/game/systems/bin'; export * from './src/game/systems/cleaning'; export * from './src/game/systems/papers'; export * from './src/game/systems/rooftop'; export * from './src/game/systems/sky'; export * from './src/game/systems/focus';`, resolveDir: process.cwd() },
    bundle: true, write: false, platform: 'node', format: 'esm',
});
const sys = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
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

test('three quick downward sprays on the launch pad start the flight', () => {
    const pad = { x: 2300, y: -172, vx: 40, vy: 0, a: 0, w: 1 };
    let flight = { kind: 'course', verticalShots: 0, lastShotAt: -1 };
    const times = [10, 10.3, 10.6];
    let r;
    for (const time of times) { r = sys.launchShot(flight, pad, time, 0); flight = r.firstFlight; }
    assert.equal(r.takeoff, true);
    assert.deepEqual([r.p.vx, r.p.vy, r.p.w], [0, -320, 0]);
    assert.equal(sys.launchShot({ kind: 'course', verticalShots: 2, lastShotAt: 10 }, pad, 11, 0).firstFlight.verticalShots, 1, 'too slow restarts the count');
    assert.equal(sys.launchShot({ kind: 'course', verticalShots: 2, lastShotAt: 10 }, pad, 10.2, 1).firstFlight.verticalShots, 0, 'sideways spray resets');
    const climb = sys.flightStep({ kind: 'flight', age: 0 }, { ...pad, y: -1819, vy: -300 }, 1 / 120);
    assert.equal(climb.arrived, true);
});

test('the duct sneezes back at a rider in front of it once the inhale ends', () => {
    const p = { x: 1600, y: 226, vx: 0, vy: 0, a: 0, w: 0 };
    const reacting = sys.ductSprayed({ kind: 'idle' }, p);
    assert.equal(reacting.kind, 'reacting');
    assert.equal(sys.ductSprayed({ kind: 'idle' }, { ...p, x: 1000 }).kind, 'idle', 'out of reach');
    let input = { p, ground: true, hasExtinguisher: true, firstFlight: { kind: 'course', verticalShots: 0, lastShotAt: -1 }, ductReaction: reacting, time: 0 };
    let knocked = false;
    for (let i = 0; i < 30; i++) {
        const r = sys.rooftopStep(input, 1 / 120);
        knocked ||= r.p.vx < 0 && !r.ground;
        input = { ...input, p: r.p, ground: r.ground, ductReaction: r.ductReaction };
    }
    assert.ok(knocked);
    assert.equal(reacting.bursts[0].age, 0, 'input untouched');
});

test('the sky drifts with input, stays inside the stage and hovers', () => {
    const p = { x: 2380, y: -1820, vx: 0, vy: 0, a: 0, w: 0 };
    const right = sky(p, 1, 600);
    assert.ok(right.p.x > p.x && right.p.a > 0 && right.sprayDir.x < 0);
    assert.ok(sky({ ...p, x: 3330 }, 1, 600).p.x <= 3320, 'clamped to the stage');
    assert.equal(sky(p, 0, 1).speed, 0);
    function sky(start, direction, ticks) {
        let r = { p: start };
        for (let i = 0; i < ticks; i++) r = sys.skyStep(r.p, direction, i / 120, 3400, 1 / 120);
        return r;
    }
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
    const blocked = { paperPenaltyRemaining: 0, lightPenaltyRemaining: 0, bucket: { age: 5 }, p: { x: 0, y: 0 }, cleaning: { x: 1095 } };
    assert.equal(sys.focusBlocked(blocked), false);
    assert.equal(sys.focusBlocked({ ...blocked, lightPenaltyRemaining: .1 }), true);
});
