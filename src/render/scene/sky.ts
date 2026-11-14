import { skyPlatforms, STAGE_FOUR } from '../../game/stages/sky/data';
import type { RenderCtx } from '../context';
import { player } from './player';
import { sprayPlume } from './spray';
import { drawSkyReveal } from './sky-reveal';
import { breadCloud as cloud } from './cloud-art';
import { skyCoursePlatform } from './sky-course-art';
import { skyBuilding, skyFlag } from './sky-course-decor';
import { skyKnockKeycaps } from './sky-gear';
import { skyHazardsArt, skyKnockFeathers, skySprayGauge, skyWarningScraps } from './sky-wind';

function atmosphere(ctx: RenderCtx) {
    const top = -ctx.vertical, height = ctx.H / ctx.scale, bottom = top + height;
    ctx.gradientPolygon([[ctx.cam, top], [ctx.cam + ctx.VW, top], [ctx.cam + ctx.VW, bottom], [ctx.cam, bottom]],
        ctx.gradientFill(0, top, 0, bottom, [[0, '#658eaf'], [.48, '#93bdcd'], [1, '#c6d5d6']]));
    for (let i = -2; i < 7; i++) {
        const drift = ctx.cam * .18 + ctx.t * 4;
        const x = ctx.cam + i * 290 - drift % 290;
        // Follow each cloud as it scrolls, so it keeps its own shape after wrapping round.
        const id = i + Math.floor(drift / 290);
        cloud(ctx, x, top + height * (.98 + Math.sin(i * 4) * .065), .8 + (i % 2) * .2, 700 + id * 2, false);
        if (i % 2 === 0) cloud(ctx, x + 110, top + height * .08, .65, 701 + id * 2, false);
    }
}

export function drawSky(ctx: RenderCtx) {
    ctx.commands = [];
    ctx.ox = ctx.oy = ctx.rotation = 0; ctx.localScale = 1;
    const ending = ctx.state.sky.phase === 'reveal' || ctx.state.sky.phase === 'depth';
    if (ending) {
        drawSkyReveal(ctx);
        return;
    }
    atmosphere(ctx);
    skyWarningScraps(ctx);
    skyBuilding(ctx);
    for (const spec of skyPlatforms(ctx.state.sky, ctx.t)) skyCoursePlatform(ctx, spec);
    for (let i = 1; i < STAGE_FOUR.checkpoints.length; i++) {
        const cp = STAGE_FOUR.checkpoints[i];
        if (Math.abs(cp.x - ctx.cam - ctx.VW / 2) > ctx.VW) continue;
        skyFlag(ctx, cp.x, cp.y, i <= ctx.state.checkpoint);
    }
    skyHazardsArt(ctx);
    sprayPlume(ctx);
    // Foreground cloud edges frame open space without hiding the next landing.
    ctx.beginLayer({ key: 'sky-near-clouds', opacity: .75 });
    const bottom = ctx.H / ctx.scale - ctx.vertical;
    cloud(ctx, ctx.cam - 100 - Math.sin(ctx.t * .15) * 25, bottom + 60, 1.45, 901, true);
    cloud(ctx, ctx.cam + ctx.VW + 130, bottom + 45, 1.7, 902, true);
    ctx.endLayer();
    // The chair stays above the near clouds so a falling player is never lost behind them,
    // and its knock feathers and spray gauge sit on top of it — all inside the ThorVG scene.
    player(ctx);
    skyKnockFeathers(ctx);
    skyKnockKeycaps(ctx);
    skySprayGauge(ctx);
}
