import { skyPlatforms, skyWind, STAGE_FOUR, type SkyPlatform } from '../../game/stages/sky/data';
import type { RenderCtx } from '../context';
import { player } from './player';
import { sprayPlume } from './spray';
import { billboard } from './sky-art';
import { drawSkyReveal } from './sky-reveal';

function cloud(ctx: RenderCtx, x: number, y: number, size: number, near: boolean) {
    ctx.ox = x; ctx.oy = y; ctx.localScale = size;
    ctx.effectPath([-160, 12], [
        [-185, -9, -151, -35, -112, -29], [-123, -74, -49, -101, -18, -64],
        [12, -116, 86, -94, 91, -46], [131, -65, 189, -28, 160, 4],
        [123, 38, -109, 47, -160, 12],
    ], ctx.gradientFill(0, -100, 0, 45, [[0, near ? '#fbebdbed' : '#f5e6deaa'], [.45, '#dfc7ce99'], [1, '#a6b7d100']]));
    ctx.effectPath([-118, -18], [[-84, -69, -30, -37, -8, -59], [29, -91, 63, -60, 85, -34]],
        ctx.gradientFill(0, -70, 0, 0, [[0, '#fff6e490'], [1, '#fff6e400']]));
    ctx.ox = ctx.oy = 0; ctx.localScale = 1;
}

function atmosphere(ctx: RenderCtx) {
    const top = -ctx.vertical, height = ctx.H / ctx.scale, bottom = top + height;
    ctx.gradientPolygon([[ctx.cam, top], [ctx.cam + ctx.VW, top], [ctx.cam + ctx.VW, bottom], [ctx.cam, bottom]],
        ctx.gradientFill(0, top, 0, bottom, [[0, '#658eaf'], [.48, '#93bdcd'], [1, '#c6d5d6']]));
    ctx.beginLayer({ key: 'sky-sun', blend: 'screen' });
    ctx.gradientPolygon([[ctx.cam, top], [ctx.cam + ctx.VW, top], [ctx.cam + ctx.VW, bottom], [ctx.cam, bottom]],
        ctx.radialFill(ctx.cam + ctx.VW * .78, top + height * .2, height * .8, [[0, '#ffdfb549'], [.5, '#fff2db15'], [1, '#fff2db00']]));
    ctx.endLayer();
    // Small, low-contrast buildings are seen through gaps far BELOW the furniture.
    ctx.beginLayer({ key: 'sky-distant-city', opacity: .25, blur: 1.1 });
    const cityY = bottom - height * .035;
    for (let i = -10; i < 11; i++) {
        const x = ctx.cam + ctx.VW * .52 + i * 12 - (ctx.cam * .04 % 12);
        const h = 6 + (Math.sin(i * 7.2) * .5 + .5) * 24;
        ctx.rect(x, cityY - h, 8, h, '#7c9eae');
        ctx.polygon([[x, cityY - h], [x + 3, cityY - h - 2], [x + 10, cityY - h - 2], [x + 8, cityY - h]], '#b1c4ca');
    }
    ctx.endLayer();
    ctx.beginLayer({ key: 'sky-far-clouds', blur: 2 });
    for (let i = -2; i < 7; i++) {
        const x = ctx.cam + i * 290 - (ctx.cam * .18 + ctx.t * 4) % 290;
        cloud(ctx, x, top + height * (.98 + Math.sin(i * 4) * .065), .8 + (i % 2) * .2, false);
        if (i % 2 === 0) cloud(ctx, x + 110, top + height * .08, .65, false);
    }
    ctx.endLayer();
    // Broken wisps, never a solid cloud floor or an apparent landing surface.
    ctx.beginLayer({ key: 'sky-wisps', opacity: .5 });
    for (let i = 0; i < 7; i++) {
        const x = ctx.cam + i * 210 - (ctx.t * (10 + skyWind(ctx.t) * 20) + ctx.cam * .4) % 210;
        const y = top + height * (.26 + (i % 3) * .18);
        ctx.strokePath([x, y], [[x + 25, y - 12, x + 89, y - 7, x + 144, y - 26]], { width: 2, color: '#faf0df66', cap: 'round' });
    }
    ctx.endLayer();
}

function desk(ctx: RenderCtx, width: number, small: boolean, drawer: number) {
    const h = small ? 53 : 82;
    for (const x of [-width / 2 + 19, width / 2 - 22]) {
        ctx.rect(x, 9, 13, h, '#59637c');
        ctx.rect(x, 9, 4, h - 4, '#96a0b4');
        ctx.rect(x - 6, h + 6, 28, 5, '#46546b');
    }
    ctx.rect(-width / 2, -2, width, 10, '#ebbd77');
    ctx.rect(-width / 2, -2, width, 3, '#ffe0a3');
    ctx.rect(-width / 2 + 9, 8, width - 18, 18, '#737a91');
    const dx = width / 2 - 82 + drawer * 48;
    ctx.rect(dx, 13, 65, 27, '#8991a8');
    ctx.rect(dx + 23, 22, 21, 3, '#424d66');
    if (drawer > 0) ctx.polygon([[dx, 13], [dx + 65, 13], [dx + 49, 5], [dx - 16, 5]], '#b8adac');
}

