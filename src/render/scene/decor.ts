import { LEVEL } from '../../game/level';
import type { RenderCtx } from '../context';

export function plant(ctx: RenderCtx, x: number) {
    // Monstera deliciosa variegata: white pot, moss pole, big split variegated leaves.
    const F = ctx.F;
    ctx.ellipse(x + 2, F - 10, 20, 3.2, '#515c6d40');
    // White ceramic pot with subtle rim and cream shadow.
    ctx.rect(x - 14, F - 40, 28, 30, '#f2efe6');
    ctx.rect(x - 14, F - 40, 28, 3, '#ffffff');
    ctx.rect(x + 8, F - 37, 6, 25, '#dcd6c6');
    ctx.rect(x - 12, F - 42, 24, 3, '#4a3a2c');
    // Moss pole rising from the pot.
    ctx.rod(x - 1, F - 42, x - 1, F - 110, 6, '#6b5436');
    ctx.rod(x - 1, F - 42, x - 1, F - 110, 3, '#4e3d26');
    // Leaf palette: deep green with cream variegation.
    const green = '#3f6b3a';
    const greenHi = '#5a8a4a';
    const cream = '#e8e4b8';
    // Draw a leaf: elongated heart shape with fenestrations (splits) and a cream variegated patch.
    const drawLeaf = (cx: number, cy: number, len: number, wid: number, angle: number, flip: number, base: string, hi: string) => {
        const c = Math.cos(angle), s = Math.sin(angle);
        const rot = (lx: number, ly: number): [number, number] => [cx + (lx * c - ly * flip * s), cy + (lx * s + ly * flip * c)];
        // Main leaf blade (rounded diamond).
        ctx.polygon([
            rot(0, 0),
            rot(len * .35, -wid),
            rot(len * .7, -wid * .85),
            rot(len, 0),
            rot(len * .7, wid * .85),
            rot(len * .35, wid),
        ], base);
        // Highlight / variegated cream splash near the mid-rib.
        ctx.polygon([
            rot(len * .25, -wid * .15),
            rot(len * .55, -wid * .55),
            rot(len * .7, -wid * .1),
            rot(len * .55, wid * .25),
            rot(len * .35, wid * .3),
        ], hi);
        ctx.polygon([
            rot(len * .45, wid * .1),
            rot(len * .65, wid * .5),
            rot(len * .8, wid * .15),
            rot(len * .6, -wid * .05),
        ], cream);
        // Fenestrations: cut two notches from leaf edge toward midrib using pot/background color.
        const bg = '#a0a7b1';
        ctx.polygon([rot(len * .4, -wid), rot(len * .5, -wid * .35), rot(len * .6, -wid)], bg);
        ctx.polygon([rot(len * .45, wid), rot(len * .55, wid * .35), rot(len * .65, wid)], bg);
        ctx.rod(cx, cy, rot(len * .95, 0)[0], rot(len * .95, 0)[1], 1.2, '#2e4f2a');
    };
    // Six leaves arranged around the moss pole at different heights and angles.
    drawLeaf(x - 1, F - 55, 26, 13, -2.5, 1, green, greenHi);
    drawLeaf(x - 1, F - 60, 28, 14, -0.65, 1, green, greenHi);
    drawLeaf(x - 1, F - 78, 30, 15, -2.3, 1, greenHi, cream);
    drawLeaf(x - 1, F - 82, 30, 15, -0.85, 1, green, greenHi);
    drawLeaf(x - 1, F - 100, 24, 12, -2.0, 1, green, greenHi);
    drawLeaf(x - 1, F - 104, 26, 13, -1.15, 1, greenHi, cream);
    // Top crown leaf pointing up.
    drawLeaf(x - 1, F - 108, 20, 10, -1.57, 1, green, greenHi);
}

export function desk(ctx: RenderCtx, x: number) {
    const F = ctx.F;
    const C = ctx.C;
    ctx.ellipse(x + 10, F - 25, 8, 2.1, '#515c6d46');
    ctx.ellipse(x + 128, F - 25, 8, 2.1, '#515c6d46');
    ctx.rect(x, F - 105, 140, 9, C.wood);
    ctx.rod(x + 10, F - 95, x + 10, F - 25, 6, C.steel);
    ctx.rod(x + 128, F - 95, x + 128, F - 25, 6, C.steel);
    ctx.rect(x + 45, F - 165, 53, 40, '#495569');
    const phase = ctx.monitors.find(monitor => monitor.desk === x);
    const screenColor = phase?.active ? '#fff4bb' : phase?.warning ? '#e9c98e' : '#9db6c4';
    ctx.rect(x + 50, F - 160, 43, 30, screenColor);
    const flicker = .78 + .22 * Math.sin(ctx.t * 7 + x * .013);
    const glowColor = phase?.active ? '#fff4bb' : phase?.warning ? '#e9c98e' : '#9ec3d8';
    ctx.gradientPolygon(
        // The glow starts at the screen's own edges (x + 50 to x + 93) and spreads toward the desk.
        [[x + 50, F - 158], [x + 93, F - 158], [x + 128, F - 108], [x + 15, F - 108]],
        ctx.gradientFill(x + 71, F - 160, x + 71, F - 108, [[0, glowColor], [1, glowColor + '00']], flicker * (phase?.active ? .55 : .3))
    );
    ctx.rect(x + 52, F - 158, 39, 2, ctx.tint('#ffffff', flicker * .35));
    ctx.rod(x + 70, F - 125, x + 70, F - 110, 5, C.steel);
    // The monitor's foot rests right on the desktop (F - 105) instead of hovering a little above it.
    ctx.rect(x + 40, F - 110, 63, 5, '#526274');
}

