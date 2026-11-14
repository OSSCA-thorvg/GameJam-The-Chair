import { translate, type Message } from '../../i18n';
import type { RenderCtx } from '../context';
import { SPEECH_FONT } from '../fonts';
import type { Vector } from '../types';

export function bubble(ctx: RenderCtx, text: Message, x: number, y: number, width: number, spiky = false, alpha = 1, tail: boolean | 'right' = true) {
    const fill = ctx.tint(spiky ? '#fff1b2' : '#e2e8df', alpha);
    if (spiky) {
        const points: Vector[] = [];
        for (let i = 0; i < 32; i++) {
            const a = i / 32 * Math.PI * 2, r = i % 2 ? .84 : 1;
            points.push([x + Math.cos(a) * width / 2 * r, y + Math.sin(a) * 32 * r]);
        }
        ctx.polygon(points, fill);
    } else {
        ctx.effectPath([x - width / 2 + 12, y - 22], [
            [x + width / 2, y - 22, x + width / 2, y - 22, x + width / 2, y - 10],
            [x + width / 2, y + 22, x + width / 2, y + 22, x + width / 2 - 12, y + 22],
            [x - width / 2, y + 22, x - width / 2, y + 22, x - width / 2, y + 10],
            [x - width / 2, y - 22, x - width / 2, y - 22, x - width / 2 + 12, y - 22],
        ], ctx.gradientFill(x, y - 22, x, y + 22, [[0, '#ffffff'], [1, '#e2e8df']], alpha));
    }
    if (tail) ctx.polygon([[x - 8, y + 20], [x + 9, y + 20], [x + (tail === 'right' ? 18 : -10), y + 36]], fill);
    ctx.label(translate(text, ctx.locale), x, y + 5, 13, ctx.tint('#344955', alpha), SPEECH_FONT);
}
