import assert from 'node:assert/strict';
import test from 'node:test';
import { driveStageThree } from './support/stage3-route.mjs';
import { bundled } from './support/load.mjs';

const { createGame, createCore, rooftopStep, rooftopHooks, STAGE_THREE, ventPhase } = await bundled({ stdin: { contents: `
    export { createGame } from './src/game/game';
    export { createCore } from './src/game/state';
    export { rooftopStep } from './src/game/stages/rooftop/course/decide';
    export { rooftopHooks } from './src/game/stages/rooftop/hooks';
    export { STAGE_THREE, ventPhase } from './src/game/stages/rooftop/data';
`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });
const dt = 1 / 120;
const SHAFT_FLAG = STAGE_THREE.checkpoints.findIndex(mark => mark.x === 1310);
const course = { kind: 'course', verticalShots: 0, lastShotAt: -1 };

function rooftop(p, { time = 0, duct = { kind: 'idle' }, ground = true } = {}) {
    return { p: { vx: 0, vy: 0, a: 0, w: 0, ...p }, ground, hasExtinguisher: true, firstFlight: course, ductReaction: duct, time };
}

// The first time in the vent's cycle that it is in `kind`.
function firstTime(vent, kind) {
    for (let t = 0; t < vent.period; t += dt) if (ventPhase(vent, t).kind === kind) return t + dt;
    throw new Error(`vent never ${kind}`);
}

test('the shaft has no open column: holding spray straight up from the floor never clears the first ledge', () => {
    for (const x of [1270, 1350, 1450, 1510, 1600, 1700]) {
        const game = createGame({ seed: 1 }); game.startStage(3);
        driveStageThree(game, state => state.checkpoint === 2 && state.ground && state.player.x > 1100);
        for (let i = 0; i < 1200; i++) {
            const s = game.getSnapshot();
            if (Math.abs(s.player.x - x) < 15 && s.ground) break;
            game.setInput(s.player.x < x ? 'right' : 'left'); game.step(dt);
        }
        game.setInput('spray');
        let top = Infinity;
        for (let i = 0; i < 120 * 10; i++) { game.step(dt); game.drainEvents(); top = Math.min(top, game.getSnapshot().player.y); }
        assert.ok(top > 100, `from x=${x} the chair rose to ${top.toFixed(0)}`);
    }
});

test('an awake duct gusts on its own and knocks a rider in front of it', () => {
    let input = rooftop({ x: 1560, y: 248 }, { duct: { kind: 'done', shots: 1, rest: 0 } });
    const d = STAGE_THREE.duct;
    let knocked = null;
    for (let i = 0; i < Math.ceil((d.gustPeriod + d.gustInhaleDuration + d.gustTwitchDuration + .05) / dt); i++) {
        const r = rooftopStep(input, dt);
        if (r.p.vx < 0 && knocked === null) knocked = i * dt;
        input = { ...input, p: r.p, ground: r.ground, ductReaction: r.ductReaction, time: input.time + dt };
    }
    assert.ok(knocked > d.gustPeriod + d.gustInhaleDuration, 'the gust waits for its period and a visible inhale');
    assert.ok(input.p.vx <= -d.gustKnockback + 1);
});

test('steam vents shove only while blowing: the wall vents sideways, the ceiling vent down', () => {
    for (const vent of STAGE_THREE.vents) {
        const inFront = vent.axis === 'x' ? { x: vent.x + vent.dir * 120, y: vent.y } : { x: vent.x, y: vent.y + vent.dir * 120 };
        const quiet = rooftopStep(rooftop(inFront, { time: firstTime(vent, 'warn') }), dt).p;
        assert.equal(quiet.vx, 0, 'a hissing vent warns without pushing');
        assert.equal(quiet.vy, 0);
        const blown = rooftopStep(rooftop(inFront, { time: firstTime(vent, 'blow') }), dt).p;
        const push = vent.axis === 'x' ? blown.vx : blown.vy;
        assert.ok(Math.sign(push) === vent.dir && Math.abs(push) > 10, `vent at ${vent.x},${vent.y} pushes along its axis`);
        const aside = vent.axis === 'x' ? { x: inFront.x, y: vent.y + vent.spread + 20 } : { x: vent.x + vent.spread + 20, y: inFront.y };
        const missed = rooftopStep(rooftop(aside, { time: firstTime(vent, 'blow') }), dt).p;
        assert.equal(vent.axis === 'x' ? missed.vx : missed.vy, 0, 'outside the blast nothing moves');
    }
});

test('the scattered printouts make the shaft ledges slippery only once the duct is awake', () => {
    const s = createCore({ seed: 0 }); s.stage = 3; s.hasExtinguisher = true; s.ground = true;
    for (const span of STAGE_THREE.slick) {
        s.p = { x: (span.left + span.right) / 2, y: span.y - 28, vx: 0, vy: 0, a: 0, w: 0 };
        s.rooftop.duct = { kind: 'idle' };
        assert.deepEqual(rooftopHooks.drive(s, 0), {}, 'no paper before the first sneeze');
        s.rooftop.duct = { kind: 'done', shots: 1, rest: 0 };
        assert.deepEqual(rooftopHooks.drive(s, 0), { slip: true });
        s.p.x = span.left - 40;
        assert.deepEqual(rooftopHooks.drive(s, 0), {}, 'the bare part of the ledge still grips');
    }
});

test('a retry from the shaft flag starts on its ledge with the duct already awake', () => {
    const game = createGame(); game.startStage(3);
    const saved = JSON.parse(game.serialize());
    saved.checkpoint = SHAFT_FLAG;
    game.restore(JSON.stringify(saved));
    game.reset();
    const s = game.getSnapshot();
    assert.equal(s.hasExtinguisher, true);
    assert.equal(s.ductReaction.kind, 'done');
    assert.deepEqual([s.player.x, s.player.y], [1310, 78]);
    assert.equal(s.rooftopEntrance.kind, 'ready');
});
