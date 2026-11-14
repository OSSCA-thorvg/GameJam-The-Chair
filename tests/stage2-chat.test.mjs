import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';
import { orientationHop } from './support/harness.mjs';

const { createGame, applyCorridor, STAGE_TWO } = await loadSource(`
    export { createGame } from './src/game/game';
    export { applyCorridor } from './src/game/stages/building/corridor/apply';
    export { STAGE_TWO } from './src/game/stages/building/data';
`);
const dt = 1 / 120;
function crowd() {
    const game = createGame({ seed: 0 });
    game.startStage(2);
    const s = JSON.parse(game.serialize());
    s.mode = 'play'; s.ground = true;
    s.building.corridor.dispatchStarted = true; s.building.corridor.dispatchAge = 10;
    s.building.furniture.forEach((chair, i) => Object.assign(chair, { x: 400 - i * 130, vx: 185, released: true, cheer: 0 }));
    Object.assign(s.p, { x: 500, y: 392, vx: 185, vy: 0, a: 0, w: 0 });
    return s;
}
function tick(s) {
    const player = { ...s.p };
    const pace = s.building.corridor.pace;
    applyCorridor(s, [], dt, s.p.x - s.p.vx * dt);
    const startedExpress = pace === 'casual' && s.building.corridor.pace === 'express';
    if (s.building.corridor.convoy === 'free' && !startedExpress) assert.deepEqual(s.p, player, 'free riders keep control while chairs make room');
    for (let i = 1; i < 3; i++) assert.ok(s.building.furniture[i - 1].x - s.building.furniture[i].x >= 79.99);
}

test('unaccompanied chairs trade gossip and roll ahead without waiting for the player', () => {
    const s = crowd();
    const start = s.building.furniture.map(chair => chair.x);
    for (let i = 0; i < 360; i++) { s.p.x += 185 * dt; tick(s); }
    assert.equal(s.building.corridor.chat.kind, 'gossip');
    assert.ok(s.building.corridor.chat.age > 2.9);
    assert.ok(s.building.furniture.every((chair, i) => chair.x > start[i] + 500));
});

test('a rider leading the nearby convoy joins its express run and clears the construction pit', () => {
    const s = crowd();
    s.lessons.jumped = true;
    const start = STAGE_TWO.express.start;
    s.building.furniture.forEach((chair, i) => Object.assign(chair, { x: start - 40 - i * 130, vx: 220 }));
    Object.assign(s.p, { x: start, vx: 220 });
    s.building.corridor.lesson = STAGE_TWO.orientation.lines.length - 1;
    s.building.corridor.chat = { kind: 'orientation', age: 9, line: STAGE_TWO.orientation.lines.length - 1 };
    const game = createGame({ seed: 0 });
    game.restore(JSON.stringify(s));
    game.setInput('right');
    let led = false;
    let launched = false;

    for (let i = 0; i < 600 && game.getSnapshot().player.x <= STAGE_TWO.express.pit.right; i++) {
        const state = game.getSnapshot();
        led ||= state.corridor.convoy === 'leading';
        launched ||= state.corridor.convoy === 'leading-airborne' && state.player.x >= STAGE_TWO.express.pit.left;
        const toLip = STAGE_TWO.express.pit.left - state.player.x;
        if (state.corridor.convoy === 'leading' && state.ground && toLip > 0 && toLip < 35) {
            game.jump();
            game.clearInput();
        }
        game.step();
    }

    const state = game.getSnapshot();
    assert.equal(state.deaths, 0);
    assert.ok(led, 'the lead rider becomes part of the convoy');
    assert.ok(launched, 'the lead rider launches with the convoy');
    assert.ok(state.player.x > STAGE_TWO.express.pit.right, 'the lead rider clears the pit');
});

