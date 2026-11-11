import type { Canvas, LinearGradient, RadialGradient, Scene, Shape, ThorVGNamespace } from '@thorvg/webcanvas';
import type { RenderCtx } from './context';
import type { Blend, DrawCommand, Gradient, LayerSpec } from './types';

type LayerSlot = { scene: Scene; shapes: Shape[]; clip: Shape | null; mask: Shape | null };
type Item = { cmd: DrawCommand } | { layer: LayerSpec; key: string; cmds: DrawCommand[] };

// Shapes are pooled and reused; these bits remember which non-default
// styles a pooled shape carries so they can be cleared when it is reused.
const STROKED = 1;
const TRIMMED = 2;
const BLENDED = 4;

export type PaintPool = {
    top: Shape[];
    layers: Map<string, LayerSlot>;
    styled: Map<Shape, number>;
    signature: string;
};

export function createPaintPool(): PaintPool {
    return { top: [], layers: new Map(), styled: new Map(), signature: '' };
}

/**
 * Where a layer command touches the canvas, or null when it cannot leave a pixel there.
 *
 * ThorVG 1.1.3 (SW engine) sizes a layer's offscreen buffer, and any blur over it, from the union of its
 * children's boxes. A child wholly off the canvas reports an empty box at the origin, which drags that
 * union to the canvas's top-left corner, and hidden children still count. Off-canvas commands draw
 * nothing anyway, so they are left out of layers.
 */
function canvasBox(cmd: DrawCommand, width: number, height: number): [number, number] | null {
    if (cmd.c === null && !cmd.stroke) return null;
    // The polygon and Bézier control points enclose the whole path.
    let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
    const take = (x: number, y: number) => {
        if (x < xMin) xMin = x;
        if (x > xMax) xMax = x;
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
    };
    for (const [x, y] of cmd.v) take(x, y);
    for (const c of cmd.curves ?? []) {
        take(c[0], c[1]); take(c[2], c[3]); take(c[4], c[5]);
    }
    const pad = (cmd.stroke?.width ?? 0) / 2 + 1;
    if (xMax + pad <= 0 || yMax + pad <= 0 || xMin - pad >= width || yMin - pad >= height) return null;
    // A point that lies both on the canvas and inside this command's box.
    return [Math.max(0, Math.min(width - 1, xMin)), Math.max(0, Math.min(height - 1, yMin))];
}

/** Group consecutive commands that share a layer into one item. */
function collect(commands: DrawCommand[]): Item[] {
    const items: Item[] = [];
    const seen = new Map<string, number>();
    let open: Extract<Item, { layer: LayerSpec }> | null = null;
    for (const cmd of commands) {
        if (!cmd.layer) {
            open = null;
            items.push({ cmd });
            continue;
        }
        if (!open || open.layer !== cmd.layer) {
            const uses: number = seen.get(cmd.layer.key) ?? 0;
            seen.set(cmd.layer.key, uses + 1);
            open = { layer: cmd.layer, key: uses ? `${cmd.layer.key}#${uses}` : cmd.layer.key, cmds: [] };
            items.push(open);
        }
        open.cmds.push(cmd);
    }
    return items;
}

export function paint(
    ctx: RenderCtx,
    TVG: ThorVGNamespace | null,
    tvg: Canvas | null,
    pool: PaintPool,
) {
    const commands = ctx.commands;
    if (tvg && TVG) {
        paintThorvg(ctx, TVG, tvg, pool, collect(commands));
    } else {
        const bg = ctx.bg;
        bg.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0);
        bg.clearRect(0, 0, ctx.W, ctx.H);
        paintCanvas(ctx, bg, commands);
    }
    const lg = ctx.lg;
    lg.save();
    // System-font labels sit above the vector canvas, including its actors.
    paintCanvas(ctx, lg, ctx.foregroundActors);
    lg.restore();
}

