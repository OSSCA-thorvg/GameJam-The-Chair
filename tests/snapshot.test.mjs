import assert from 'node:assert/strict';
import test from 'node:test';
import { load } from './support/load.mjs';

const { createGame, viewState } = await load('src/game/game.ts');

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

const SNAPSHOT_FIELDS = [
    'game',
    'spray',
    'lessons',
    'officeCheckpoint',
    'skylineSeed',
    'actualSpeed',
    'tutorialAssist',
    'stage',
    'sky',
    'orbit',
    'completedStage',
    'hasExtinguisher',
    'firstFlight',
    'rooftopEntrance',
    'ductReaction',
    'airSprays',
    'checkpoint',
    'furniture',
    'corridor',
    'canEnterMeeting',
    'level',
    'mode',
    'focus',
    'focusClock',
    'focusLossTime',
    'focusNotice',
    'lossReason',
    'player',
    'ground',
    'slip',
    'dirty',
    'inBin',
    'binAge',
    'time',
    'deaths',
    'bursts',
    'paperHits',
    'binFalls',
    'dirtyWaterExperienced',
    'cleaningSpilled',
    'soaked',
    'bucketAge',
    'paperPenaltyRemaining',
    'lightPenaltyRemaining',
    'cleaning',
    'lightHits',
    'doorHits',
    'monitors',
    'papers',
    'people',
    'solids',
    'copier',
    'urgentCopier',
    'bin',
    'focusBlocked',
];

test('all stages preserve the public snapshot field contract', () => {
    const game = createGame({ seed: 42 });
    for (const stage of [1, 2, 3, 4, 5]) {
        game.startStage(stage);
        assert.deepEqual(Object.keys(game.getSnapshot()), SNAPSHOT_FIELDS);
    }
});

test('snapshot projections preserve play-only values and stage-specific visibility', () => {
    const game = createGame({ seed: 42 });
    for (const stage of [1, 2, 3, 4, 5]) {
        game.startStage(stage);
        const state = JSON.parse(game.serialize());
        state.p.x = 100;
        state.actualSpeed = 87;
        state.checkpoint = 1;
        state.office.soakedOnSpill = 2;
        state.office.wetSeen = true;
        state.office.copier.bursts = 7;
        state.focus.value = 73;
        state.focus.recoveryClock = 0.5;
        for (const mode of [
            'intro',
            'play',
            'pause',
            'focuslost',
            'dead',
            'won',
        ]) {
            state.mode = mode;
            const snapshot = viewState(state);
            assert.equal(snapshot.actualSpeed, mode === 'play' ? 87 : 0);
            assert.equal(snapshot.tutorialAssist, mode === 'play');
            assert.equal(snapshot.officeCheckpoint, stage === 1);
            assert.equal(snapshot.orbit !== undefined, stage === 5);
            assert.equal(snapshot.soaked, true);
            assert.equal(snapshot.dirtyWaterExperienced, true);
            assert.equal(snapshot.bursts, 7);
            assert.equal(snapshot.focus, 73);
            assert.equal(snapshot.focusClock, 0.5);
        }
    }
});

function objectReferences(value, references = new Set()) {
    if (value !== null && typeof value === 'object' && !references.has(value)) {
        references.add(value);
        for (const child of Object.values(value)) {
            objectReferences(child, references);
        }
    }
    return references;
}

test('every nested snapshot object belongs to that snapshot', () => {
    const game = createGame({ seed: 42 });
    for (const stage of [1, 2, 3, 4, 5]) {
        game.startStage(stage);
        const state = JSON.parse(game.serialize());
        state.focus.notice = { kind: 'paper', life: 1 };
        state.office.papers.push({
            ...state.p,
            life: 1,
            hit: false,
            landed: false,
            volley: 1,
            safe: false,
            kind: 'sheet',
        });
        const coreObjects = objectReferences(state);
        const firstObjects = objectReferences(viewState(state));
        const secondObjects = objectReferences(viewState(state));
        for (const object of firstObjects) {
            assert.equal(coreObjects.has(object), false, 'no core alias');
            assert.equal(secondObjects.has(object), false, 'no snapshot alias');
        }
    }
});
