import assert from 'node:assert/strict';
import test from 'node:test';
import { driveStageFour, STAGE_FOUR_ROUTE } from './support/stage4-route.mjs';
import { bundled } from './support/load.mjs';
const { createGame, skyPlatforms, skySurface, skyGust, skyHazards, skyStep, createSky, STAGE_FOUR } = await bundled({ stdin: { contents: `export { createGame } from './src/game/game'; export { skyPlatforms, skySurface, skyGust, skyHazards, createSky, STAGE_FOUR } from './src/game/stages/sky/data'; export { skyStep } from './src/game/stages/sky/course/decide';`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });

test('stage 4 traverses growing building, gust sign, rocking desks and depth reveal without falling', () => {
    const game = createGame(); game.startStage(4);
    const landings = new Set(), flags = new Set(), phases = new Set();
    let lift = 0, drawer = 0, tiltedDesk = false, sign = false;
    const end = driveStageFour(game, state => {
        flags.add(state.checkpoint); phases.add(state.sky.phase);
        assert.ok(state.sky.airSprays <= STAGE_FOUR.airSprayLimit);
        if (state.ground) landings.add(state.sky.standing);
        lift = Math.max(lift, state.sky.lift); drawer = Math.max(drawer, state.sky.drawer);
        tiltedDesk ||= Math.abs(state.sky.deskTilt) > .001;
        if (state.sky.standing === 'wind-sign' && state.ground) {
            sign = true;
            const surface = skySurface(skyPlatforms(state.sky, state.time).find(p => p.id === 'wind-sign'), state.player.x);
            assert.ok(Math.abs(state.player.y + 28 - surface) < .01, 'chair rests on the moving sign face');
        }
    });
    assert.equal(end.stage, 5);
    assert.equal(end.mode, 'play');
    assert.equal(end.completedStage, 4); assert.equal(end.deaths, 0);
    assert.deepEqual([...flags], [0, 1]);
    assert.deepEqual([...phases], ['arrival', 'course', 'reveal', 'depth']);
    for (const id of STAGE_FOUR_ROUTE.slice(0, -1)) assert.ok(landings.has(id), id);
    assert.equal(lift, 1); assert.ok(drawer > .75, 'the drawer opened far enough to drop the little desk'); assert.ok(tiltedDesk); assert.ok(sign);
    assert.equal(end.ground, false, 'ending stays suspended in the sky');
});

test('the single sky flag restores a safe landing and does not leak props into earlier stages', () => {
    const game = createGame(); game.startStage(4);
    let checked = false, savedSky;
    driveStageFour(game, state => {
        if (state.checkpoint === 1 && !checked) {
            checked = true; savedSky = game.serialize();
            game.pause(); const frozen = game.getSnapshot(); game.advance(2);
            assert.deepEqual(game.getSnapshot(), frozen); game.pause();
        }
    });
    assert.ok(checked);
    game.restore(savedSky);
    game.restart();
    const retry = game.getSnapshot();
    assert.equal(retry.checkpoint, 1); assert.equal(retry.player.x, 3790);
    assert.equal(retry.sky.phase, 'course'); assert.equal(retry.sky.lift, 1);
    game.startStage(4); assert.equal(game.getSnapshot().player.x, 2380);
    game.startStage(3); assert.equal(game.getSnapshot().sky.phase, 'arrival');
    assert.equal(game.getSnapshot().hasExtinguisher, false);
});

test('only three bursts per time in the air, refilled on landing', () => {
    const game = createGame(); game.startStage(4);
    for (let i = 0; i < 120 * 10 && !(game.getSnapshot().sky.phase === 'course' && game.getSnapshot().ground); i++) { game.setInput('right'); game.step(1 / 120); }
    game.setInput();
    let fired = 0;
    for (let i = 0; i < 120; i++) {
        game.spray();
        fired = Math.max(fired, game.getSnapshot().sky.airSprays);
        game.step(1 / 120);
    }
    assert.equal(fired, STAGE_FOUR.airSprayLimit);
    for (let i = 0; i < 120 * 6 && !game.getSnapshot().ground; i++) game.step(1 / 120);
    assert.equal(game.getSnapshot().ground, true);
    assert.equal(game.getSnapshot().sky.airSprays, 0);
});

const course = (over = {}) => ({
    sky: { ...createSky(), phase: 'course', lift: 1 }, p: { x: 4000, y: -2500, vx: 0, vy: 0, a: 0, w: 0 }, ground: false, coyote: 0, jumpQ: 0,
    checkpoint: 1, time: 0, direction: 0, length: STAGE_FOUR.length, sprayBurst: 0, sprayDir: { x: 0, y: 1 }, ...over,
});
const fly = (input, seconds) => {
    let r;
    for (let i = 0; i < seconds * 120; i++) {
        r = skyStep({ ...input, time: input.time + i / 120 }, 1 / 120);
        input = { ...input, sky: r.sky, p: r.p, ground: r.ground };
    }
    return r;
};

test('the headwind always pushes back and a warning breeze comes before every gust', () => {
    const w = STAGE_FOUR.wind;
    assert.equal(skyGust(1).strength, 0); assert.equal(skyGust(1).warn, 0);
    const warned = skyGust(w.calm + w.warn * .5);
    assert.ok(warned.warn > 0 && warned.strength === 0, 'the breeze warns before anything pushes');
    assert.equal(skyGust(w.calm + w.warn + 1).strength, 1);
    const calm = fly(course({ time: 0, p: { x: 4000, y: -2900, vx: 0, vy: 0, a: 0, w: 0 } }), .5);
    const gust = fly(course({ time: w.calm + w.warn + .4, p: { x: 4000, y: -2900, vx: 0, vy: 0, a: 0, w: 0 } }), .5);
    assert.ok(calm.p.vx < 0, 'the steady wind blows against the course');
    assert.ok(gust.p.vx < calm.p.vx * 2.5, 'a gust blows much harder');
});

test('paper bundles ride the gusts and birds knock the chair backwards', () => {
    const w = STAGE_FOUR.wind;
    assert.equal(skyHazards(1).filter(h => h.kind === 'paper').length, 0, 'no papers in the calm');
    const papers = skyHazards(w.calm + w.warn + 1).filter(h => h.kind === 'paper');
    assert.ok(papers.length > 0);
    for (const kind of ['paper', 'bird']) {
        let time = 0, hazard;
        while (!(hazard = skyHazards(time).find(h => h.kind === kind))) time += .05;
        const r = skyStep(course({ time, p: { x: hazard.x, y: hazard.y + 20, vx: 100, vy: 0, a: 0, w: 0 } }), 1 / 120);
        assert.equal(r.hit, kind);
        assert.ok(r.p.vx < -100, `${kind} knocks the chair back`);
        assert.equal(r.sky.knockKind, kind);
        const again = skyStep({ ...course({ time: time + 1 / 120, p: r.p }), sky: r.sky }, 1 / 120);
        assert.equal(again.hit, null, 'one knock at a time');
    }
});

test('desks rock back and forth and carry the chair standing on them', () => {
    const sky = { ...createSky(), phase: 'course', lift: 1 };
    const angles = new Set(), xs = new Set();
    for (let t = 0; t < 6; t += .5) {
        const desk = skyPlatforms(sky, t).find(p => p.id === 'upper-rest');
        angles.add(Math.sign(desk.angle)); xs.add(Math.round(desk.x));
    }
    assert.ok(angles.has(1) && angles.has(-1), 'desks tilt both ways');
    assert.ok(xs.size > 3, 'desks sway sideways');
    const desk = skyPlatforms(sky, 0).find(p => p.id === 'upper-rest');
    const x = desk.x + desk.width / 2;
    let input = course({ sky: { ...sky, standing: 'upper-rest' }, ground: true, p: { x, y: skySurface(desk, x) - 28, vx: 0, vy: 0, a: 0, w: 0 } });
    const r = skyStep({ ...input, time: 1 / 120 }, 1 / 120);
    assert.equal(r.ground, true, 'still standing a tick later');
});
