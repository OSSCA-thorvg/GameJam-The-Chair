import { skyWind } from '../../game/stages/sky/data';
import type { RenderCtx } from '../context';

export function skyBuilding(ctx: RenderCtx) {
    if (3450 < ctx.cam - 100 || 3000 > ctx.cam + ctx.VW + 100) return;
    const y = -1780 - ctx.state.sky.lift * 80;
    // Telescoping supports end in midair, above the arrival roof.
    for (const x of [3020, 3070, 3360, 3410]) {
        ctx.gradientPolygon([[x, y - 94], [x + 12, y - 94], [x + 12, -1650], [x, -1650]],
            ctx.gradientFill(x, 0, x + 12, 0, [[0, '#a7b4c1'], [.25, '#485b75'], [1, '#485b75']]));
        ctx.rect(x + 3, y - 46, 4, -1640 - y, '#a7b4c1');
        for (let band = y - 65; band < -1660; band += 38) {
            ctx.rect(x - 2, band, 16, 6, '#7e91a5');
            ctx.ellipse(x + 10, band + 3, 1, 1, '#485b75');
        }
        ctx.rect(x - 7, -1730, 27, 7, '#7e91a5');
        ctx.rod(x - 6, -1730, x + 18, -1730, 1.5, '#a7b4c1');
    }
    ctx.polygon([[3450, y - 290], [3464, y - 279], [3464, y - 79], [3450, y - 90]], '#304962');
    ctx.gradientPolygon([[3000, y - 290], [3450, y - 290], [3450, y - 90], [3000, y - 90]],
        ctx.gradientFill(3000, y, 3450, y, [[0, '#304962'], [.5, '#526b82'], [1, '#354b67']]));
    ctx.rect(3000, y - 290, 450, 8, '#304962');
    ctx.rect(3000, y - 105, 450, 15, '#304962');
    for (let i = 0; i < 6; i++) {
        const x = 3018 + i * 71;
        ctx.rect(x - 3, y - 270, 61, 152, '#304962');
        ctx.gradientPolygon([[x, y - 267], [x + 55, y - 267], [x + 55, y - 121], [x, y - 121]],
            ctx.gradientFill(x, y - 267, x + 55, y - 121, [[0, '#91a8b2'], [.55, '#7e91a5'], [1, '#526b82']]));
        ctx.polygon([[x + 3, y - 263], [x + 26, y - 263], [x + 6, y - 199], [x + 3, y - 199]], '#c4c4b74d');
        ctx.polygon([[x + 35, y - 263], [x + 49, y - 263], [x + 18, y - 126], [x + 6, y - 126]], '#c4c4b726');
        ctx.rod(x, y - 195, x + 55, y - 195, 3, '#455e76');
        ctx.rod(x + 1, y - 266, x + 1, y - 123, 1.5, '#a7b4c1');
        ctx.rect(x + 3, y - 125, 50, 3, '#304962');
        ctx.rect(x + 4, y - 108, 16, 1, '#7e91a5');
    }
    // One unhurried employee keeps typing inside the floating facade.
    const x = 3180;
    ctx.rect(x - 18, y - 145, 50, 5, '#e8bb79');
    ctx.rect(x - 17, y - 140, 3, 17, '#455e76');
    ctx.rect(x + 25, y - 140, 3, 17, '#455e76');
    ctx.ellipse(x + 2, y - 179, 7, 9, '#d7b191');
    ctx.polygon([[x - 6, y - 184], [x - 2, y - 191], [x + 6, y - 188], [x + 9, y - 182], [x + 1, y - 184]], '#3c5069');
    ctx.polygon([[x - 5, y - 170], [x + 7, y - 170], [x + 12, y - 146], [x - 7, y - 146]], '#e8e2cc');
    ctx.rect(x + 2, y - 169, 2, 16, '#455e76');
    ctx.polygon([[x + 13, y - 150], [x + 28, y - 150], [x + 34, y - 168], [x + 20, y - 168]], '#3c5069');
    ctx.polygon([[x + 18, y - 153], [x + 26, y - 153], [x + 30, y - 165], [x + 22, y - 165]], '#91a8b2');
    ctx.rod(x + 4, y - 160, x + 17, y - 150 + Math.sin(ctx.t * 6) * 1.5, 3, '#d7b191');
    ctx.gradientPolygon([[3000, y - 296], [3450, y - 296], [3450, y - 290], [3000, y - 290]],
        ctx.gradientFill(0, y - 296, 0, y - 290, [[0, '#edc88b'], [1, '#7e91a5']]));
    ctx.rect(3000, y - 296, 450, 1.5, '#e8e2cc');
    for (const x of [3009, 3441]) for (const offset of [-281, -111]) {
        ctx.ellipse(x, y + offset, 2, 2, '#304962');
        ctx.ellipse(x - .5, y + offset - .5, .8, .8, '#a7b4c1');
    }
}

