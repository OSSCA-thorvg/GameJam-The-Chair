import { STAGE_THREE } from '../../game/stages/rooftop/data';
import { STAGE_FOUR } from '../../game/stages/sky/data';
import type { RenderCtx } from '../context';
import { blendCloudTone, CLOUD_TONES, puffCloud, seeded } from './cloud-art';

type Placement = { x: number; y: number; size: number; seed: number };

// A loose, uneven scatter along the climb: random spots that keep a minimum distance from each other,
// so there are no rows or columns and plenty of open sky. Fixed, so the scatter never reshuffles.
const SPREAD = 960;
const ASCENT: readonly Placement[] = (() => {
    const random = seeded(4242);
    const placements: Placement[] = [];
    for (let tries = 0; placements.length < 13 && tries < 600; tries++) {
        const x = random(), y = -800 - random() * 1250;
        const crowded = placements.some(c => Math.hypot((c.x - x) * SPREAD * .7, c.y - y) < 280);
        if (!crowded) placements.push({ x, y, size: .6 + random() * .55, seed: 500 + placements.length });
    }
    return placements;
})();

const GRAPH_END = STAGE_THREE.graph.points[STAGE_THREE.graph.points.length - 1];
const ASCENT_START_Y = GRAPH_END.y - 28;

function ascentTone(ctx: RenderCtx) {
    const progress = ctx.clamp((ASCENT_START_Y - ctx.p.y) / (ASCENT_START_Y - STAGE_FOUR.arrivalY), 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    return blendCloudTone(CLOUD_TONES.ascent, CLOUD_TONES.bread, eased);
}

// The clouds the chair punches through on its climb from the rooftop.
export function ascentClouds(ctx: RenderCtx) {
    ctx.beginLayer({ key: 'ascent-clouds' });
    const tone = ascentTone(ctx);
    for (const c of ASCENT) {
        puffCloud(ctx, ctx.cam - 120 + c.x * (ctx.VW + 240), c.y, c.size, c.seed, tone, { alpha: .62 });
    }
    ctx.endLayer();
}

export { drawSky as drawCloudStart } from './sky';
