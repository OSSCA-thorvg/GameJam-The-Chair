import type { RenderCtx } from '../context';
import type { Blend, DrawCommand, PathCommand, Gradient, TextSpec } from '../types';
import { fontCss } from '../fonts';

const COMPOSITE: Record<Blend, GlobalCompositeOperation> = {
    normal: 'source-over', multiply: 'multiply', screen: 'screen', add: 'lighter', overlay: 'overlay',
};

function tracePath2d(bg: CanvasRenderingContext2D, cmd: PathCommand) {
    bg.beginPath();
    bg.moveTo(...cmd.points[0]);
    for (let i = 1; i < cmd.points.length; i++) bg.lineTo(...cmd.points[i]);
    for (const c of cmd.curves || []) bg.bezierCurveTo(...c);
    if (!cmd.open) bg.closePath();
}

function style2d(ctx: RenderCtx, bg: CanvasRenderingContext2D, c: string | Gradient) {
    if (typeof c === 'string') return c;
    const g = c.radius === undefined
        ? bg.createLinearGradient(...c.from, ...c.to)
        : bg.createRadialGradient(...c.from, 0, ...c.from, c.radius);
    for (const [at, color] of c.stops) {
        g.addColorStop(at, `rgba(${color[0]},${color[1]},${color[2]},${color[3] / 255})`);
    }
    return g;
}

function text2d(bg: CanvasRenderingContext2D, spec: TextSpec) {
    bg.save();
    bg.translate(spec.x, spec.y);
    bg.rotate(spec.rotation);
    bg.font = fontCss(spec.font, spec.size);
    if (spec.opacity !== undefined) bg.globalAlpha = spec.opacity;
    bg.textAlign = 'center';
    bg.textBaseline = 'middle';
    if (spec.outline) {
        bg.lineJoin = 'round';
        bg.lineWidth = spec.outline.width;
        bg.strokeStyle = spec.outline.color;
        bg.strokeText(spec.content, 0, 0);
    }
    bg.fillStyle = spec.fill;
    bg.fillText(spec.content, 0, 0);
    bg.restore();
}

/** Canvas2D fallback: same commands, with the layer features Canvas2D can express. */
export function paintCanvas(ctx: RenderCtx, bg: CanvasRenderingContext2D, commands: DrawCommand[]) {
    for (const cmd of commands) {
        if (cmd.kind === 'text') {
            text2d(bg, cmd.text);
            continue;
        }
        const layer = cmd.layer;
        const styled = layer || cmd.blend || cmd.stroke;
        if (styled) {
            bg.save();
            if (layer?.retained) {
                const m = layer.retained.transform;
                bg.transform(m.e11, m.e21, m.e12, m.e22, m.e13, m.e23);
            }
            if (layer?.clip) {
                tracePath2d(bg, layer.clip);
                bg.clip();
            }
            // An inverted mask punches a hole: clip to the canvas minus the mask path.
            if (layer?.mask && layer.maskInvert) {
                tracePath2d(bg, layer.mask);
                bg.rect(0, 0, ctx.W, ctx.H);
                bg.clip('evenodd');
            }
            if (layer?.opacity !== undefined) bg.globalAlpha = layer.opacity;
            if (layer?.blur) bg.filter = `blur(${layer.blur}px)`;
            bg.globalCompositeOperation = COMPOSITE[cmd.blend ?? layer?.blend ?? 'normal'];
        }
        tracePath2d(bg, cmd);
        if (cmd.fill !== null) {
            bg.fillStyle = style2d(ctx, bg, cmd.fill);
            bg.fill();
        }
        if (cmd.stroke) {
            bg.lineWidth = cmd.stroke.width;
            bg.lineCap = cmd.stroke.cap === 'round' ? 'round' : 'butt';
            bg.lineJoin = 'round';
            bg.setLineDash(cmd.stroke.dash ?? []);
            bg.lineDashOffset = cmd.stroke.dashOffset ?? 0;
            const color = cmd.stroke.color;
            bg.strokeStyle = typeof color === 'string' ? ctx.tint(color.slice(0, 7), ctx.rgba(color)[3] / 255) : style2d(ctx, bg, color);
            bg.stroke();
        }
        if (styled) bg.restore();
    }
}
