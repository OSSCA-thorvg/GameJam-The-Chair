import { STAGE_THREE } from '../../game/stage3';
import type { RenderCtx } from '../context';

export function rooftopSky(ctx: RenderCtx) {
    const top = -ctx.vertical, bottom = ctx.H / ctx.scale - ctx.vertical;
    ctx.gradientPolygon([[ctx.cam, top], [ctx.cam + ctx.VW, top], [ctx.cam + ctx.VW, bottom], [ctx.cam, bottom]],
        ctx.gradientFill(0, top, 0, bottom, [[0, '#8798b5'], [.45, '#ccb0b9'], [.8, '#f3c8a6'], [1, '#ffddac']]));
    // The skyline recedes in three layers as the chair climbs out of the city.
    for (let layer = 0; layer < 3; layer++) {
        const spacing = 88 + layer * 23, parallax = .12 + layer * .11;
        const offset = ctx.cam * (1 - parallax);
        const first = Math.floor((ctx.cam - offset) / spacing) - 1;
        const horizon = 470 - layer * 28;
        for (let i = first; i < first + Math.ceil(ctx.VW / spacing) + 3; i++) {
            const seed = Math.abs(Math.imul(i + 121, 1597) ^ layer * 157);
            const h = 65 + seed % (120 + layer * 42);
            const x = i * spacing + offset, y = horizon - h, w = spacing * .72;
            ctx.rect(x, y, w, h + 200, ['#bbafb5', '#9c9aa9', '#7c899d'][layer]);
            if (seed % 5 === 0) {
                ctx.rect(x + w * .42, y - 15, w * .2, 16, '#9192a4');
                ctx.rod(x + w * .52, y - 15, x + w * .52, y - 39, 2, '#9192a4');
            }
            if (layer > 0) for (let row = 0; row < 6; row++) for (let col = 0; col < 3; col++) {
                if ((seed + row * 3 + col * 7) % 4 === 0) ctx.rect(x + 10 + col * 16, y + 17 + row * 23, 5, 8, '#efcda0');
            }
        }
    }
    for (let i = -1; i < 7; i++) {
        const x = i * 330 + ctx.cam * .72, y = -350 - ((i + 6) % 3) * 95;
        ctx.effectPath([x - 95, y], [
            [x - 132, y - 10, x - 99, y - 37, x - 53, y - 24],
            [x - 40, y - 68, x + 35, y - 64, x + 54, y - 27],
            [x + 118, y - 35, x + 137, y + 11, x + 69, y + 13],
            [x + 14, y + 23, x - 60, y + 16, x - 95, y],
        ], ctx.gradientFill(0, y - 65, 0, y + 23, [[0, '#fff4df92'], [1, '#fff4df00']]));
    }
}

function wallPanels(ctx: RenderCtx, x: number, y: number, width: number, height: number) {
    ctx.gradientPolygon([[x, y], [x + width, y], [x + width, y + height], [x, y + height]],
        ctx.gradientFill(x, 0, x + width, 0, [[0, '#354c68'], [.3, '#46627f'], [1, '#304660']]));
    const colWidth = 126, rowHeight = 118;
    for (let col = 0; col < width / colWidth; col++) for (let row = 0; row < height / rowHeight; row++) {
        const px = x + 16 + col * colWidth, py = y + 16 + row * rowHeight;
        const w = Math.min(108, x + width - px - 8), h = Math.min(100, y + height - py - 8);
        if (w < 4 || h < 4 || px > ctx.cam + ctx.VW + 20 || px + w < ctx.cam - 20) continue;
        ctx.rect(px - 2, py - 2, w + 4, h + 4, '#58738c');
        ctx.rect(px, py, w, h, '#2d445f');
        ctx.gradientPolygon([[px + 3, py + 3], [px + w, py + 3], [px + w, py + h], [px + 3, py + h]],
            ctx.gradientFill(px, py, px + w, py + h, [[0, '#46607b'], [1, '#3c5571']]));
    }
}

function column(ctx: RenderCtx, x: number, top: number, bottom: number) {
    ctx.rect(x - 5, top, 37, bottom - top, '#243951');
    ctx.rect(x + 1, top, 9, bottom - top, '#637d94');
    ctx.rect(x + 12, top, 11, bottom - top, '#3c526e');
    for (let y = top + 36; y < bottom; y += 142) {
        ctx.rect(x - 11, y, 48, 19, '#5a728b');
        ctx.rod(x - 11, y, x + 37, y, 2, '#7e93a5');
    }
}