export function skyRibbon(ctx: RenderCtx) {
    // The ribbon always streams left, against the course, and snaps out flat in a gust.
    const wind = .35 + skyWind(ctx.t) * .65;
    const flutter = Math.sin(ctx.t * (6 + wind * 10)) * (1 - wind * .6);
    ctx.rod(3475, -2100, 3475, -2245, 5, '#536d86');
    ctx.rod(3474, -2100, 3474, -2245, 2, '#b5bec8');
    ctx.ellipse(3475, -2247, 3.5, 3.5, '#b5bec8');
    ctx.effectPath([3475, -2244], [[3450, -2240 - flutter * 12, 3435, -2254 + flutter * 14, 3410 - wind * 40, -2240 + (1 - wind) * 18],
        [3430, -2234, 3445, -2220, 3475, -2223]], ctx.gradientFill(3475, -2244, 3410, -2223,
        [[0, '#dfbd85'], [.45, '#f4c582'], [1, '#b8adac']]));
    ctx.strokePath([3473, -2241], [[3450, -2238 - flutter * 8, 3432, -2246 + flutter * 8, 3412 - wind * 28, -2239 + (1 - wind) * 14]],
        { width: 1.2, color: '#f7e5c6aa', cap: 'round' });
    ctx.rod(3473, -2237, 3477, -2237, 2, '#69738c');
    ctx.rod(3473, -2227, 3477, -2227, 2, '#69738c');
}

export function skyMonitor(ctx: RenderCtx, index: number) {
    const x = 2580 + index * 430;
    ctx.ox = x; ctx.oy = -1990 - index * 67 + Math.sin(ctx.t * .6 + index) * 15;
    ctx.rotation = Math.sin(ctx.t * .3 + index) * .19;
    ctx.polygon([[-22, -16], [22, -16], [27, -12], [-17, -12]], '#aab4c0');
    ctx.polygon([[22, -16], [27, -12], [27, 17], [22, 14]], '#465b79');
    ctx.gradientPolygon([[-22, -16], [22, -16], [22, 14], [-22, 14]],
        ctx.gradientFill(-22, -16, 22, 14, [[0, '#a6afbf'], [.6, '#aab4c0'], [1, '#8a9aaf']]));
    ctx.rect(-19, -13, 38, 24, '#465b79');
    ctx.gradientPolygon([[-17, -11], [17, -11], [17, 9], [-17, 9]],
        ctx.gradientFill(-17, -11, 17, 9, [[0, '#8a9aaf'], [.4, '#465b79'], [1, '#465b79']]));
    ctx.polygon([[-16, -10], [2, -10], [-9, 8], [-16, 8]], '#aab4c033');
    for (let y = -6; y < 8; y += 5) ctx.rod(-11, y, -3 + y * .3, y, .6, '#aab4c044');
    ctx.ellipse(15, 12, .9, .9, '#aab4c0');
    ctx.rod(0, 15, 0, 23, 4, '#8a9aaf');
    ctx.ellipse(0, 24, 13, 2.5, '#8a9aaf');
    ctx.rod(-10, 23, 10, 23, 1, '#aab4c0');
    ctx.ox = ctx.oy = ctx.rotation = 0;
}

export function skyFlag(ctx: RenderCtx, x: number, y: number, saved: boolean) {
    const color = saved ? '#dfb979' : '#b3c5cc';
    ctx.rod(x - 55, y + 28, x - 55, y - 15, 3, '#bbc5c6');
    ctx.rod(x - 56, y + 27, x - 56, y - 15, .8, '#f7e5c6');
    ctx.ellipse(x - 55, y - 16, 2.5, 2.5, '#bbc5c6');
    // Flags stream back against the course with the headwind.
    const flap = Math.sin(ctx.t * 9 + x) * 2;
    ctx.effectPath([x - 56, y - 15], [[x - 65, y - 19 + flap, x - 71, y - 11 - flap, x - 80, y - 9 + flap],
        [x - 70, y - 7, x - 65, y - 4, x - 56, y - 1]], color);
    ctx.rod(x - 53, y - 13, x - 53, y - 3, 1, '#f7e5c655');
}
