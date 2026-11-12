import { translate } from '../../../i18n';
import type { RenderCtx } from '../../context';
import type { Vector } from '../../types';
import type { OpeningBubble, OpeningFrame } from './timeline';
import { PathBuilder, push } from './shapes';

// Speech bubbles. The shapes are ThorVG paths in screen space (so they keep their size while the camera
// zooms); the words go on the label canvas with a typewriter reveal.
//   solid: the office worker, opaque white.
//   glass: the chair daydreaming, translucent white with a soft blurred glow.
//   rage:  the chair snapping, a translucent spiky burst that shakes.

const TYPE_SPEED = 28;

function wrap(lg: CanvasRenderingContext2D, text: string, maxWidth: number) {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (lg.measureText(next).width <= maxWidth || !line) line = next;
        else {
            lines.push(line);
            line = word;
        }
    }
    if (line) lines.push(line);
    return lines;
}

const easeOutBack = (u: number) => 1 + 2.4 * (u - 1) ** 3 + 1.4 * (u - 1) ** 2;

export function bubbleAnchor(ctx: RenderCtx, bubble: OpeningBubble): Vector {
    const p = ctx.p;
    return bubble.speaker === 'rider' ? ctx.screenPoint(p.x + 2, p.y - 104) : ctx.screenPoint(p.x - 38, p.y - 44);
}

