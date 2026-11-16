import assert from 'node:assert/strict';
import test from 'node:test';

import { load } from './support/load.mjs';

const { configHash } = await load('src/game/data.ts');

test('hashes ignore object key order recursively, including inside arrays', () => {
    const first = {
        player: { x: 3, y: 4 },
        events: [{ type: 'cue', point: { x: 5, y: 6 } }],
    };
    const reordered = {
        events: [{ point: { y: 6, x: 5 }, type: 'cue' }],
        player: { y: 4, x: 3 },
    };
    assert.equal(configHash(first), configHash(reordered));
});

test('hashes preserve values, field sets, and array order', () => {
    const original = { focus: 90, events: [{ id: 1 }, { id: 2 }] };
    for (const changed of [
        { focus: 89, events: [{ id: 1 }, { id: 2 }] },
        { focus: 90, events: [{ id: 1 }, { id: 3 }] },
        { focus: 90, events: [{ id: 2 }, { id: 1 }] },
        { events: [{ id: 1 }, { id: 2 }] },
        { ...original, ground: true },
    ]) {
        assert.notEqual(configHash(original), configHash(changed));
    }
});

test('hashing leaves frozen inputs and their key order unchanged', () => {
    const original = Object.freeze({
        z: Object.freeze([Object.freeze({ y: 2, x: 1 })]),
        a: 3,
    });
    const before = JSON.stringify(original);
    configHash(original);
    assert.equal(JSON.stringify(original), before);
});

test('hashes preserve own prototype-named fields and JSON semantics', () => {
    const first = JSON.parse('{"__proto__":{"z":2,"a":1},"constructor":3}');
    const reordered = JSON.parse('{"constructor":3,"__proto__":{"a":1,"z":2}}');
    assert.equal(configHash(first), configHash(reordered));
    assert.notEqual(configHash(first), configHash({ constructor: 3 }));
    assert.equal(
        configHash({ missing: undefined, values: [undefined, null, false] }),
        configHash({ values: [null, null, false] }),
    );
});
