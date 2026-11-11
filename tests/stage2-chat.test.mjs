import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createGame, applyCorridor } = await loadSource(`
    export { createGame } from './src/game/game';
    export { applyCorridor } from './src/game/stages/building/corridor/apply';
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
    applyCorridor(s, dt, s.p.x - s.p.vx * dt);
    if (s.building.corridor.convoy === 'free') assert.deepEqual(s.p, player, 'free riders keep control while chairs make room');
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
    for (let i = 0; i < 1200 && s.building.corridor.chat.kind !== 'companions'; i++) {
        s.p.x += 185 * dt;
        tick(s);
        if (phases.at(-1) !== s.building.corridor.chat.kind) phases.push(s.building.corridor.chat.kind);
    }
    assert.deepEqual(phases, ['wary', 'realizing', 'welcoming', 'companions']);
    s.p.x = s.building.furniture[0].x + 600;
    for (let i = 0; i < 120; i++) tick(s);
    s.p.x = (s.building.furniture[0].x + s.building.furniture[2].x) / 2;
    tick(s);
    assert.ok(['companions', 'rush'].includes(s.building.corridor.chat.kind), 'rejoining does not repeat the welcome, even after the convoy speeds up');
    assert.equal(s.focus, 100);
});