function drawBubble(ctx: RenderCtx, frame: OpeningFrame, bubble: OpeningBubble, index: number) {
    const lg = ctx.lg;
    const base = ctx.clamp(ctx.W / 46, 13, 20);
    const size = bubble.style === 'rage' ? base * 1.3 : base;
    const weight = bubble.style === 'rage' ? '800' : bubble.style === 'glass' ? '500' : '600';
    lg.font = `${weight} ${size}px system-ui,sans-serif`;
    const text = translate(bubble.message, ctx.locale);
    const lines = wrap(lg, text, Math.min(ctx.W - 64, size * (bubble.style === 'rage' ? 10 : 17)));
    const lineHeight = size * 1.3;
    const textWidth = Math.max(...lines.map(line => lg.measureText(line).width));
    const padX = size * .9, padY = size * .6;
    const w = textWidth + padX * 2, h = lines.length * lineHeight + padY * 2;
    const tip = bubbleAnchor(ctx, bubble);
    // The worker's bubble sits over his head; the chair's floats up and left of its backrest.
    const gap = bubble.style === 'solid' ? size * .9 : size * 2.2;
    // The burst keeps clear of the worker's face: it goes fully left of the backrest.
    let x = bubble.speaker === 'rider' ? tip[0] - w / 2 : bubble.style === 'rage' ? tip[0] - w - size * 1.6 : tip[0] - w * .8;
    let y = tip[1] - gap - h;
    if (bubble.style === 'rage') {
        x = Math.max(x, size * 1.4);
        y = Math.max(tip[1] - h - size * 3.4, size * 1.4);
    }
    x = ctx.clamp(x, 10, Math.max(10, ctx.W - 10 - w));
    y = ctx.clamp(y, 10, Math.max(10, ctx.H - 10 - h));
    if (bubble.style === 'rage') {
        x += Math.sin(frame.t * 70) * 2;
        y += Math.cos(frame.t * 57) * 2;
    }
    const scale = .45 + .55 * easeOutBack(Math.min(1, bubble.age / .22));
    const grow = ([px, py]: Vector): Vector => [tip[0] + (px - tip[0]) * scale, tip[1] + (py - tip[1]) * scale];

    let path: PathBuilder;
    if (bubble.style === 'rage') {
        // Spiky burst; the spike nearest the speaker stretches into the tail.
        const cx = x + w / 2, cy = y + h / 2, rx = w / 2 + size * 1.1, ry = h / 2 + size * 1.1;
        const count = 26;
        const boil = Math.floor(frame.t * 14);
        const toTip = Math.atan2((tip[1] - cy) / ry, (tip[0] - cx) / rx);
        let tail = 0, best = Infinity;
        for (let i = 0; i < count; i += 2) {
            const d = Math.abs(Math.atan2(Math.sin(i / count * ctx.TAU - toTip), Math.cos(i / count * ctx.TAU - toTip)));
            if (d < best) { best = d; tail = i; }
        }
        const points: Vector[] = [];
        for (let i = 0; i < count; i++) {
            const a = i / count * ctx.TAU;
            const jitter = ((Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(boil, 0x85ebca6b)) >>> 0) % 100 / 100;
            const r = i % 2 === 0 ? 1.12 + jitter * .12 : .84;
            points.push(i === tail ? tip : [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
        }
        const scaled = points.map(grow);
        path = new PathBuilder(...scaled[0]);
        for (const point of scaled.slice(1)) path.line(...point);
        path.line(...scaled[0]);
    } else {
        const r = Math.min(h / 2, size * .9);
        const tw = Math.min(size * .8, w / 4);
        const tailX = ctx.clamp(tip[0], x + r + tw, x + w - r - tw);
        const s = (px: number, py: number) => grow([px, py]);
        path = new PathBuilder(...s(x + r, y))
            .line(...s(x + w - r, y)).corner(...s(x + w, y), ...s(x + w, y + r))
            .line(...s(x + w, y + h - r)).corner(...s(x + w, y + h), ...s(x + w - r, y + h))
            .line(...s(tailX + tw, y + h))
            .cubic(...s(tailX + tw * .5, y + h + gap * .4), ...s(tip[0], tip[1] - gap * .3), ...tip)
            .cubic(...s(tailX - tw * .2, y + h + gap * .5), ...s(tailX - tw * .6, y + h + gap * .1), ...s(tailX - tw, y + h))
            .line(...s(x + r, y + h)).corner(...s(x, y + h), ...s(x, y + h - r))
            .line(...s(x, y + r)).corner(...s(x, y), ...s(x + r, y));
    }

    const key = `opening-bubble-${index}`;
    if (bubble.style === 'glass') {
        ctx.beginLayer({ key: `${key}-glow`, blur: size * .45, opacity: .55 * bubble.alpha });
        push(ctx, path.command('#ffffff'));
        ctx.endLayer();
    }
    const fill = bubble.style === 'solid' ? '#ffffff' : bubble.style === 'glass' ? '#ffffffa8' : '#fffaf2c4';
    const stroke = bubble.style === 'solid'
        ? { width: 2, color: '#2b2f3a' }
        : bubble.style === 'glass'
            ? { width: 1.5, color: '#ffffffe6' }
            : { width: 3, color: '#c8443a' };
    ctx.beginLayer({ key, opacity: bubble.alpha });
    push(ctx, path.command(fill, { ...stroke, cap: 'round' }));
    ctx.endLayer();

    // Words, revealed a few characters at a time.
    let shown = Math.floor(bubble.age * TYPE_SPEED * (bubble.style === 'rage' ? 2 : 1));
    const [cx, cy] = grow([x + w / 2, y + h / 2]);
    lg.save();
    lg.globalAlpha = bubble.alpha;
    lg.font = `${weight} ${size * scale}px system-ui,sans-serif`;
    lg.textAlign = 'center';
    lg.textBaseline = 'middle';
    lg.fillStyle = bubble.style === 'rage' ? '#a8322a' : '#2b2f3a';
    lines.forEach((line, i) => {
        const visible = [...line].slice(0, Math.max(0, shown)).join('');
        shown -= [...line].length + 1;
        if (!visible) return;
        // Keep the line's final position while it types out: pad the measured width on the right.
        const full = lg.measureText(line).width;
        const part = lg.measureText(visible).width;
        lg.fillText(visible, cx - (full - part) / 2, cy + (i - (lines.length - 1) / 2) * lineHeight * scale);
    });
    lg.restore();
}

export function drawBubbles(ctx: RenderCtx, frame: OpeningFrame) {
    frame.bubbles.forEach((bubble, index) => drawBubble(ctx, frame, bubble, index));
}