function paintThorvg(ctx: RenderCtx, TVG: ThorVGNamespace, tvg: Canvas, pool: PaintPool, items: Item[]) {
    const blendOf = (blend: Blend | undefined) => {
        switch (blend) {
            case 'multiply': return TVG.BlendMethod.Multiply;
            case 'screen': return TVG.BlendMethod.Screen;
            case 'add': return TVG.BlendMethod.Add;
            case 'overlay': return TVG.BlendMethod.Overlay;
            default: return TVG.BlendMethod.Normal;
        }
    };
    const fillOf = (g: Gradient): LinearGradient | RadialGradient => {
        const fill = g.radius === undefined
            ? new TVG.LinearGradient(...g.from, ...g.to)
            : new TVG.RadialGradient(...g.from, g.radius);
        fill.setStops(...g.stops);
        return fill;
    };
    const tracePath = (s: Shape, cmd: DrawCommand) => {
        s.reset();
        s.moveTo(...cmd.v[0]);
        for (let j = 1; j < cmd.v.length; j++) s.lineTo(...cmd.v[j]);
        for (const c of cmd.curves || []) s.cubicTo(...c);
        if (!cmd.open) s.close();
    };
    const apply = (s: Shape, cmd: DrawCommand) => {
        tracePath(s, cmd);
        if (cmd.c === null) {
            s.fill(0, 0, 0, 0);
        } else if (typeof cmd.c === 'string') {
            s.fill(...ctx.rgba(cmd.c));
        } else {
            const g = fillOf(cmd.c);
            s.fill(g);
            g.dispose();
        }
        let style = pool.styled.get(s) ?? 0;
        if (cmd.stroke) {
            const k = cmd.stroke;
            const gradient = typeof k.color === 'string' ? null : fillOf(k.color);
            s.stroke({
                width: k.width,
                ...(gradient ? { gradient } : { color: ctx.rgba(k.color as string) }),
                cap: k.cap === 'round' ? TVG.StrokeCap.Round : TVG.StrokeCap.Butt,
                join: TVG.StrokeJoin.Round,
                dash: k.dash ?? [],
                dashOffset: k.dashOffset ?? 0,
            });
            gradient?.dispose();
            style |= STROKED;
        } else if (style & STROKED) {
            s.stroke({ width: 0, dash: [] });
            style &= ~STROKED;
        }
        if (cmd.trim) {
            s.trimPath(cmd.trim[0], cmd.trim[1], true);
            style |= TRIMMED;
        } else if (style & TRIMMED) {
            s.trimPath(0, 1, true);
            style &= ~TRIMMED;
        }
        if (cmd.blend && cmd.blend !== 'normal') {
            s.blend(blendOf(cmd.blend));
            style |= BLENDED;
        } else if (style & BLENDED) {
            s.blend(TVG.BlendMethod.Normal);
            style &= ~BLENDED;
        }
        if (style) pool.styled.set(s, style);
        else pool.styled.delete(s);
        s.visible(true);
    };

    // The canvas paint order only has to be rebuilt when a layer appears,
    // disappears, or moves relative to the plain shapes around it.
    let topCount = 0;
    let signature = '';
    for (const item of items) {
        if ('cmd' in item) topCount++;
        else signature += `${topCount}:${item.key};`;
    }
    while (pool.top.length < topCount) {
        pool.top.push(new TVG.Shape());
        signature += '+';
    }
    signature += pool.top.length;

    let topIndex = 0;
    const order: (Shape | Scene)[] = [];
    for (const item of items) {
        if ('cmd' in item) {
            const s = pool.top[topIndex++];
            apply(s, item.cmd);
            order.push(s);
            continue;
        }
        let slot = pool.layers.get(item.key);
        if (!slot) {
            slot = { scene: new TVG.Scene(), shapes: [], clip: null, mask: null };
            pool.layers.set(item.key, slot);
        }
        const { scene, shapes } = slot;
        let i = 0;
        let anchor: [number, number] | null = null;
        for (const cmd of item.cmds) {
            const box = canvasBox(cmd, ctx.W, ctx.H);
            if (!box) continue;
            anchor ??= box;
            let s = shapes[i];
            if (!s) {
                s = new TVG.Shape();
                shapes.push(s);
                scene.add(s);
            }
            apply(s, cmd);
            i++;
        }
        // Spare shapes stay in the scene (re-adding leaks a ThorVG reference each time) but are parked as a
        // near-transparent pixel inside the drawn area: hiding them or emptying them would widen the region.
        const [px, py] = anchor ?? [0, 0];
        for (; i < shapes.length; i++) apply(shapes[i], { v: [[px, py], [px + 1, py], [px + 1, py + 1], [px, py + 1]], c: '#00000001' });

        const spec = item.layer;
        scene.resetEffects();
        if (spec.blur) scene.gaussianBlur(spec.blur, 0, 0, 45);
        if (spec.motionBlur && spec.motionBlur.distance > .5) {
            scene.motionBlur(spec.motionBlur.distance, spec.motionBlur.angle, 45);
        }
        scene.blend(blendOf(spec.blend));
        scene.opacity(Math.round(Math.max(0, Math.min(1, spec.opacity ?? 1)) * 255));
        if (spec.clip) {
            if (!slot.clip) {
                slot.clip = new TVG.Shape();
                scene.clip(slot.clip);
            }
            tracePath(slot.clip, spec.clip);
            slot.clip.fill(255, 255, 255, 255);
        } else if (slot.clip) {
            slot.clip.reset();
            slot.clip.appendRect(-1e4, -1e4, 2e4, 2e4);
        }
        if (spec.mask) {
            if (!slot.mask) {
                slot.mask = new TVG.Shape();
                scene.mask(slot.mask, TVG.MaskMethod.Alpha);
            }
            const fill = spec.mask.c;
            tracePath(slot.mask, spec.mask);
            if (fill === null) slot.mask.fill(255, 255, 255, 255);
            else if (typeof fill === 'string') slot.mask.fill(...ctx.rgba(fill));
            else {
                const g = fillOf(fill);
                slot.mask.fill(g);
                g.dispose();
            }
        } else if (slot.mask) {
            slot.mask.reset();
            slot.mask.appendRect(-1e4, -1e4, 2e4, 2e4);
            slot.mask.fill(255, 255, 255, 255);
        }
        scene.visible(true);
        order.push(scene);
    }
    for (let i = topIndex; i < pool.top.length; i++) pool.top[i].visible(false);

    if (signature !== pool.signature) {
        pool.signature = signature;
        tvg.remove();
        for (const paint of order) tvg.add(paint);
        for (let i = topIndex; i < pool.top.length; i++) tvg.add(pool.top[i]);
    }
    tvg.update().render();
}

