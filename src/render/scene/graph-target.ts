import { GRAPH_CORNERS, STAGE_THREE } from '../../game/stages/rooftop/data';
import type { RenderCtx } from '../context';

const PEAK = STAGE_THREE.graph.points[1];
const clamp = (value: number) => Math.max(0, Math.min(1, value));

// Distance is monotonic during a ride: the joke plays once and seeks without hidden state.
export function graphTargetPose(distance: number) {
    const sincePeak = distance - GRAPH_CORNERS[1];
    const move = clamp((sincePeak - 100) / 120);
    return {
        y: PEAK.y - 50 * move * move * (3 - 2 * move),
        check: clamp(sincePeak / 24) * (1 - move),
        pending: move,
    };
}

export function graphTarget(ctx: RenderCtx, distance: number) {
    const pose = graphTargetPose(distance);
    const pulse = .65 + .15 * Math.cos(ctx.t * 2);
    ctx.beginLayer({ key: 'graph-target', opacity: .8 * (1 - pose.pending) + pulse * pose.pending });
    ctx.strokePath([PEAK.x - 60, pose.y], [[PEAK.x - 60, pose.y, 2904, pose.y, 2904, pose.y]],
        { width: 1.5, color: '#88d8a7', dash: [7, 6] });
    ctx.endLayer();
    const x = PEAK.x + 260, y = pose.y - 17;
    if (pose.check > 0) {
        ctx.beginLayer({ key: 'graph-target-check', blend: 'add', opacity: 1 - pose.pending });
        ctx.strokePath([x - 5, y], [[x - 5, y, x - 1, y + 4, x - 1, y + 4],
            [x - 1, y + 4, x + 8, y - 7, x + 8, y - 7]],
        { width: 3, color: '#55f49c', cap: 'round' }, { trim: [0, pose.check] });
        ctx.endLayer();
    }
    if (pose.pending > 0) {
        ctx.beginLayer({ key: 'graph-target-pending', opacity: pose.pending * pulse });
        const k = 3.866;
        ctx.strokePath([x + 7, y], [
            [x + 7, y + k, x + k, y + 7, x, y + 7],
            [x - k, y + 7, x - 7, y + k, x - 7, y],
            [x - 7, y - k, x - k, y - 7, x, y - 7],
            [x + k, y - 7, x + 7, y - k, x + 7, y],
        ], { width: 2, color: '#88d8a7' });
        ctx.endLayer();
    }
}
