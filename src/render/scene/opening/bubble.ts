import { translate } from '../../../i18n';
import type { RenderCtx } from '../../context';
import type { Vector } from '../../types';
import type { OpeningBubble, OpeningFrame } from './timeline';
import { SIGN_FONT, SPEECH_FONT, type FontName } from '../../fonts';
import { circle, PathBuilder, push } from './shapes';

// Speech bubbles. The shapes are ThorVG paths in screen space (so they keep their size while the camera
// zooms); the words are ThorVG Text with a typewriter reveal.
//   solid: the office worker, opaque white.
//   glass: the chair daydreaming, translucent white with a soft blurred glow.
//   rage:  the chair snapping, a translucent spiky burst that shakes.

const TYPE_SPEED = 28;

function wrap(measure: (line: string) => number, text: string, maxWidth: number) {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (measure(next) <= maxWidth || !line) line = next;
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
    const base = ctx.clamp(ctx.W / 46, 13, 20);
    const size = bubble.style === 'rage' ? base * 1.3 : base;
    const font: FontName = bubble.style === 'rage' ? SIGN_FONT : SPEECH_FONT;
    const measure = (line: string) => ctx.measureText(line, size, font);
    // No face has a ♪, so a trailing one becomes a drawn note that bobs after the words.
    const message = translate(bubble.message, ctx.locale);
    const note = message.endsWith('♪');
    const noteWidth = note ? size * .8 : 0;
    const lines = wrap(measure, note ? message.slice(0, -1) : message, Math.min(ctx.W - 64, size * (bubble.style === 'rage' ? 10 : 17)));
    const lineWidths = lines.map((line, i) => measure(line) + (i === lines.length - 1 ? noteWidth : 0));
    const lineHeight = size * 1.3;
    const textWidth = Math.max(...lineWidths);
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
    const ink = bubble.style === 'rage' ? '#a8322a' : '#2b2f3a';
    lines.forEach((line, i) => {
        const visible = [...line].slice(0, Math.max(0, shown)).join('');
        shown -= [...line].length + 1;
        if (!visible) return;
        // Keep the line's final position while it types out: anchor the revealed part at the line's left edge.
        const lineY = cy + (i - (lines.length - 1) / 2) * lineHeight * scale;
        const left = cx - lineWidths[i] / 2 * scale;
        ctx.screenText(visible, left + measure(visible) / 2 * scale, lineY, size * scale, ink, { font, opacity: bubble.alpha });
        if (note && i === lines.length - 1 && shown >= 0) {
            drawNote(ctx, `${key}-note`, left + (lineWidths[i] - noteWidth / 2) * scale, lineY, size * scale, ink, bubble.alpha, frame.t);
        }
    });
}

/** An eighth note that hops in time with the chair's good mood. */
function drawNote(ctx: RenderCtx, key: string, x: number, y: number, size: number, ink: string, alpha: number, t: number) {
    const hop = Math.abs(Math.sin(t * 7)) * size * .18;
    const tilt = Math.sin(t * 7) * .12;
    const at = (dx: number, dy: number): Vector => [x + dx * size * Math.cos(tilt) - dy * size * Math.sin(tilt), y - hop + dx * size * Math.sin(tilt) + dy * size * Math.cos(tilt)];
    const head = at(-.14, .28);
    ctx.beginLayer({ key, opacity: alpha });
    push(ctx, circle(head[0], head[1], size * .19, size * .14).command(ink));
    const stem = new PathBuilder(...at(.03, .28)).line(...at(.03, -.42)).line(...at(.11, -.42)).line(...at(.11, .28)).line(...at(.03, .28));
    push(ctx, stem.command(ink));
    const flag = new PathBuilder(...at(.11, -.42))
        .cubic(...at(.2, -.3), ...at(.38, -.22), ...at(.3, .02))
        .cubic(...at(.3, -.14), ...at(.2, -.2), ...at(.11, -.24))
        .line(...at(.11, -.42));
    push(ctx, flag.command(ink));
    ctx.endLayer();
}

export function drawBubbles(ctx: RenderCtx, frame: OpeningFrame) {
    frame.bubbles.forEach((bubble, index) => drawBubble(ctx, frame, bubble, index));
}
