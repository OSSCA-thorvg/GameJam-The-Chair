import type { RenderCtx } from '../context';
import type { Vector } from '../types';
import { LABEL_FONT } from '../fonts';
import { STAGE_FIVE } from '../../game/stages/orbit/data';

const B = STAGE_FIVE.bounds;
/** How far past the bounds the brackets sit, so the whole chair fits inside them: across, above and below. */
const MARGIN = { x: 70, top: 95, bottom: 75 };

const hex = (color: string, alpha: number) => color + Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');

/**
 * The company's viewfinder: red corner brackets round the play area on the chair's plane. They are the geofence the
 * chair cannot leave. Inside a beam they light up and blink, and REC shows: the chair is being recorded.
 * `plane` maps a point on the chair's plane to the screen; `shown` fades the whole thing in and out.
 */
export function orbitViewfinder(ctx: RenderCtx, plane: (x: number, y: number) => Vector, lit: number, shown: number, hitStop = 0) {
    if (shown <= .01) return;
    const [x0, y0] = plane(-B.x - MARGIN.x, B.y + MARGIN.top), [x1, y1] = plane(B.x + MARGIN.x, -B.y - MARGIN.bottom);
    const blink = lit > .1 && Math.sin(ctx.t * 9) > -.2 ? lit : 0;
    const L = Math.min(x1 - x0, y1 - y0) * .1;
    // Caught, the brackets snap white and thick for a moment, like a photo being taken.
    const stroke = hitStop > 0
        ? { width: 3 + 3 * hitStop, color: hex('#ffffff', shown), cap: 'butt' as const }
        : { width: 2 + 1.5 * lit, color: hex('#ff4b52', (.5 + .5 * blink) * shown), cap: 'butt' as const };
    const layer = { key: 'orbit-viewfinder' };
    for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
        ctx.commands.push({ v: [[x, y + sy * L], [x, y], [x + sx * L, y]], c: null, open: true, stroke, layer });
    }
    if (lit <= .1) return;
    const size = ctx.clamp(ctx.H * .032, 11, 18), cx = x0 + L * .5, cy = y0 + L * .75;
    if (blink > 0) {
        const r = size * .32;
        ctx.commands.push({ v: [[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]],
            c: { from: [cx, cy], to: [cx + r, cy], radius: r, stops: [[0, ctx.rgba('#ff4b52', lit * shown)], [.8, ctx.rgba('#ff4b52', lit * shown)], [1, ctx.rgba('#ff4b52', 0)]] }, layer });
    }
    ctx.screenText('REC', cx + size * 1.4, cy, size, '#ffffff', { font: LABEL_FONT, opacity: lit * shown });
}
