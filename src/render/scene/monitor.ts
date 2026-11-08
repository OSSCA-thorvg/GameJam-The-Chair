import type { RenderCtx } from '../context';

export function monitorDraw(ctx: RenderCtx) {
    const F = ctx.F;
    const TAU = ctx.TAU;
    for (const monitor of ctx.monitors) {
        const x = monitor.x;
        const y = monitor.y;
        if (monitor.active) {
            const age = monitor.phase - .8;
            const u = age / 1.3;
            const envelope = Math.min(1, age / .12, (1.3 - age) / .22);
            const pulse = .82 + .18 * Math.sin(age * TAU * 2);
            const end = monitor.wall;
            const beam = ctx.gradientFill(x, y, end - 35, F, [[0, '#fffbe7cc'], [.22, '#fff3c47c'], [.7, '#f5d79950'], [1, '#f5d79900']], envelope * pulse);
            ctx.gradientPolygon([[x - 18, y - 10], [x + 12, y + 10], [end + 38, F + 14], [end - 144, F - 135]], beam);
            ctx.gradientPolygon([[x - 7, y - 3], [x + 5, y + 5], [end + 8, F + 8], [end - 70, F - 74]], ctx.gradientFill(x, y, end, F, [[0, '#fffdf0ed'], [.4, '#fff6cc98'], [1, '#ffe8a91a']], envelope));
            for (let i = 0; i < 4; i++) {
                const f = (age * 1.15 + i / 4) % 1;
                const xx = x + (end - x) * f;
                const yy = y + (F - y) * f;
                const w = 3 + f * 24;
                const a = Math.sin(f * Math.PI) * envelope;
                ctx.gradientPolygon([[xx - w, yy - 8], [xx + w * .6, yy + 5], [xx + w * .6 - 4, yy + 9], [xx - w - 4, yy - 4]], ctx.gradientFill(xx - w, yy, xx + w, yy, [[0, '#fff8dc00'], [.5, '#fffbe8c0'], [1, '#fff8dc00']], a));
            }
            const glow = 14 + 3 * Math.sin(u * TAU);
            ctx.gradientPolygon([[x - 30, y - 26], [x + 26, y - 26], [x + 26, y + 26], [x - 30, y + 26]], ctx.gradientFill(x - 28, y, x + 28, y, [[0, '#fff6cf00'], [.5, '#fffbe4a0'], [1, '#fff6cf00']], envelope));
            ctx.rod(x - glow, y - 3, x + glow, y - 3, 2, ctx.tint('#fffce7', envelope * .85));
            ctx.gradientPolygon([[end - 80, F - 1], [end + 48, F - 1], [end + 48, F + 17], [end - 80, F + 17]], ctx.gradientFill(end - 80, F, end + 48, F, [[0, '#efd39c00'], [.5, '#fff1c7b0'], [1, '#efd39c00']], envelope * pulse));
        }
        else if (monitor.warning) {
            const charge = monitor.phase / .8;
            for (let i = 0; i < 5; i++) {
                ctx.rect(monitor.wall - 48 + i * 20, F - 2, 9, 3 + charge * 9, ctx.tint('#f1d8a5', .3 + charge * .6));
            }
            ctx.rect(x - 19, y - 12, 32 * charge, 5, '#ead5a4');
            const blink = .45 + .55 * Math.sin(charge * Math.PI * 3) ** 2;
            ctx.ellipse(x - 3, y - 2, 4 + charge * 5, 3 + charge * 3, ctx.tint('#fff4c6', blink * .65));
            ctx.rod(x - 5, y - 21, x - 5, y - 29 - charge * 5, 2, '#dca468');
            ctx.rod(x - 22, y - 16, x - 28 - charge * 4, y - 23, 2, '#dca468');
        }
    }
}
