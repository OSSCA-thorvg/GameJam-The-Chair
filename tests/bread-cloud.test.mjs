import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createRenderCtx, breadCloud, puffCloud, CLOUD_TONES } = await loadSource(`
    export { createRenderCtx } from './src/render/context';
    export { breadCloud } from './src/render/scene/cloud-art';
    export { puffCloud, CLOUD_TONES } from './src/render/scene/cloud-art';
`);
const context = () => Object.assign(createRenderCtx({}, {}), { W: 1000, H: 510, scale: 1, cam: 0, vertical: 0 });

test('shared bread clouds use the exact stage four silhouette, gradients and underside fade', () => {
    for (const near of [false,true]) {
        const retained = context(), reference = context();
        breadCloud(retained, 500, 300, 1, 901, near);
        puffCloud(reference, 500, 300, 1, 901, CLOUD_TONES.bread, { alpha: near ? .95 : .72, fade: true });
        assert.deepEqual(retained.commands, reference.commands);
    }
});
