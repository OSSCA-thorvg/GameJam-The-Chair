import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { FIVE, createGame, createRenderCtx, drawOrbit, cctvLamp, ORBIT_WATCH, orbitWatchers, createSkyProjection, revealChairOrbit, revealGlideStart, revealTravel, STAGE_FOUR, attendanceBubble } = await loadSource(`
    export { createGame } from './src/game/game';
    export { STAGE_FIVE as FIVE } from './src/game/stages/orbit/data';
    export { createRenderCtx } from './src/render/context';
    export { drawOrbit } from './src/render/scene/orbit';
    export { cctvLamp, ORBIT_WATCH, orbitWatchers } from './src/render/scene/orbit-watch';
    export { createSkyProjection } from './src/render/scene/sky-projection';
    export { revealChairOrbit, revealGlideStart, revealTravel } from './src/render/scene/sky-camera';
    export { STAGE_FOUR } from './src/game/stages/sky/data';
    export { attendanceBubble } from './src/render/scene/attendance-bubble';
`);

/** The words drawn as ThorVG Text in a frame. */
const words = commands => commands.filter(command => command.text).map(command => command.text.content);

function orbitFrame(z, t, age = 10) {
    const game = createGame();
    game.startStage(5);
    const state = structuredClone(game.getSnapshot());
    Object.assign(state.orbit, { z, age });
    const ctx = createRenderCtx({});
    Object.assign(ctx, { state, p: state.player, mode: 'play', locale: 'en', W: 1000, H: 510, t });
    drawOrbit(ctx);
    return ctx.commands;
}
const beats = Array.from({ length: 12 }, (_, i) => i / 24);
const glows = z => beats.map(t => orbitFrame(z, t).filter(command => command.layer?.key === 'orbit-cctv-light').length);

test('a camera lamp is a dim dot ahead, blinks while the chair passes, then stays lit', () => {
    assert.ok(beats.every(t => cctvLamp(ORBIT_WATCH.before + 1, t) === 'idle'));
    const passing = beats.map(t => cctvLamp(100, t));
    assert.ok(passing.includes('flash') && passing.includes('idle'), 'blinks while passing');
    assert.ok(beats.every(t => cctvLamp(-ORBIT_WATCH.after - 1, t) === 'recorded'), 'stays lit once passed');
});

test('stage five glows red only at the cameras the chair has reached', () => {
    assert.ok(glows(0).every(count => count === 0), 'no camera is near the start');
    const first = Math.min(...ORBIT_WATCH.route.map(spot => spot.z));
    assert.ok(glows(first - 100).some(count => count > 0));
});

test('every camera ahead keeps blinking its red REC lamp, out of step with the others', () => {
    const rec = beats.map(t => orbitFrame(0, t).filter(command => command.layer?.key === 'orbit-cctv-rec').length);
    assert.ok(rec.every(count => count > 0), 'some lamp is always lit');
    assert.ok(new Set(rec).size > 1, 'lamps blink');
});

test('the reveal glides forward to exactly where stage five starts', () => {
    const { settle, turn, hold } = STAGE_FOUR.reveal;
    assert.equal(revealTravel(settle, settle, ORBIT_WATCH.glide), -ORBIT_WATCH.glide, 'still at the far end while turning');
    assert.equal(revealTravel(settle + turn + hold, settle, ORBIT_WATCH.glide), 0);
    assert.ok(ORBIT_WATCH.reveal.every(spot => spot.z + ORBIT_WATCH.glide > ORBIT_WATCH.before),
        'every reveal camera waits unlit until the glide');
    // The projection camera sits 480 behind the chair, so a camera this far back is out of view at stage five's start.
    assert.ok(ORBIT_WATCH.reveal.every(spot => spot.z + 480 < 30), 'every reveal camera is behind the view before stage five');
});

