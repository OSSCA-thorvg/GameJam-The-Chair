import type { RenderCtx } from '../context';

export function billboard(ctx: RenderCtx, width: number, text: string, label: boolean) {
    ctx.rect(-width / 2 - 5, -8, width + 10, 16, '#b9b6bb');
    ctx.rect(-width / 2, -3, width, 7, '#edc58c');
    ctx.rect(-width / 2 + 5, 9, width - 10, 83, '#424f6d');
    ctx.rect(-width / 2 + 9, 13, width - 18, 73, '#69738c');
    for (const x of [-width / 2 + 30, width / 2 - 34]) {
        ctx.rod(x, 90, x, 124, 8, '#5c6b83');
        ctx.rod(x - 14, 124, x + 16, 124, 6, '#9ca6b2');
    }
    // The unflappable model keeps giving a thumbs-up as the sign rotates.
    ctx.ellipse(width / 2 - 32, 36, 9, 11, '#d8b593');
    ctx.rect(width / 2 - 42, 48, 24, 31, '#e6ddc8');
    ctx.rod(width / 2 - 43, 56, width / 2 - 58, 43, 6, '#d8b593');
    ctx.rod(width / 2 - 58, 43, width / 2 - 58, 34, 5, '#d8b593');
    if (label && Math.abs(ctx.rotation) < .65) {
        const [sx, sy] = ctx.screenPoint(-20, 45);
        ctx.lg.save();
        ctx.lg.translate(sx, sy); ctx.lg.rotate(ctx.rotation);
        ctx.lg.font = `${11 * ctx.scale * ctx.localScale}px system-ui,sans-serif`;
        ctx.lg.fillStyle = '#f7e5c6'; ctx.lg.textAlign = 'center';
        ctx.lg.fillText(text, 0, 0); ctx.lg.restore();
    }
}

