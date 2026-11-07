import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/preview-scenes.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { previewScenes } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('cleaner preview seeks backward to the same pose and splash', () => {
    const scene = previewScenes.find(scene => scene.id === 'cleaner-recovery');
    assert.ok(scene);
    assert.ok(scene.markers.some(marker => marker.at === 2.4));

    const first = scene.sample(2.4);
    const splash = scene.sample(0.4);
    const end = scene.sample(scene.duration);
    const again = scene.sample(2.4);

    assert.equal(first.state.bucketAge, 2.4);
    assert.equal(first.state.cleaning.spilled, true);
    assert.deepEqual(again, first);
    assert.ok(splash.effects.waterDrops.length > 0);
    assert.equal(end.effects.waterDrops.length, 0);
    assert.equal(scene.sample(-1).state.bucketAge, 0);
    assert.equal(scene.sample(scene.duration + 1).state.bucketAge, scene.duration);
});
