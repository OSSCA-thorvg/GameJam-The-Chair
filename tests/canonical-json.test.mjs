import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalJson } from './support/canonical-json.mjs';

test('fingerprints ignore object insertion order at every depth', () => {
    const first = {
        player: { x: 3, y: 4 },
        events: [{ type: 'cue', point: { x: 5, y: 6 } }],
    };
    const reordered = {
        events: [{ point: { y: 6, x: 5 }, type: 'cue' }],
        player: { y: 4, x: 3 },
    };
    assert.equal(canonicalJson(first), canonicalJson(reordered));
});

test('fingerprints distinguish values, field sets and array order', () => {
    const original = { focus: 90, events: [{ id: 1 }, { id: 2 }] };
    for (const changed of [
        { focus: 89, events: [{ id: 1 }, { id: 2 }] },
        { focus: 90, events: [{ id: 1 }, { id: 3 }] },
        { focus: 90, events: [{ id: 2 }, { id: 1 }] },
        { events: [{ id: 1 }, { id: 2 }] },
        { ...original, ground: true },
    ]) {
        assert.notEqual(canonicalJson(original), canonicalJson(changed));
    }
});

test('fingerprinting never reorders or modifies its input', () => {
    const original = Object.freeze({
        z: Object.freeze([Object.freeze({ y: 2, x: 1 })]),
        a: 3,
    });
    const serialized = JSON.stringify(original);
    canonicalJson(original);
    assert.equal(JSON.stringify(original), serialized);
    assert.deepEqual(Object.keys(original), ['z', 'a']);
    assert.deepEqual(Object.keys(original.z[0]), ['y', 'x']);
});

test('fingerprints preserve JSON values and own prototype-named properties', () => {
    const value = JSON.parse('{"__proto__":{"z":2,"a":1},"constructor":3}');
    assert.deepEqual(JSON.parse(canonicalJson(value)), value);
    assert.equal(
        canonicalJson({ missing: undefined, array: [undefined, null, false] }),
        '{"array":[null,null,false]}',
    );
});