export function rooftopWalls(ctx: RenderCtx) {
    wallPanels(ctx, -400, 88, 850, 332);
    ctx.rect(-400, 88, 850, 14, '#273d56');
    ctx.rod(-300, 122, 420, 122, 12, '#8192a4');
    ctx.rod(-300, 118, 420, 118, 3, '#b0b9c4');
    for (let x = -180; x < 430; x += 150) {
        ctx.rect(x - 5, 106, 76, 15, '#26394f');
        ctx.rect(x, 110, 66, 5, '#f8d8a2');
        ctx.gradientPolygon([[x - 4, 121], [x + 70, 121], [x + 117, 312], [x - 51, 312]],
            ctx.gradientFill(0, 121, 0, 312, [[0, '#ffe0a426'], [1, '#ffe0a400']]));
    }
    // Closed equipment cabinets and conduits keep the room visibly unoccupied.
    for (const x of [-110, 218, 341]) {
        ctx.rect(x, 258, 61, 145, '#233a53');
        ctx.rect(x + 4, 262, 53, 137, '#506984');
        ctx.rod(x + 10, 271, x + 10, 386, 2, '#7f92a2');
        ctx.rect(x + 41, 322, 4, 21, '#bcc2bd');
        for (let i = 0; i < 4; i++) ctx.rect(x + 17, 276 + i * 7, 26, 2, '#2d455d');
    }
    column(ctx, 423, 88, 420);
    ctx.rect(365, 202, 85, 218, '#253b52');
    ctx.gradientPolygon([[441, 205], [450, 205], [450, 420], [309, 420]],
        ctx.gradientFill(450, 300, 309, 300, [[0, '#ffe1a6a0'], [1, '#ffe1a600']]));
    ctx.rect(442, 205, 8, 215, '#f7d8a1');

    wallPanels(ctx, 1240, -460, 540, 856);
    column(ctx, 1204, -650, 396);
    column(ctx, 1770, -460, 396);
    // Cable runs terminate at junction boxes instead of looking like extra ledges.
    for (const x of [1450, 1470]) {
        ctx.rod(x, -440, x, 345, 3, '#293e55');
        for (let y = -400; y < 320; y += 100) ctx.rod(x - 5, y, x + 5, y, 2, '#74869a');
    }
    ctx.rect(1434, 296, 48, 42, '#607890');
    ctx.rect(1438, 300, 40, 34, '#405b76');
    ctx.ellipse(1468, 309, 3, 3, '#e7bf7b');
}

function shelf(ctx: RenderCtx, x: number, y: number, width: number) {
    ctx.rect(x, y + 7, width, 13, '#7f91a5');
    ctx.rect(x, y, width, 6, '#f5bf69');
    ctx.rect(x, y, width, 2, '#ffdb9d');
    ctx.rect(x, y + 19, width, 6, '#2c435c');
    for (let bx = x + 22; bx < x + width - 25; bx += 126) {
        ctx.polygon([[bx, y + 25], [bx + 43, y + 25], [bx, y + 72]], '#263e56');
        ctx.rod(bx + 2, y + 65, bx + 38, y + 25, 8, '#627b94');
        ctx.rod(bx, y + 25, bx, y + 67, 6, '#4d6782');
    }
}

export function rooftopPlatforms(ctx: RenderCtx) {
    for (const b of STAGE_THREE.blocks) {
        if (b.x > ctx.cam + ctx.VW + 80 || b.x + b.width < ctx.cam - 80) continue;
        if (b.id === 'shaft-left') continue; // The matching structural column was drawn with the wall.
        if (b.id.endsWith('pad') || b.id === 'duct') {
            shelf(ctx, b.x, b.y, b.width);
            continue;
        }
        if (b.id === 'pipe') {
            ctx.gradientPolygon([[b.x, b.y], [b.x + b.width, b.y], [b.x + b.width, b.y + b.height], [b.x, b.y + b.height]],
                ctx.gradientFill(0, b.y, 0, b.y + b.height, [[0, '#b6bec8'], [.3, '#8799ad'], [1, '#526981']]));
            for (const x of [b.x + 4, b.x + b.width - 8]) {
                ctx.rect(x, b.y, 5, b.height, '#c1c7cb');
                ctx.ellipse(x + 2, b.y + 7, 1.5, 1.5, '#52657a');
            }
            continue;
        }
        if (b.id === 'rail') {
            ctx.rect(b.x, b.y, b.width, b.height, '#71849a');
            ctx.rect(b.x, b.y, b.width, 5, '#f3bf70');
            ctx.rect(b.x + 3, b.y + 6, 4, b.height - 6, '#b3bcc8');
            continue;
        }
        ctx.gradientPolygon([[b.x, b.y], [b.x + b.width, b.y], [b.x + b.width, b.y + b.height], [b.x, b.y + b.height]],
            ctx.gradientFill(0, b.y, 0, b.y + 280, [[0, '#445d79'], [1, '#263e57']]));
        ctx.rect(b.x, b.y, b.width, 7, '#a9b5c3');
        ctx.rect(b.x, b.y, b.width, 2, '#f2c382');
        ctx.rect(b.x, b.y + 13, b.width, 8, '#253a51');
        if (b.id === 'practice') {
            for (let x = b.x + 14; x < b.x + b.width - 8; x += 16) ctx.rect(x, b.y + 27, 5, b.height - 45, '#7890a6');
        } else {
            for (let x = Math.max(b.x + 18, Math.floor(ctx.cam / 86) * 86); x < Math.min(b.x + b.width - 54, ctx.cam + ctx.VW + 80); x += 86) {
                for (let row = 0; row < 9; row++) {
                    const y = b.y + 37 + row * 63;
                    ctx.rect(x, y, 55, 37, '#1f344c');
                    ctx.rect(x + 4, y + 4, 47, 29, (Math.floor(x / 86) + row) % 4 === 0 ? '#d4b491' : '#62778f');
                    ctx.rect(x + 25, y + 3, 4, 31, '#344d68');
                }
            }
        }
    }
}
