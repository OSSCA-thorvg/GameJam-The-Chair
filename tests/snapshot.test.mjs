import assert from 'node:assert/strict';
import test from 'node:test';
import { load } from './support/load.mjs';

const { createGame } = await load('src/game/game.ts');

for (const stage of [1, 2, 3, 4, 5]) {
    test(`stage ${stage} snapshots detach nested data from the game and each other`, () => {
        const game = createGame({ seed: 42 });
        game.startStage(stage);
        const saved = game.serialize();
        const first = game.getSnapshot();
        const second = game.getSnapshot();
        const expected = structuredClone(second);
        first.player.x += 100;
        first.spray.dir.x += 10;
        first.cleaning.spilled = !first.cleaning.spilled;
        first.lessons.jumped = !first.lessons.jumped;
        for (const solid of first.solids) solid.p[0].x += 10;
        first.corridor.lesson += 1;
        first.sky.depth += 10;
        if (first.orbit) first.orbit.z += 10;
        assert.equal(game.serialize(), saved);
        assert.deepEqual(second, expected);
        assert.deepEqual(game.getSnapshot(), expected);
    });
}

test('snapshot projects copier display fields without exposing volley state', () => {
    const game = createGame();
    game.reset();
    const state = JSON.parse(game.serialize());
    assert.deepEqual(game.getSnapshot().copier, {
        x: state.office.copier.x,
        cool: state.office.copier.cool,
        burst: state.office.copier.burst,
        next: state.office.copier.next,
        dir: state.office.copier.dir,
    });
    assert.equal('volley' in game.getSnapshot().copier, false);
    assert.equal('bursts' in game.getSnapshot().copier, false);
});