test('flying over the group does not count as joining, grounded admission welcomes the rookie only once', () => {
    const s = crowd();
    s.ground = false; s.p.y = 300;
    for (let i = 0; i < 120; i++) {
        s.p.x = (s.building.furniture[0].x + s.building.furniture[2].x) / 2;
        tick(s);
    }
    assert.equal(s.building.corridor.chat.kind, 'gossip');
    s.ground = true; s.p.y = 392;
    tick(s);
    assert.equal(s.building.corridor.chat.kind, 'wary');
    const phases = ['wary'];
    for (let i = 0; i < 1200 && s.building.corridor.chat.kind !== 'orientation'; i++) {
        s.p.x += 185 * dt;
        tick(s);
        if (phases.at(-1) !== s.building.corridor.chat.kind) phases.push(s.building.corridor.chat.kind);
    }
    assert.deepEqual(phases, ['wary', 'realizing', 'welcoming', 'orientation']);
    s.p.x = s.building.furniture[0].x + 600;
    for (let i = 0; i < 120; i++) tick(s);
    s.p.x = (s.building.furniture[0].x + s.building.furniture[2].x) / 2;
    tick(s);
    assert.equal(s.building.corridor.chat.kind, 'orientation', 'rejoining resumes the orientation instead of repeating the welcome');
    assert.equal(s.focus, 100);
});

function rideOrientation(game, hop, until) {
    const lines = [];
    for (let i = 0; i < 120 * 60; i++) {
        const state = game.getSnapshot(), p = state.player, chat = state.corridor.chat;
        if (chat.kind === 'orientation' && chat.age >= 0 && lines.at(-1)?.line !== chat.line) lines.push({ line: chat.line, x: p.x });
        if (until(state)) return { state, lines };
        const keys = ['right'];
        const correction = -p.a * 12 - p.w * 4;
        if (correction < -.4) keys.push('q');
        if (correction > .4) keys.push('e');
        if (hop(state)) game.jump();
        game.setInput(...keys);
        game.step(dt);
    }
    assert.fail('the orientation ride did not finish');
}

test('the chairs teach the rookie each rule before its obstacle, and a hopping rookie never trips', () => {
    const game = createGame({ seed: 0 });
    game.startStage(2);
    const { state, lines } = rideOrientation(game, orientationHop, s => s.corridor.pace === 'express');
    assert.deepEqual(lines.map(entry => entry.line), STAGE_TWO.orientation.lines.map((_, i) => i), 'every line is said once, in order');
    const rules = { 0: 'cable', 3: 'sleeper' };
    for (const [line, kind] of Object.entries(rules)) {
        const obstacle = STAGE_TWO.orientation.obstacles.find(o => o.kind === kind);
        const said = lines.find(entry => entry.line === Number(line));
        assert.ok(said.x < obstacle.x - 300, `the ${kind} rule comes well before the ${kind}`);
    }
    assert.equal(state.focus, 100);
});

test('tripping on an orientation obstacle costs a little focus, the convoy waits, and the lesson resumes', () => {
    const game = createGame({ seed: 0 });
    game.startStage(2);
    rideOrientation(game, () => false, s => s.corridor.chat.kind === 'trip');
    const tripped = game.getSnapshot();
    assert.equal(tripped.focus, 100 - STAGE_TWO.orientation.damage);
    assert.equal(tripped.corridor.convoy, 'free');
    assert.ok(tripped.player.vy < 0, 'the rookie stumbles up');
    let waited = false;
    const { state } = rideOrientation(game, () => false, s => {
        waited ||= s.corridor.convoy === 'free' && s.ground && s.furniture[0].vx < STAGE_TWO.orientation.cruise - 50;
        return s.corridor.chat.kind === 'orientation' && s.corridor.chat.age >= 0;
    });
    assert.ok(waited, 'the chairs slow down for the rookie');
    assert.equal(state.corridor.convoy, 'carried');
    assert.ok(state.corridor.chat.line >= tripped.corridor.lesson && state.corridor.chat.line <= tripped.corridor.lesson + 1,
        'the lesson picks up where it stopped, skipping a line whose moment has passed');
});
