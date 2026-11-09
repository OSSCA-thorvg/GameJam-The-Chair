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

test('fan preview shows the chair rising with active wind', () => {
    const scene = previewScenes.find(scene => scene.id === 'fan-ride');
    assert.ok(scene);
    const idle = scene.sample(0).state;
    const peak = scene.sample(.9).state;
    assert.equal(idle.onFan, false);
    assert.equal(peak.onFan, true);
    assert.ok(peak.player.y < idle.player.y);
    const falling = scene.sample(1.8).state;
    const landed = scene.sample(1.9).state;
    assert.equal(falling.onFan, false);
    assert.ok(falling.player.vy > 0);
    assert.ok(falling.player.y < idle.player.y);
    assert.equal(landed.player.y, idle.player.y);
    assert.equal(landed.player.vy, 0);
    assert.equal(landed.ground, true);
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

test('cart preview shows a shove and recovery', () => {
    const scene = previewScenes.find(scene => scene.id === 'cart-shove');
    assert.ok(scene);
    const contact = scene.markers.find(marker => marker.label === 'Cart contact');
    assert.ok(contact);
    assert.equal(scene.sample(0).state.corridor.cartHits, 0);
    assert.equal(scene.sample(contact.at).state.corridor.cartHits, 1);
    assert.equal(scene.sample(scene.duration).state.mode, 'play');
});

test('document bump preview follows the live stage-two route', () => {
    const scene = previewScenes.find(scene => scene.id === 'paper-corridor');
    assert.ok(scene);
    const start = scene.sample(0).state;
    const later = scene.sample(3).state;
    assert.equal(start.stage, 2);
    assert.ok(start.player.x < start.corridor.paperPiles[0].x);
    assert.ok(later.player.x > start.player.x);
    assert.ok(later.furniture.some(chair => chair.y < 420));
    assert.deepEqual(scene.sample(3).state, later);
});

test('extinguisher preview keeps the spray plume and recoil in sync', () => {
    const scene = previewScenes.find(scene => scene.id === 'extinguisher-spray');
    assert.ok(scene);
    const start = scene.sample(0).state;
    const recoil = scene.sample(.16).state;
    assert.ok(start.spray.burst > 0);
    assert.ok(start.spray.dir.x > 0);
    assert.ok(recoil.player.x < start.player.x);
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
