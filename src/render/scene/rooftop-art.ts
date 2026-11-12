import { STAGE_THREE } from '../../game/stages/rooftop/data';
import type { RenderCtx } from '../context';
import { CLOUD_TONES, puffCloud } from './cloud-art';

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
    ctx.beginLayer({ key: 'rooftop-clouds' });
    for (let i = -1; i < 7; i++) {
        const x = i * 330 + ctx.cam * .72, y = -360 - ((i + 6) % 3) * 95;
        puffCloud(ctx, x, y, .72 + ((i + 6) % 4) * .07, 300 + i, CLOUD_TONES.dusk, { alpha: .62, fade: true });
    }
    ctx.endLayer();
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

// Lamps stay inside the machine room; the last one used to hang past the wall into the sky.
const CEILING_LAMPS = [-180, -30, 120, 270];

// Drawn after the entrance door and cabinets so the beams fall across them instead of being cut off.
export function rooftopCeilingLight(ctx: RenderCtx) {
    for (const x of CEILING_LAMPS) {
        ctx.gradientPolygon([[x - 4, 121], [x + 70, 121], [x + 117, 312], [x - 51, 312]],
            ctx.gradientFill(0, 121, 0, 312, [[0, '#ffe0a426'], [1, '#ffe0a400']]));
    }
}

export function rooftopWalls(ctx: RenderCtx) {
    wallPanels(ctx, -400, 88, 850, 332);
    ctx.rect(-400, 88, 850, 14, '#273d56');
    ctx.rod(-300, 122, 420, 122, 12, '#8192a4');
    ctx.rod(-300, 118, 420, 118, 3, '#b0b9c4');
    for (const x of CEILING_LAMPS) {
        ctx.rect(x - 5, 106, 76, 15, '#26394f');
        ctx.rect(x, 110, 66, 5, '#f8d8a2');
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

    // The shaft walls run up to a concrete ceiling; the chair's head just fits under it.
    wallPanels(ctx, 1240, -556, 540, 952);
    column(ctx, 1204, -650, 396);
    column(ctx, 1770, -144, 396);
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

// A lagged steam main sticking out of the wall: round body, flanges and a wall bracket.
// `from` is 1 when it leaves the left wall, -1 for the right wall.
function steamPipe(ctx: RenderCtx, x: number, y: number, width: number, height: number, from: number) {
    ctx.gradientPolygon([[x, y], [x + width, y], [x + width, y + height], [x, y + height]],
        ctx.gradientFill(0, y, 0, y + height, [[0, '#d5dbe1'], [.3, '#a3b0bf'], [.75, '#617389'], [1, '#3f5068']]));
    ctx.rect(x, y + 2, width, 2, '#eef2f5');
    for (let fx = x + 14; fx < x + width - 8; fx += 34) {
        ctx.rect(fx, y - 2, 6, height + 4, '#8697ab');
        ctx.rect(fx + 1, y - 2, 2, height + 4, '#c4ccd5');
    }
    // The free end is capped; the wall end sits on a bracket.
    const cap = from > 0 ? x + width : x;
    ctx.rect(cap - 3, y - 3, 6, height + 6, '#5d6f86');
    const wall = from > 0 ? x : x + width;
    ctx.polygon([[wall, y + height], [wall + from * 22, y + height], [wall, y + height + 22]], '#33485f');
    // A pressure gauge in the red: the whole shaft is under pressure.
    const gx = x + width / 2;
    ctx.rod(gx, y, gx, y - 7, 3, '#5d6f86');
    ctx.ellipse(gx, y - 12, 6, 6, '#e9e4d6');
    ctx.rod(gx, y - 12, gx + 3.5, y - 15.5, 1.5, '#c8352b');
}

// The roof edge parapet: concrete with a hazard-striped cap, leaving only a slot under the ceiling.
function parapet(ctx: RenderCtx, x: number, y: number, width: number, height: number) {
    ctx.gradientPolygon([[x, y], [x + width, y], [x + width, y + height], [x, y + height]],
        ctx.gradientFill(x, 0, x + width, 0, [[0, '#8091a5'], [.5, '#5b6f88'], [1, '#3c516a']]));
    ctx.rect(x - 3, y - 6, width + 6, 8, '#f3bf70');
    for (let sy = y + 8; sy < y + 40; sy += 12) ctx.polygon([[x, sy], [x + width, sy - 6], [x + width, sy], [x, sy + 6]], '#f2c14e');
    for (let sy = y + 50; sy < y + height - 10; sy += 46) ctx.rect(x + 3, sy, width - 6, 3, '#2f455c');
}

// Concrete ceiling over the duct shaft, with a dim caged lamp.
function shaftCeiling(ctx: RenderCtx) {
    ctx.gradientPolygon([[1200, -640], [1806, -640], [1806, -552], [1200, -552]],
        ctx.gradientFill(0, -640, 0, -552, [[0, '#2a3e55'], [1, '#4f6782']]));
    ctx.rect(1200, -556, 606, 4, '#8193a6');
    for (let x = 1236; x < 1800; x += 96) ctx.rect(x, -552, 4, 10, '#2d4258');
    ctx.rod(1510, -552, 1510, -536, 2, '#3a4f66');
    ctx.ellipse(1510, -530, 7, 6, '#f6d79c');
    ctx.gradientPolygon([[1503, -526], [1517, -526], [1560, -430], [1460, -430]],
        ctx.gradientFill(0, -526, 0, -430, [[0, '#ffe2a640'], [1, '#ffe2a600']]));
}

export function rooftopPlatforms(ctx: RenderCtx) {
    shaftCeiling(ctx);
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
        if (b.id.startsWith('pipe-')) {
            steamPipe(ctx, b.x, b.y, b.width, b.height, b.x <= 1240 ? 1 : -1);
            continue;
        }
        if (b.id === 'parapet') {
            parapet(ctx, b.x, b.y, b.width, b.height);
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
