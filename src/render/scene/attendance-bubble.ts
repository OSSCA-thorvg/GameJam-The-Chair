import { translate, type Message } from '../../i18n';
import type { RenderCtx } from '../context';
import type { Vector } from '../types';
import { PathBuilder, push } from './opening/shapes';

// The worker's laptop answers the cameras just before stage five: a tail-less bubble like the opening's,
// a ThorVG path in screen space with its words on the label canvas.
export const ATTENDANCE = {
    /** Seconds before stage five starts that the bubble pops up, at the end of the stage four reveal. */
    lead: 1.2,
    /** Seconds after it appears that it starts to fade, and how long the fade takes; stage five is running by then. */
    fade: 3, out: .6,
};

const TYPE_SPEED = 28;
const easeOutBack = (u: number) => 1 + 2.4 * (u - 1) ** 3 + 1.4 * (u - 1) ** 2;

/** A rounded box, grown from `anchor` by `scale` as it pops up. */
function bubblePath(anchor: Vector, x: number, y: number, w: number, h: number, size: number, scale: number) {
    const s = (px: number, py: number): Vector => [anchor[0] + (px - anchor[0]) * scale, anchor[1] + (py - anchor[1]) * scale];
    const r = Math.min(h / 2, size * .9);
    return new PathBuilder(...s(x + r, y))
        .line(...s(x + w - r, y)).corner(...s(x + w, y), ...s(x + w, y + r))
        .line(...s(x + w, y + h - r)).corner(...s(x + w, y + h), ...s(x + w - r, y + h))
        .line(...s(x + r, y + h)).corner(...s(x, y + h), ...s(x, y + h - r))
        .line(...s(x, y + r)).corner(...s(x, y), ...s(x + r, y));
}

/** Draws "Attendance confirmed." over the worker's head, `age` seconds after it appeared, just above `anchor`. */
export function attendanceBubble(ctx: RenderCtx, anchor: Vector, age: number, message: Message = 'orbit.attendance') {
    if (age < 0 || age > ATTENDANCE.fade + ATTENDANCE.out) return;
    const alpha = 1 - ctx.clamp((age - ATTENDANCE.fade) / ATTENDANCE.out, 0, 1);
    const lg = ctx.lg, size = ctx.clamp(ctx.W / 46, 13, 20);
    const text = translate(message, ctx.locale);
    lg.font = `600 ${size}px system-ui,sans-serif`;
    const w = lg.measureText(text).width + size * 1.8, h = size * 2.5, gap = size * .9;
    const x = ctx.clamp(anchor[0] - w / 2, 10, Math.max(10, ctx.W - 10 - w));
    const y = ctx.clamp(anchor[1] - gap - h, 10, Math.max(10, ctx.H - 10 - h));
    const scale = .45 + .55 * easeOutBack(Math.min(1, age / .22));
    ctx.beginLayer({ key: 'attendance-bubble', opacity: alpha });
    push(ctx, bubblePath(anchor, x, y, w, h, size, scale).command('#ffffff', { width: 2, color: '#2b2f3a', cap: 'round' }));
    ctx.endLayer();
    const shown = [...text].slice(0, Math.max(0, Math.floor(age * TYPE_SPEED))).join('');
    if (!shown) return;
    lg.save();
    lg.globalAlpha = alpha;
    lg.font = `600 ${size * scale}px system-ui,sans-serif`;
    lg.textAlign = 'center';
    lg.textBaseline = 'middle';
    lg.fillStyle = '#2b2f3a';
    const full = lg.measureText(text).width, part = lg.measureText(shown).width;
    lg.fillText(shown, anchor[0] + (x + w / 2 - anchor[0]) * scale - (full - part) / 2, anchor[1] + (y + h / 2 - anchor[1]) * scale);
    lg.restore();
}
