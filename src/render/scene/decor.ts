import { LEVEL } from '../../game/level';
import type { RenderCtx } from '../context';

export function plant(ctx: RenderCtx, x: number) {
    const F = ctx.F;
    ctx.ellipse(x + 2, F - 10, 18, 2.8, '#515c6d40');
    ctx.rect(x - 13, F - 40, 26, 30, '#ccc9b5');
    for (let i = 0; i < 5; i++) {
        ctx.rod(x, F - 40, x + (i - 2) * 12, F - 70 - Math.abs(i - 2) * 4, 3, '#6c8267');
        ctx.polygon([[x + (i - 2) * 12, F - 70 - Math.abs(i - 2) * 4], [x + (i - 2) * 18 - 9, F - 98], [x + (i - 2) * 17 + 11, F - 85]], '#83966a');
    }
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
    ctx.rect(x + 50, F - 160, 43, 30, x === ctx.monitor.desk ? (ctx.monitorPhase().active ? '#fff4bb' : ctx.monitorPhase().warning ? '#e9c98e' : '#9db6c4') : '#9db6c4');
    ctx.rod(x + 70, F - 125, x + 70, F - 105, 5, C.steel);
    ctx.rect(x + 40, F - 112, 63, 5, '#526274');
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