test('the cameras get time to sink in before the glide, which arrives at stage five already at cruise speed', () => {
    const { settle, turn, hold } = STAGE_FOUR.reveal;
    const start = revealGlideStart(settle), end = settle + turn + hold;
    // When the camera turn has brought a watcher of the given `appear` into view.
    const seen = appear => {
        for (let at = settle; at <= settle + turn; at += 1 / 120) if (revealChairOrbit(at, settle) >= appear) return at;
        return Infinity;
    };
    const appears = ORBIT_WATCH.reveal.map(spot => spot.appear);
    const first = seen(Math.min(...appears)), last = seen(Math.max(...appears));
    assert.ok(last - first >= 3.5, `the cameras turn up one by one over ${(last - first).toFixed(1)} s`);
    assert.ok(start - last >= 1.5, `every camera is in view for ${(start - last).toFixed(1)} s before the glide`);
    assert.equal(revealTravel(start, settle, ORBIT_WATCH.glide), -ORBIT_WATCH.glide, 'no forward travel before the glide');
    const step = 1 / 120;
    let previous = -Infinity;
    for (let at = start; at <= end; at += step) {
        const travel = revealTravel(at, settle, ORBIT_WATCH.glide);
        assert.ok(travel >= previous, `the glide only moves forward (${at.toFixed(2)} s)`);
        previous = travel;
    }
    const speed = (revealTravel(end, settle, ORBIT_WATCH.glide) - revealTravel(end - step, settle, ORBIT_WATCH.glide)) / step;
    assert.ok(Math.abs(speed - FIVE.cruise) < 2, `hand-off speed ${speed.toFixed(1)} matches stage five's cruise`);
    const game = createGame();
    game.startStage(5);
    assert.equal(game.getSnapshot().orbit.speed, FIVE.cruise, 'stage five starts at the same cruise speed');
});

test('the cameras come in several models and sizes, spread to every corner of the rear view', () => {
    const kinds = new Set(ORBIT_WATCH.reveal.map(spot => spot.kind));
    assert.ok(kinds.size >= 4, `models: ${[...kinds]}`);
    const sides = ORBIT_WATCH.reveal.map(spot => [Math.sign(spot.x), Math.sign(spot.y)].join());
    for (const corner of ['-1,1', '1,1', '-1,-1', '1,-1']) assert.ok(sides.includes(corner), `a camera toward ${corner}`);
    assert.ok(new Set(ORBIT_WATCH.reveal.map(spot => spot.size.toFixed(1))).size > 5, 'sizes vary');
});

test('the attendance bubble says its line in both languages', () => {
    for (const [locale, line] of [['en', 'Attendance confirmed.'], ['ko', '근태 확인됨.']]) {
        const ctx = createRenderCtx({});
        Object.assign(ctx, { locale, W: 1000, H: 510 });
        attendanceBubble(ctx, [500, 200], 2);
        assert.deepEqual(words(ctx.commands), [line]);
    }
});

test('the far speck above the door twinkles from the first frame of stage five', () => {
    const specks = beats.map(t => orbitFrame(0, t * 8).find(command => command.layer?.key === 'orbit-beacon'));
    assert.ok(specks.every(Boolean));
    const radii = specks.map(command => command.c.radius);
    assert.ok(Math.max(...radii) - Math.min(...radii) > 3, 'its glow grows and shrinks');
});

test('there are no billboards, and lenses and lamps glint out of the clouds in stage five', () => {
    assert.equal(ORBIT_WATCH.billboards, undefined);
    const glints = beats.map(t => orbitFrame(0, t * 6).filter(command => command.layer?.key === 'orbit-cloud-glint').length);
    assert.ok(glints.some(count => count > 0) && new Set(glints).size > 1, 'they blink on and off');
    assert.ok(ORBIT_WATCH.glints.some(glint => glint.red) && ORBIT_WATCH.glints.some(glint => !glint.red), 'both white and red');
});

const { orbitStep, inPraise, praiseBeamX, praiseSheltered, STAGE_FIVE } = await loadSource(`
    export { orbitStep, inPraise, praiseBeamX, praiseSheltered } from './src/game/stages/orbit/course/decide';
    export { STAGE_FIVE } from './src/game/stages/orbit/data';
`);