function platform(ctx: RenderCtx, spec: SkyPlatform) {
    if (spec.x > ctx.cam + ctx.VW + 200 || spec.x + spec.width < ctx.cam - 200) return;
    ctx.ox = spec.x + spec.width / 2; ctx.oy = spec.y; ctx.rotation = spec.angle;
    switch (spec.kind) {
        case 'roof':
            ctx.rect(-spec.width / 2, 0, spec.width, 16, '#9caebd');
            ctx.rect(-spec.width / 2, 0, spec.width, 3, '#f4cb8b');
            ctx.rect(-spec.width / 2 + 8, 16, spec.width - 16, 80, '#405974');
            for (let x = -spec.width / 2 + 25; x < spec.width / 2 - 20; x += 52) ctx.rect(x, 35, 31, 30, '#8a9fae');
            break;
        case 'sill':
            ctx.rect(-spec.width / 2, 0, spec.width, 12, '#b1bdc9');
            ctx.rect(-spec.width / 2, 0, spec.width, 3, '#f4c582');
            ctx.polygon([[-spec.width / 2 + 12, 12], [-spec.width / 2 + 45, 12], [-spec.width / 2 + 12, 45]], '#536d86');
            break;
        case 'sign': billboard(ctx, spec.width, ctx.locale === 'ko' ? '흔들리지 않는 기업' : 'UNSHAKEABLE INC.', true); break;
        case 'desk': desk(ctx, spec.width, false, spec.id === 'drawer-desk' ? ctx.state.sky.drawer : 0); break;
        case 'small-desk': desk(ctx, spec.width, true, 0); break;
        case 'finish': desk(ctx, spec.width, false, 0); break;
    }
    ctx.ox = ctx.oy = ctx.rotation = 0;
}

function growingBuilding(ctx: RenderCtx) {
    const y = -1780 - ctx.state.sky.lift * 80;
    // Four telescoping desk legs terminate in midair, above the little arrival roof.
    for (const x of [3020, 3070, 3360, 3410]) {
        ctx.rect(x, y - 94, 12, -1650 - y, '#485b75');
        ctx.rect(x + 3, y - 46, 4, -1640 - y, '#a7b4c1');
        ctx.rect(x - 7, -1730, 27, 7, '#7e91a5');
    }
    ctx.gradientPolygon([[3000, y - 290], [3450, y - 290], [3450, y - 90], [3000, y - 90]],
        ctx.gradientFill(3000, y, 3450, y, [[0, '#304962'], [.5, '#526b82'], [1, '#354b67']]));
    for (let i = 0; i < 6; i++) {
        ctx.rect(3018 + i * 71, y - 267, 55, 146, '#91a8b2');
        ctx.rect(3023 + i * 71, y - 261, 4, 133, '#c4c4b77d');
        ctx.rod(3018 + i * 71, y - 195, 3073 + i * 71, y - 195, 3, '#455e76');
    }
    const x = 3160;
    ctx.rect(x - 20, y - 145, 70, 7, '#e8bb79');
    ctx.ellipse(x + 5, y - 180, 8, 9, '#d7b191');
    ctx.rect(x - 3, y - 170, 17, 23, '#e8e2cc');
    ctx.rect(x + 31, y - 168, 22, 16, '#3c5069');
    ctx.rod(x + 9, y - 160, x + 25, y - 151 + Math.sin(ctx.t * 6) * 3, 4, '#d7b191');
    ctx.rect(3000, y - 296, 450, 6, '#edc88b');
}

function ribbon(ctx: RenderCtx) {
    const wind = skyWind(ctx.t);
    ctx.rod(3475, -2100, 3475, -2245, 4, '#b5bec8');
    ctx.effectPath([3475, -2244], [[3500, -2240 - wind * 12, 3515, -2254 + wind * 14, 3540 + wind * 40, -2240],
        [3520, -2234, 3505, -2220, 3475, -2223]], '#dfbd85');
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
    growingBuilding(ctx);
    ribbon(ctx);
    for (const spec of skyPlatforms(ctx.state.sky, ctx.t)) platform(ctx, spec);
    for (let i = 1; i < STAGE_FOUR.checkpoints.length; i++) {
        const cp = STAGE_FOUR.checkpoints[i];
        if (Math.abs(cp.x - ctx.cam - ctx.VW / 2) > ctx.VW) continue;
        ctx.rod(cp.x - 55, cp.y + 28, cp.x - 55, cp.y - 15, 3, '#bbc5c6');
        ctx.polygon([[cp.x - 54, cp.y - 15], [cp.x - 30, cp.y - 9], [cp.x - 54, cp.y - 1]], i <= ctx.state.checkpoint ? '#dfb979' : '#b3c5cc');
    }
    // Loose monitors rotate independently; none sit on an invisible floor.
    for (let i = 0; i < 7; i++) {
        const x = 2580 + i * 430;
        if (x < ctx.cam - 80 || x > ctx.cam + ctx.VW + 80) continue;
        ctx.ox = x; ctx.oy = -1990 - i * 67 + Math.sin(ctx.t * .6 + i) * 15; ctx.rotation = Math.sin(ctx.t * .3 + i) * .19;
        ctx.rect(-22, -16, 44, 30, '#a6afbf'); ctx.rect(-19, -13, 38, 24, '#465b79');
        ctx.rod(0, 14, 0, 23, 4, '#8a9aaf'); ctx.rod(-11, 24, 11, 24, 3, '#aab4c0');
    }
    ctx.ox = ctx.oy = ctx.rotation = 0;
    sprayPlume(ctx); player(ctx);
    // Foreground cloud edges frame open space without hiding the next landing.
    ctx.beginLayer({ key: 'sky-near-clouds', blur: 1.5, opacity: .75 });
    const bottom = ctx.H / ctx.scale - ctx.vertical;
    cloud(ctx, ctx.cam - 100 - Math.sin(ctx.t * .15) * 25, bottom + 60, 1.45, true);
    cloud(ctx, ctx.cam + ctx.VW + 130, bottom + 45, 1.7, true);
    ctx.endLayer();
}
