import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createGame, createRenderCtx, rooftopGraphSign, graphTargetPose, GRAPH_CORNERS, STAGE_THREE, previewScenes } = await loadSource(`
    export { createGame } from './src/game/game';
    export { createRenderCtx } from './src/render/context';
    export { rooftopGraphSign } from './src/render/scene/rooftop-graph';
    export { graphTargetPose } from './src/render/scene/graph-target';
    export { GRAPH_CORNERS, STAGE_THREE } from './src/game/stages/rooftop/data';
    export { previewScenes } from './src/preview-scenes';
`);
const game = createGame();
game.startStage(3);
const base = game.getSnapshot();
function render(distance, vertical = 0, scale = 1, time = 5) {
    const ctx = createRenderCtx({});
    const state = { ...base, firstFlight: { kind: 'ride', dist: distance, speed: 300, age: 1 } };
    Object.assign(ctx, { state, p: state.player, t: time, vertical, scale });
    rooftopGraphSign(ctx);
    return ctx.commands;
}

test('the first peak earns a check, then only the background target rises one grid', () => {
    const peak = GRAPH_CORNERS[1];
    const initial = graphTargetPose(peak - 1);
    const checked = graphTargetPose(peak + 24);
    const moved = graphTargetPose(peak + 220);
    assert.equal(initial.check, 0);
    assert.equal(checked.check, 1);
    assert.equal(checked.y, initial.y, 'check appears before the target moves');
    assert.equal(moved.y, initial.y - 50);
    assert.equal(moved.check, 0, 'achievement is revoked when the target rises');
    assert.equal(moved.pending, 1);
    assert.deepEqual(graphTargetPose(peak + 1000), moved, 'one move, no repeating goal chase');
    const before = render(peak + 24), after = render(peak + 220);
    const rail = commands => commands.find(command => command.stroke?.width === 2 && command.stroke.color === '#f4fff6');
    assert.deepEqual(rail(before), rail(after), 'the crisp ride surface never moves with the target');
    assert.deepEqual(rail(before).v[0], [STAGE_THREE.graph.points[0].x, STAGE_THREE.graph.points[0].y]);
    const goal = commands => commands.find(command => command.layer?.key === 'graph-target');
    assert.equal(goal(after).v[0][1], goal(before).v[0][1] - 50);
    const check = commands => commands.find(command => command.layer?.key === 'graph-target-check');
    assert.ok(check(before), 'the first peak briefly earns a green check');
    assert.ok(!check(after), 'check disappears after the target rises');
    const pending = after.find(command => command.layer?.key === 'graph-target-pending');
    assert.ok(pending && pending.c === null && pending.stroke, 'new target shows a hollow circle');
    const later = render(peak + 220, 0, 1, 6).find(command => command.layer?.key === 'graph-target-pending');
    assert.deepEqual(later.v, pending.v, 'unmet goal stays in place');
    assert.notEqual(later.layer.opacity, pending.layer.opacity, 'only the unmet marker gently pulses');
    assert.deepEqual(render(peak + 24), before, 'reverse seeking restores the earlier target');
});

test('the final arrow ends just above the sign and never grows with the camera', () => {
    const reference = render(600).find(command => command.c === '#c9ff6a');
    assert.ok(reference.v.every(([, y]) => y < -668 && y > -800), 'short arrow above the logo band');
    for (const vertical of [0, 900, 2200, 3500]) for (const scale of [.7, 1.2]) {
        const commands = render(600, vertical, scale);
        assert.ok(!commands.some(command => command.layer?.key === 'graph-infinite-glow'));
        assert.ok(!commands.some(command => command.c === '#6b6253' || command.stroke?.color === '#123b30'),
            'chart has no hair-like cracks or dark outlines');
        const arrow = commands.find(command => command.c === '#c9ff6a');
        arrow.v.forEach(([x, y], i) => {
            assert.ok(Math.abs(x / scale - reference.v[i][0]) < 1e-8);
            assert.ok(Math.abs(y / scale - vertical - reference.v[i][1]) < 1e-8, 'world endpoint stays fixed');
        });
        const rail = commands.find(command => command.layer?.key === 'graph-glow');
        assert.ok(rail.curves.every(curve => curve[5] / scale - vertical >= -760), 'surge ends with the short arrow');
    }
});

test('the real takeoff preview crosses the check and single target shift and seeks backward', () => {
    const scene = previewScenes.find(scene => scene.id === 'rooftop-takeoff');
    const markers = scene.markers.filter(marker => /First peak|Target/.test(marker.label));
    assert.equal(markers.length, 3);
    const poses = markers.map(marker => graphTargetPose(scene.sample(marker.at).state.firstFlight.dist));
    assert.equal(poses[0].check, 1);
    assert.ok(poses[2].y < poses[0].y);
    assert.equal(poses[2].check, 0);
    assert.equal(poses[2].pending, 1);
    scene.sample(scene.duration);
    assert.deepEqual(graphTargetPose(scene.sample(markers[0].at).state.firstFlight.dist), poses[0]);
});