export function binBack(ctx: RenderCtx) {
    const F = ctx.F;
    const bin = ctx.bin;
    ctx.rect(bin.a - 8, F - 16, 176, 10, '#5b6e70');
    ctx.polygon([[bin.a + 5, F - 7], [bin.b - 5, F - 7], [bin.b - 16, bin.bottom], [bin.a + 16, bin.bottom]], '#687b7d');
    ctx.ellipse(bin.x, F - 8, 79, 12, '#303d44');
}

export function binFront(ctx: RenderCtx) {
    const F = ctx.F;
    const bin = ctx.bin;
    ctx.polygon([[bin.a + 5, F + 3], [bin.b - 5, F + 3], [bin.b - 16, bin.bottom], [bin.a + 16, bin.bottom]], '#8d9c96');
    for (let x = bin.a + 23; x < bin.b - 10; x += 18) {
        ctx.rod(x, F + 15, x + 4, bin.bottom - 12, 2, '#6e807c');
    }
    ctx.ellipse(bin.x, F + 3, 78, 7, '#a4b1a5');
    ctx.rect(bin.x - 27, F + 35, 54, 29, '#d7dcc7');
}

export function practiceFloor(ctx: RenderCtx) {
    if (ctx.cam > 340) return;
    const F = ctx.F;
    const C = ctx.C;
    ctx.rect(45, F - 3, 260, 6, '#d2c8a3');
    for (let x = 55; x < 300; x += 26) ctx.rect(x, F + 12, 13, 3, '#e4dabb');
    ctx.polygon([[290, F + 7], [303, F + 14], [290, F + 21]], '#e4dabb');
    const pile = LEVEL.practicePaper;
    if (!ctx.state.lessons.jumped) {
        for (let i = 0; i < 3; i++) ctx.rect(pile.x - pile.width / 2 + i * 3, F - 2 - i * 2, pile.width - i * 4, 2, C.paper);
    }
    if (ctx.practiceBurst > 0) {
        const age = 1.3 - ctx.practiceBurst;
        for (let i = 0; i < 7; i++) {
            ctx.ox = pile.x + (i - 3) * age * 37;
            ctx.oy = F - 9 - Math.sin(age / 1.3 * Math.PI) * (45 + i % 3 * 15);
            ctx.rotation = age * (i % 2 ? 2 : -2);
            ctx.rect(-10, -5, 20, 10, C.paper);
            ctx.rod(-6, -1, 5, -1, 1, '#a2aaa8');
        }
        ctx.ox = ctx.oy = ctx.rotation = 0;
    }
}

export function checkpointFlag(ctx: RenderCtx, x: number, y: number, active: boolean) {
    const raising = active && Math.abs(ctx.p.x - x) < 170 ? ctx.clamp((1.5 - ctx.saveFlash) / .45, 0, 1) : 1;
    const height = active ? 25 + 55 * raising : 25;
    ctx.rod(x, y, x, y - 93, 3, '#677d7e');
    ctx.polygon([[x, y - height], [x + 32, y - height + 10], [x, y - height + 22]], active ? '#b8d6a2' : '#b4bab3');
    if (active) {
        ctx.rod(x + 7, y - height + 10, x + 12, y - height + 15, 2, '#526d66');
        ctx.rod(x + 12, y - height + 15, x + 21, y - height + 6, 2, '#526d66');
    }
    if (ctx.state.lossReason && active) {
        ctx.ellipse(x, y + 4, 27, 5, '#d7cf9b');
    }
}

/**
 * The chair-only sign over a doorway: a chair beside an arrow (`exit`) or up and down arrows (`lift`). `top` is
 * the sign's upper edge; the corridors hang it at 120.
 */
export function chairPictogram(ctx: RenderCtx, x: number, kind: 'exit' | 'lift', top = 120) {
    const y = top;
    ctx.rect(x - 36, y, 72, 43, '#557f78');
    ctx.rect(x - 23, y + 7, 19, 29, '#d5e6da');
    ctx.rect(x - 19, y + 12, 11, 24, '#557f78');
    ctx.rect(x - 18, y + 14, 3, 11, '#e2eee0');
    ctx.rect(x - 18, y + 23, 10, 3, '#e2eee0');
    ctx.rod(x - 13, y + 26, x - 13, y + 30, 2, '#e2eee0');
    ctx.rod(x - 17, y + 30, x - 9, y + 30, 2, '#e2eee0');
    ctx.ellipse(x - 16, y + 33, 1.5, 1.5, '#e2eee0');
    ctx.ellipse(x - 10, y + 33, 1.5, 1.5, '#e2eee0');
    if (kind === 'exit') {
        ctx.rod(x + 3, y + 21, x + 26, y + 21, 4, '#e2eee0');
        ctx.polygon([[x + 18, y + 12], [x + 29, y + 21], [x + 18, y + 30]], '#e2eee0');
    } else {
        ctx.polygon([[x + 5, y + 17], [x + 13, y + 7], [x + 21, y + 17]], '#e2eee0');
        ctx.polygon([[x + 5, y + 26], [x + 13, y + 36], [x + 21, y + 26]], '#e2eee0');
    }
}
