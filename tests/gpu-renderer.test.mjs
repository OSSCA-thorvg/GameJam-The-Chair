import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { chooseRenderer, isSoftwareGl, createGpuTimer } = await loadSource(`
    export { chooseRenderer, isSoftwareGl } from './src/render/backend';
    export { createGpuTimer } from './src/render/gpu-timer';
`);

test('the GPU renderer is used whenever hardware WebGL2 exists, and the URL can force either backend', () => {
    assert.equal(chooseRenderer(true, null), 'gl');
    assert.equal(chooseRenderer(false, null), 'sw');
    assert.equal(chooseRenderer(true, 'sw'), 'sw');
    assert.equal(chooseRenderer(false, 'gl'), 'gl');
    assert.equal(chooseRenderer(true, 'wg'), 'gl', 'unknown values fall back to detection');
    assert.equal(chooseRenderer(false, ''), 'sw');
});

test('CPU-emulated WebGL does not count as a GPU', () => {
    assert.equal(isSoftwareGl('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)'), true);
    assert.equal(isSoftwareGl('llvmpipe (LLVM 15.0.7, 256 bits)'), true);
    assert.equal(isSoftwareGl('ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0)'), true);
    assert.equal(isSoftwareGl('ANGLE (Intel, Mesa Intel(R) HD Graphics 630 (KBL GT2), OpenGL 4.6)'), false);
    assert.equal(isSoftwareGl('Apple M2'), false);
    assert.equal(isSoftwareGl('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)'), false);
});

/** A WebGL2 stand-in whose timer results become available when the test says so. */
function fakeGl({ timer = true } = {}) {
    let next = 1;
    const queries = new Map();
    const gl = {
        QUERY_RESULT: 1, QUERY_RESULT_AVAILABLE: 2,
        disjoint: false,
        open: null,
        getExtension: name => (name === 'EXT_disjoint_timer_query_webgl2' && timer ? {} : null),
        createQuery: () => { const q = { id: next++ }; queries.set(q, { ns: 0, ready: false }); return q; },
        deleteQuery: q => queries.delete(q),
        beginQuery(target, q) { assert.equal(gl.open, null, 'only one timer query may be open'); gl.open = q; },
        endQuery() { assert.ok(gl.open); gl.open = null; },
        getParameter: () => gl.disjoint,
        getQueryParameter: (q, what) => what === gl.QUERY_RESULT_AVAILABLE ? queries.get(q).ready : queries.get(q).ns,
        finish(q, ms) { Object.assign(queries.get(q), { ns: ms * 1e6, ready: true }); },
        queries,
    };
    return gl;
}

test('GPU timer reports frames in order once their results arrive and reuses queries', () => {
    assert.equal(createGpuTimer(null), null);
    assert.equal(createGpuTimer(fakeGl({ timer: false })), null, 'browsers without timer queries get no timer');

    const gl = fakeGl();
    const timer = createGpuTimer(gl);
    const frame = () => { assert.equal(timer.begin(), true); timer.end(); };
    frame(); frame(); frame();
    const [a, b, c] = [...gl.queries.keys()];
    assert.deepEqual(timer.collect(), [], 'nothing is ready yet');
    gl.finish(b, 2);
    assert.deepEqual(timer.collect(), [], 'a later frame cannot be reported before an earlier one');
    gl.finish(a, 4);
    assert.deepEqual(timer.collect(), [4, 2]);
    gl.finish(c, 1.5);
    assert.deepEqual(timer.collect(), [1.5]);
    frame();
    assert.equal(gl.queries.size, 3, 'finished queries are reused');
});

test('GPU timer drops results after a disjoint event and stops queuing when the GPU falls far behind', () => {
    const gl = fakeGl();
    const timer = createGpuTimer(gl);
    for (let i = 0; i < 8; i++) { assert.equal(timer.begin(), true); timer.end(); }
    assert.equal(timer.begin(), false, 'at most eight frames wait for results');
    for (const q of gl.queries.keys()) gl.finish(q, 3);
    gl.disjoint = true;
    assert.deepEqual(timer.collect(), [], 'a disjoint event voids every pending result');
    gl.disjoint = false;
    assert.equal(timer.begin(), true, 'measuring resumes afterwards');
    timer.end();
    timer.dispose();
    assert.equal(gl.queries.size, 0);
});
