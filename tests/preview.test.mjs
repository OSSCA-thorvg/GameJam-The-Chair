import assert from 'node:assert/strict';
import test from 'node:test';
import { bundled } from './support/load.mjs';

const { previewScenes } = await bundled({ entryPoints: ['src/preview-scenes.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });

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

test('monitor preview shows the warning, beam, and cooldown phases', () => {
    const scene = previewScenes.find(scene => scene.id === 'monitor-light');
    assert.ok(scene);
    const warning = scene.sample(.4).state.monitors[0];
    const beam = scene.sample(1.2).state.monitors[0];
    const cooldown = scene.sample(2.4).state.monitors[0];
    assert.equal(warning.warning, true);
    assert.equal(beam.active, true);
    assert.equal(cooldown.active, false);
});

test('copier preview plays the real three-shot volley and seeks deterministically', () => {
    const scene = previewScenes.find(scene => scene.id === 'copier-volley');
    assert.ok(scene);
    assert.equal(scene.sample(0).state.papers.length, 0);
    const fired = scene.sample(1.15);
    assert.equal(fired.state.bursts, 3);
    assert.ok(fired.state.papers.length > 0);
    scene.sample(scene.duration);
    assert.deepEqual(scene.sample(1.15), fired);
});

test('impact preview replays a collision through its game-over frame', () => {
    const scene = previewScenes.find(scene => scene.id === 'head-impact');
    assert.ok(scene);
    const start = scene.sample(0).state;
    const rewind = scene.sample(.8).state;
    assert.equal(start.mode, 'impact');
    assert.notEqual(rewind.player.a, start.player.a);
    assert.equal(scene.sample(scene.duration).state.mode, 'dead');
    assert.deepEqual(scene.sample(0).state, start);
});

test('extinguisher preview keeps the spray plume and recoil in sync', () => {
    const scene = previewScenes.find(scene => scene.id === 'extinguisher-spray');
    assert.ok(scene);
    const start = scene.sample(0).state;
    const recoil = scene.sample(.16).state;
    assert.ok(start.spray.burst > 0);
    assert.ok(start.spray.dir.x < 0);
    assert.ok(recoil.player.x > start.player.x);
    assert.ok(recoil.player.y < start.player.y);
    assert.equal(scene.sample(.5).state.spray.burst, 0);
});

test('office preview keeps one staff mix through the typing motion', () => {
    const scene = previewScenes.find(scene => scene.id === 'office-typing');
    assert.ok(scene);
    const start = scene.sample(0).state;
    const typing = scene.sample(.25).state;
    assert.equal(start.stage, 2);
    assert.equal(typing.corridor.appearanceSeed, start.corridor.appearanceSeed);
    assert.equal(typing.time, .25);
});

test('duct preview seeks between powder intake, twitch and sneeze', () => {
    const scene = previewScenes.find(scene => scene.id === 'duct-sneeze');
    assert.ok(scene);
    assert.equal(scene.markers.length, 4);
    assert.equal(scene.sample(.05).state.spray.burst, 0, 'the duct sneezes on its own timer, not at a spray');
    assert.ok(scene.sample(1.1).state.ductReaction.age > .2);
    assert.equal(scene.sample(1.1).state.hasExtinguisher, true);
    const sneeze = scene.sample(1.1);
    scene.sample(2.1);
    assert.deepEqual(scene.sample(1.1), sneeze);
});

test('merged preview registry keeps water, focus loss and rooftop scenes without the removed fan', () => {
    const ids = previewScenes.map(scene => scene.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ['bucket-pour', 'focus-loss', 'rooftop-entrance', 'duct-sneeze', 'duct-gust', 'cloud-entry']) {
        assert.ok(ids.includes(id), `missing preview: ${id}`);
    }
    assert.equal(ids.includes('fan-ride'), false);
    assert.equal(previewScenes.find(scene => scene.id === 'focus-loss').sample(1.7).state.mode, 'dead');
    const airborne = previewScenes.find(scene => scene.id === 'cloud-entry').sample(1).state;
    assert.equal(airborne.stage, 4);
    assert.ok(airborne.spray.burst > .2);
});

test('the sky ending preview seeks through side view, the orbit and back view', () => {
    const scene = previewScenes.find(scene => scene.id === 'sky-ending');
    assert.ok(scene);
    // The preview runs the reveal for settle + turn seconds, then the depth phase for hold seconds.
    const depthStart = scene.markers.find(marker => marker.label.startsWith('Rear view')).at;
    assert.equal(scene.sample(1.5).state.sky.phase, 'reveal');
    assert.equal(scene.sample(depthStart + .5).state.sky.phase, 'depth');
    assert.equal(scene.sample(scene.duration).state.sky.age, scene.duration - depthStart);
    const ending = scene.sample(scene.duration);
    scene.sample(0);
    assert.deepEqual(scene.sample(scene.duration), ending);
});