const chairAt = (x, y = 0) => ({ x, y, vx: 0, vy: 0, a: 0, w: 0 });
const cruising = z => ({ phase: 'door', age: 10, z, speed: STAGE_FIVE.cruise, heading: 0, yaw: 0, rings: 0, idle: 0, settled: 0 });

test('5-1: the praise beam slows the chair and shoves it out of the beam', () => {
    const first = STAGE_FIVE.praise.beams[0];
    // A moment when the beam is well clear of the shelter cloud at this depth.
    const age = Array.from({ length: 400 }, (_, i) => i / 10).find(t => Math.abs(praiseBeamX(first, t) + 150) < 30);
    const x = praiseBeamX(first, age) + 40, z = (first.from + first.to) / 2;
    assert.ok(STAGE_FIVE.praise.shelters.every(s => Math.abs(s.z - z) > STAGE_FIVE.praise.shelterSize.z || Math.abs(s.x - x) > STAGE_FIVE.praise.shelterSize.x));
    assert.ok(inPraise(age, chairAt(x), z));
    let orbit = { ...cruising(z), age }, p = chairAt(x);
    for (let i = 0; i < 120; i++) ({ orbit, p } = orbitStep(orbit, p, [], 1 / 120));
    assert.ok(orbit.speed < STAGE_FIVE.cruise * .7, `slowed to ${orbit.speed}`);
    assert.ok(p.x > x, 'pushed away from the beam centre');
});

test('5-1: a shelter cloud hides the chair, and outside the beam nothing happens', () => {
    const shelter = STAGE_FIVE.praise.shelters[1];
    const first = STAGE_FIVE.praise.beams[0];
    const age = Array.from({ length: 400 }, (_, i) => i / 10).find(t => Math.abs(praiseBeamX(first, t) - shelter.x) < 20);
    assert.ok(age !== undefined);
    assert.ok(praiseSheltered(chairAt(shelter.x, shelter.y), shelter.z));
    assert.equal(inPraise(age, chairAt(shelter.x, shelter.y), shelter.z), false, 'hidden while the beam is right on it');
    assert.equal(inPraise(age, chairAt(shelter.x), first.from - 10), false, 'no beam before the 5-1 stretch');
    const before = cruising(first.from - 400);
    // Outside a beam only the extinguisher and the coast change the speed.
    const pushed = orbitStep(before, chairAt(0), ['spray'], 1 / 120).orbit.speed;
    const coasting = orbitStep(before, chairAt(0), [], 1 / 120).orbit.speed;
    assert.ok(Math.abs(pushed - (STAGE_FIVE.cruise + STAGE_FIVE.thrust / 120)) < 1e-9);
    assert.ok(Math.abs(coasting - STAGE_FIVE.cruise * Math.exp(-STAGE_FIVE.coast / 120)) < 1e-6);
});

test('nothing the chair has flown past is drawn between it and the camera', () => {
    const view = createSkyProjection(1000, 510, 1, { distance: 690 });
    const watchers = travel => orbitWatchers(view, (x, y, z) => [z - travel, 15 + y, x], travel, 0, 1);
    const satellite = FIVE.praise.beams[4].satellite;
    assert.equal(watchers(satellite.z - 5).length - watchers(satellite.z + 5).length, 1, 'a satellite is gone once the chair passes under it');
    const route = ORBIT_WATCH.route[3];
    const lensAt = travel => watchers(travel).filter(lamp => Math.abs(lamp.at[0] - (route.z - travel)) < 60)
        .map(lamp => Math.hypot(lamp.at[1] - 15, lamp.at[2]));
    // A camera the chair is about to pass swerves out of the way first.
    assert.ok(Math.min(...lensAt(route.z - 20)) > Math.min(...lensAt(route.z - 400)) + 400, 'swerves aside before the chair reaches it');
    assert.equal(lensAt(route.z + 20).length, 0, 'and is gone after');
});
