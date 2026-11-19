import assert from 'node:assert/strict';
import test from 'node:test';

import { load } from './support/load.mjs';

const { musicTrack } = await load('src/presentation/music.ts');

test('the title screen and opening play the start theme', () => {
    assert.equal(musicTrack({ mode: 'intro', stage: 1 }, false), 'start');
    assert.equal(musicTrack({ mode: 'play', stage: 1 }, true), 'start');
});

test('each stage plays its own theme', () => {
    const tracks = [1, 2, 3, 4, 5].map((stage) =>
        musicTrack({ mode: 'play', stage, orbit: { phase: 'rings' } }, false),
    );
    assert.deepEqual(tracks, [
        'stage1-2',
        'stage1-2',
        'stage3',
        'stage4',
        'stage5',
    ]);
});

test('parking at the orbit door switches to the ending theme', () => {
    assert.equal(
        musicTrack(
            { mode: 'play', stage: 5, orbit: { phase: 'parked' } },
            false,
        ),
        'ending',
    );
});
