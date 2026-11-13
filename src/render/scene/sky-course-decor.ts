import type { RenderCtx } from '../context';
import { hasWorker, officeWorker } from './sky-office-workers';

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
        for (const [top, floor, row] of [[-267, -197, 0], [-192, -121, 1]] as const) {
            const slot = row * 6 + i + 1;
            const a = y + top, b = y + floor;
            if (!hasWorker(slot)) {
                // Cells nobody works in are plain facade panels.
                ctx.gradientPolygon([[x, a], [x + 55, a], [x + 55, b], [x, b]],
                    ctx.gradientFill(x, a, x + 55, b, [[0, '#4d6680'], [1, '#3a5270']]));
                ctx.rect(x, (a + b) / 2, 55, 1.2, '#304962');
                ctx.rect(x, a, 55, 1.2, '#7e91a566');
                for (const rx of [x + 4, x + 51]) for (const ry of [a + 4, b - 4]) ctx.ellipse(rx, ry, 1.2, 1.2, '#7e91a5');
                continue;
            }
            // A warm, lit office behind the glass, its worker, then the tinted pane over them.
            ctx.gradientPolygon([[x, a], [x + 55, a], [x + 55, b], [x, b]],
                ctx.gradientFill(x, a, x, b, [[0, '#f3e6c8'], [.7, '#d9c6a0'], [1, '#b7a07c']]));
            ctx.rect(x, b - 14, 55, 14, '#a8957a');
            ctx.rect(x + 8, a + 1, 39, 2, '#fffbea');
            officeWorker(ctx, slot, x, b);
            ctx.gradientPolygon([[x, a], [x + 55, a], [x + 55, b], [x, b]],
                ctx.gradientFill(x, a, x + 55, b, [[0, '#91a8b255'], [.55, '#7e91a533'], [1, '#526b8266']]));
            ctx.polygon([[x + 3, a + 4], [x + 24, a + 4], [x + 6, b - 20], [x + 3, b - 20]], '#ffffff2e');
            ctx.polygon([[x + 36, a + 4], [x + 48, a + 4], [x + 20, b - 4], [x + 9, b - 4]], '#ffffff1a');
            ctx.rod(x + 1, a + 1, x + 1, b - 1, 1.5, '#a7b4c1');
        }
        ctx.rect(x, y - 197, 55, 5, '#455e76');
        ctx.rect(x + 3, y - 125, 50, 3, '#304962');
        ctx.rect(x + 4, y - 108, 16, 1, '#7e91a5');
    }
    ctx.gradientPolygon([[3000, y - 296], [3450, y - 296], [3450, y - 290], [3000, y - 290]],
        ctx.gradientFill(0, y - 296, 0, y - 290, [[0, '#edc88b'], [1, '#7e91a5']]));
    ctx.rect(3000, y - 296, 450, 1.5, '#e8e2cc');
    for (const x of [3009, 3441]) for (const offset of [-281, -111]) {
        ctx.ellipse(x, y + offset, 2, 2, '#304962');
        ctx.ellipse(x - .5, y + offset - .5, .8, .8, '#a7b4c1');
    }
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