const COMPOSITE: Record<Blend, GlobalCompositeOperation> = {
    normal: 'source-over', multiply: 'multiply', screen: 'screen', add: 'lighter', overlay: 'overlay',
};

function tracePath2d(bg: CanvasRenderingContext2D, cmd: DrawCommand) {
    bg.beginPath();
    bg.moveTo(...cmd.v[0]);
    for (let i = 1; i < cmd.v.length; i++) bg.lineTo(...cmd.v[i]);
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

/** Canvas2D fallback: same commands, with the layer features Canvas2D can express. */
function paintCanvas(ctx: RenderCtx, bg: CanvasRenderingContext2D, commands: DrawCommand[]) {
    for (const cmd of commands) {
        const layer = cmd.layer;
        const styled = layer || cmd.blend || cmd.stroke;
        if (styled) {
            bg.save();
            if (layer?.clip) {
                tracePath2d(bg, layer.clip);
                bg.clip();
            }
            if (layer?.opacity !== undefined) bg.globalAlpha = layer.opacity;
            if (layer?.blur) bg.filter = `blur(${layer.blur}px)`;
            bg.globalCompositeOperation = COMPOSITE[cmd.blend ?? layer?.blend ?? 'normal'];
        }
        tracePath2d(bg, cmd);
        if (cmd.c !== null) {
            bg.fillStyle = style2d(ctx, bg, cmd.c);
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
