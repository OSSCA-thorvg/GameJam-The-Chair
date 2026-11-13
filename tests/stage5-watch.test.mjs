import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createGame, createRenderCtx, drawOrbit, cctvLamp, ORBIT_WATCH, revealChairOrbit, revealGlideStart, revealTravel, STAGE_FOUR, attendanceBubble } = await loadSource(`
    export { createGame } from './src/game/game';
    export { createRenderCtx } from './src/render/context';
    export { drawOrbit } from './src/render/scene/orbit';
    export { cctvLamp, ORBIT_WATCH } from './src/render/scene/orbit-watch';
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

test('the glide waits until the camera is fully behind the chair', () => {
    const { settle } = STAGE_FOUR.reveal;
    const start = revealGlideStart(settle);
    assert.equal(revealChairOrbit(start, settle), 1);
    assert.ok(revealChairOrbit(start - .3, settle) < 1);
    assert.equal(revealTravel(start, settle, ORBIT_WATCH.glide), -ORBIT_WATCH.glide, 'no forward travel before the rear view');
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
const cruising = z => ({ phase: 'door', age: 10, z, speed: STAGE_FIVE.cruise, rings: 0, settled: 0 });

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
    const { orbit } = orbitStep(before, chairAt(0), [], 1 / 120);
    assert.equal(orbit.speed, STAGE_FIVE.cruise);
});
