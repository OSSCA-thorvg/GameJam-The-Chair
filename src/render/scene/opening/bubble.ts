import { circle, PathBuilder, push } from './shapes';
import { translate } from '../../../i18n';
import { SIGN_FONT, SPEECH_FONT } from '../../fonts';

import type { OpeningBubble, OpeningFrame } from './timeline';
import type { RenderCtx } from '../../context';
import type { FontName } from '../../fonts';
import type { Vector } from '../../types';
const TYPE_SPEED = 28;
const CHAIR_SLATE = '#4c5368';
export function wrap(
    measure: (line: string) => number,
    text: string,
    maxWidth: number,
): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (measure(next) <= maxWidth || !line) {
            line = next;
        } else {
            lines.push(line);
            line = word;
        }
    }
    if (line) {
        lines.push(line);
    }
    return lines;
}
const easeOutBack = (u: number) => 1 + 2.4 * (u - 1) ** 3 + 1.4 * (u - 1) ** 2;
export function bubbleAnchor(ctx: RenderCtx, bubble: OpeningBubble): Vector {
    const p = ctx.player;
    return bubble.speaker === 'rider'
        ? ctx.screenPoint(p.x + 2, p.y - 104)
        : ctx.screenPoint(p.x - 38, p.y - 44);
}
function drawBubble(
    ctx: RenderCtx,
    frame: OpeningFrame,
    bubble: OpeningBubble,
    index: number,
) {
    return new BubbleDrawing(ctx, frame, bubble, index).run();
}
function drawNote(
    ctx: RenderCtx,
    key: string,
    x: number,
    y: number,
    {
        size,
        ink,
        alpha,
        t,
    }: {
        size: number;
        ink: string;
        alpha: number;
        t: number;
    },
) {
    const hop = Math.abs(Math.sin(t * 7)) * size * 0.18;
    const tilt = Math.sin(t * 7) * 0.12;
    const at = (dx: number, dy: number): Vector => [
        x + dx * size * Math.cos(tilt) - dy * size * Math.sin(tilt),
        y - hop + dx * size * Math.sin(tilt) + dy * size * Math.cos(tilt),
    ];
    const head = at(-0.14, 0.28);
    ctx.beginLayer({ key, opacity: alpha });
    push(ctx, circle(head[0], head[1], size * 0.19, size * 0.14).command(ink));
    const stem = new PathBuilder(...at(0.03, 0.28))
        .line(...at(0.03, -0.42))
        .line(...at(0.11, -0.42))
        .line(...at(0.11, 0.28))
        .line(...at(0.03, 0.28));
    push(ctx, stem.command(ink));
    const flag = new PathBuilder(...at(0.11, -0.42))
        .cubic(
            at(0.2, -0.3)[0],
            at(0.2, -0.3)[1],
            at(0.38, -0.22)[0],
            at(0.38, -0.22)[1],
            {
                x: at(0.3, 0.02)[0],
                y: at(0.3, 0.02)[1],
            },
        )
        .cubic(
            at(0.3, -0.14)[0],
            at(0.3, -0.14)[1],
            at(0.2, -0.2)[0],
            at(0.2, -0.2)[1],
            {
                x: at(0.11, -0.24)[0],
                y: at(0.11, -0.24)[1],
            },
        )
        .line(...at(0.11, -0.42));
    push(ctx, flag.command(ink));
    ctx.endLayer();
}
export function drawBubbles(ctx: RenderCtx, frame: OpeningFrame): void {
    frame.bubbles.forEach((bubble, index) =>
        drawBubble(ctx, frame, bubble, index),
    );
}
class BubbleDrawing {
    private ctx!: RenderCtx;
    private frame!: OpeningFrame;
    private bubble!: OpeningBubble;
    private index!: number;
    private base!: number;
    private size!: number;
    private font!: FontName;
    private measure!: (line: string) => number;
    private message!: string;
    private note!: boolean;
    private noteWidth!: number;
    private lines!: string[];
    private lineWidths!: number[];
    private lineHeight!: number;
    private textWidth!: number;
    private padX!: number;
    private padY!: number;
    private w!: number;
    private h!: number;
    private tip!: Vector;
    private gap!: number;
    private x!: number;
    private y!: number;
    private scale!: number;
    private grow!: ([px, py]: Vector) => Vector;
    private path!: PathBuilder;
    private key!: string;
    private fill!: string;
    private stroke!: {
        width: number;
        color: string;
    };
    private shown!: number;
    private cx!: number;
    private cy!: number;
    private ink!: '#2b2f3a' | '#ffd2c6' | '#f4f1ea';
    constructor(
        ctx: RenderCtx,
        frame: OpeningFrame,
        bubble: OpeningBubble,
        index: number,
    ) {
        this.ctx = ctx;
        this.frame = frame;
        this.bubble = bubble;
        this.index = index;
    }
    run() {
        this.base = this.ctx.clamp(this.ctx.W / 46, 13, 20);
        this.prepareLayout();
        this.y = this.ctx.clamp(
            this.y,
            10,
            Math.max(10, this.ctx.H - 10 - this.h),
        );
        if (this.bubble.style === 'rage') {
            this.x += Math.sin(this.frame.t * 70) * 2;
            this.y += Math.cos(this.frame.t * 57) * 2;
        }
        this.scale =
            0.45 + 0.55 * easeOutBack(Math.min(1, this.bubble.age / 0.22));
        this.grow = ([px, py]: Vector): Vector => [
            this.tip[0] + (px - this.tip[0]) * this.scale,
            this.tip[1] + (py - this.tip[1]) * this.scale,
        ];
        this.buildOutline();
        this.drawBubbleLayers();
    }
    private buildOutline() {
        if (this.bubble.style === 'rage') {
            this.buildRageOutline();
        } else if (this.bubble.speaker === 'chair') {
            this.buildChairOutline();
        } else {
            this.buildRiderOutline();
        }
    }
    private drawBubbleLayers() {
        this.key = `opening-bubble-${this.index}`;
        if (this.bubble.style === 'glass') {
            this.ctx.beginLayer({
                key: `${this.key}-glow`,
                blur: this.size * 0.45,
                opacity: 0.55 * this.bubble.alpha,
            });
            push(this.ctx, this.path.command('#9aa3c0'));
            this.ctx.endLayer();
        }
        this.fill =
            this.bubble.style === 'solid'
                ? '#ffffff'
                : this.bubble.style === 'glass'
                  ? CHAIR_SLATE + 'eb'
                  : CHAIR_SLATE + 'e6';
        this.stroke =
            this.bubble.style === 'solid'
                ? { width: 2, color: '#2b2f3a' }
                : this.bubble.style === 'glass'
                  ? { width: 2, color: '#9aa3c0' }
                  : { width: 3, color: '#e0473a' };
        this.ctx.beginLayer({ key: this.key, opacity: this.bubble.alpha });
        push(
            this.ctx,
            this.path.command(this.fill, { ...this.stroke, cap: 'round' }),
        );
        if (this.bubble.style === 'glass') {
            const from: Vector = [
                this.ctx.clamp(
                    this.tip[0],
                    this.x + this.w * 0.3,
                    this.x + this.w * 0.9,
                ),
                this.y + this.h,
            ];
            for (const [k, radius] of [
                [0.3, 0.42],
                [0.62, 0.28],
                [0.88, 0.17],
            ]) {
                const [bx, by] = this.grow([
                    from[0] + (this.tip[0] - from[0]) * k,
                    from[1] + (this.tip[1] - from[1]) * k,
                ]);
                push(
                    this.ctx,
                    circle(bx, by, this.size * radius * this.scale).command(
                        this.fill,
                        {
                            width: 2,
                            color: this.stroke.color,
                            cap: 'round',
                        },
                    ),
                );
            }
        }
        this.ctx.endLayer();
        this.drawBubbleText();
    }
    private prepareLayout() {
        this.size = this.bubble.style === 'rage' ? this.base * 1.3 : this.base;
        this.measureBubbleText();
    }
    private measureBubbleText() {
        this.font = this.bubble.style === 'rage' ? SIGN_FONT : SPEECH_FONT;
        this.measure = (line: string) =>
            this.ctx.measureText(line, this.size, this.font);
        this.message = translate(this.bubble.message, this.ctx.locale);
        this.note = this.message.endsWith('♪');
        this.noteWidth = this.note ? this.size * 0.8 : 0;
        this.lines = wrap(
            this.measure,
            this.note ? this.message.slice(0, -1) : this.message,
            Math.min(
                this.ctx.W - 64,
                this.size * (this.bubble.style === 'rage' ? 10 : 17),
            ),
        );
        this.lineWidths = this.lines.map(
            (line, i) =>
                this.measure(line) +
                (i === this.lines.length - 1 ? this.noteWidth : 0),
        );
        this.lineHeight = this.size * 1.3;
        this.textWidth = Math.max(...this.lineWidths);
        this.padX = this.size * 0.9;
        this.padY = this.size * 0.6;
        this.w = this.textWidth + this.padX * 2;
        this.h = this.lines.length * this.lineHeight + this.padY * 2;
        this.tip = bubbleAnchor(this.ctx, this.bubble);
        this.gap =
            this.bubble.style === 'solid' ? this.size * 0.9 : this.size * 2.2;
        this.x =
            this.bubble.speaker === 'rider'
                ? this.tip[0] - this.w / 2
                : this.bubble.style === 'rage'
                  ? this.tip[0] - this.w - this.size * 1.6
                  : this.tip[0] - this.w * 0.8;
        this.y = this.tip[1] - this.gap - this.h;
        if (this.bubble.style === 'rage') {
            this.x = Math.max(this.x, this.size * 1.4);
            this.y = Math.max(
                this.tip[1] - this.h - this.size * 3.4,
                this.size * 1.4,
            );
        }
        this.x = this.ctx.clamp(
            this.x,
            10,
            Math.max(10, this.ctx.W - 10 - this.w),
        );
    }
    private buildRageOutline() {
        const cx = this.x + this.w / 2;
        const cy = this.y + this.h / 2;
        const rx = this.w / 2 + this.size * 1.1;
        const ry = this.h / 2 + this.size * 1.1;
        const count = 26;
        const boil = Math.floor(this.frame.t * 14);
        const toTip = Math.atan2(
            (this.tip[1] - cy) / ry,
            (this.tip[0] - cx) / rx,
        );
        let tail = 0;
        let best = Infinity;
        for (let i = 0; i < count; i += 2) {
            const d = Math.abs(
                Math.atan2(
                    Math.sin((i / count) * this.ctx.TAU - toTip),
                    Math.cos((i / count) * this.ctx.TAU - toTip),
                ),
            );
            if (d < best) {
                best = d;
                tail = i;
            }
        }
        const points: Vector[] = [];
        for (let i = 0; i < count; i++) {
            const a = (i / count) * this.ctx.TAU;
            const jitter =
                (((Math.imul(i + 1, 0x9e3779b1) ^
                    Math.imul(boil, 0x85ebca6b)) >>>
                    0) %
                    100) /
                100;
            const r = i % 2 === 0 ? 1.12 + jitter * 0.12 : 0.84;
            points.push(
                i === tail
                    ? this.tip
                    : [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r],
            );
        }
        const scaled = points.map(this.grow);
        this.path = new PathBuilder(...scaled[0]);
        for (const point of scaled.slice(1)) {
            this.path.line(...point);
        }
        this.path.line(...scaled[0]);
    }
    private buildChairOutline() {
        const r = Math.min(this.h / 2, this.size * 0.9);
        const s = (px: number, py: number) => this.grow([px, py]);
        this.path = new PathBuilder(...s(this.x + r, this.y))
            .line(...s(this.x + this.w - r, this.y))
            .corner(
                ...s(this.x + this.w, this.y),
                ...s(this.x + this.w, this.y + r),
            )
            .line(...s(this.x + this.w, this.y + this.h - r))
            .corner(
                ...s(this.x + this.w, this.y + this.h),
                ...s(this.x + this.w - r, this.y + this.h),
            )
            .line(...s(this.x + r, this.y + this.h))
            .corner(
                ...s(this.x, this.y + this.h),
                ...s(this.x, this.y + this.h - r),
            )
            .line(...s(this.x, this.y + r))
            .corner(...s(this.x, this.y), ...s(this.x + r, this.y));
    }
    private buildRiderOutline() {
        const r = Math.min(this.h / 2, this.size * 0.9);
        const tw = Math.min(this.size * 0.8, this.w / 4);
        const tailX = this.ctx.clamp(
            this.tip[0],
            this.x + r + tw,
            this.x + this.w - r - tw,
        );
        const s = (px: number, py: number) => this.grow([px, py]);
        this.path = new PathBuilder(...s(this.x + r, this.y))
            .line(...s(this.x + this.w - r, this.y))
            .corner(
                ...s(this.x + this.w, this.y),
                ...s(this.x + this.w, this.y + r),
            )
            .line(...s(this.x + this.w, this.y + this.h - r))
            .corner(
                ...s(this.x + this.w, this.y + this.h),
                ...s(this.x + this.w - r, this.y + this.h),
            )
            .line(...s(tailX + tw, this.y + this.h))
            .cubic(
                s(tailX + tw * 0.5, this.y + this.h + this.gap * 0.4)[0],
                s(tailX + tw * 0.5, this.y + this.h + this.gap * 0.4)[1],
                s(this.tip[0], this.tip[1] - this.gap * 0.3)[0],
                s(this.tip[0], this.tip[1] - this.gap * 0.3)[1],
                {
                    x: this.tip[0],
                    y: this.tip[1],
                },
            )
            .cubic(
                s(tailX - tw * 0.2, this.y + this.h + this.gap * 0.5)[0],
                s(tailX - tw * 0.2, this.y + this.h + this.gap * 0.5)[1],
                s(tailX - tw * 0.6, this.y + this.h + this.gap * 0.1)[0],
                s(tailX - tw * 0.6, this.y + this.h + this.gap * 0.1)[1],
                {
                    x: s(tailX - tw, this.y + this.h)[0],
                    y: s(tailX - tw, this.y + this.h)[1],
                },
            )
            .line(...s(this.x + r, this.y + this.h))
            .corner(
                ...s(this.x, this.y + this.h),
                ...s(this.x, this.y + this.h - r),
            )
            .line(...s(this.x, this.y + r))
            .corner(...s(this.x, this.y), ...s(this.x + r, this.y));
    }
    private drawBubbleText() {
        this.shown = Math.floor(
            this.bubble.age *
                TYPE_SPEED *
                (this.bubble.style === 'rage' ? 2 : 1),
        );
        const [cx, cy] = this.grow([this.x + this.w / 2, this.y + this.h / 2]);
        this.cx = cx;
        this.cy = cy;
        this.ink =
            this.bubble.style === 'solid'
                ? '#2b2f3a'
                : this.bubble.style === 'rage'
                  ? '#ffd2c6'
                  : '#f4f1ea';
        this.lines.forEach((line, i) => {
            const visible = [...line]
                .slice(0, Math.max(0, this.shown))
                .join('');
            this.shown -= [...line].length + 1;
            if (!visible) {
                return;
            }
            const lineY =
                this.cy +
                (i - (this.lines.length - 1) / 2) *
                    this.lineHeight *
                    this.scale;
            const left = this.cx - (this.lineWidths[i] / 2) * this.scale;
            this.ctx.screenText(
                visible,
                left + (this.measure(visible) / 2) * this.scale,
                lineY,
                this.size * this.scale,
                {
                    fill: this.ink,
                    opts: { font: this.font, opacity: this.bubble.alpha },
                },
            );
            if (this.note && i === this.lines.length - 1 && this.shown >= 0) {
                drawNote(
                    this.ctx,
                    `${this.key}-note`,
                    left +
                        (this.lineWidths[i] - this.noteWidth / 2) * this.scale,
                    lineY,
                    {
                        size: this.size * this.scale,
                        ink: this.ink,
                        alpha: this.bubble.alpha,
                        t: this.frame.t,
                    },
                );
            }
        });
    }
}
