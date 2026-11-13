import type { Canvas, LinearGradient, RadialGradient, Scene, Shape, ThorVGNamespace } from '@thorvg/webcanvas';
import type { RenderCtx } from './context';
import type { Blend, DrawCommand, Gradient, LayerSpec } from './types';
import { applyLayerOverrides, effectScaleForArea, type LayerOverrides, type RenderStats } from './perf';

type LayerSlot = {
    scene: Scene;
    shapes: Shape[];
    clip: Shape | null;
    mask: Shape | null;
    maskInvert: boolean;
    retainedGeometry: string | null;
};
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
function canvasBox(cmd: DrawCommand, width: number, height: number, extent?: number[]): [number, number] | null {
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
    // Profiling only: grow `extent` ([xMin, yMin, xMax, yMax]) by this command's on-canvas box.
    if (extent) {
        extent[0] = Math.min(extent[0], Math.max(0, xMin - pad));
        extent[1] = Math.min(extent[1], Math.max(0, yMin - pad));
        extent[2] = Math.max(extent[2], Math.min(width, xMax + pad));
        extent[3] = Math.max(extent[3], Math.min(height, yMax + pad));
    }
    // A point that lies both on the canvas and inside this command's box.
    return [Math.max(0, Math.min(width - 1, xMin)), Math.max(0, Math.min(height - 1, yMin))];
}

/** Whether a pooled layer scene carries a clip or mask this frame's layer no longer has (or a flipped mask mode). */
function staleSlot(slot: LayerSlot, spec: LayerSpec) {
    if (slot.clip && !spec.clip) return true;
    if (slot.mask && (!spec.mask || slot.maskInvert !== !!spec.maskInvert)) return true;
    return false;
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
    stats?: RenderStats,
    overrides?: LayerOverrides,
) {
    const commands = applyLayerOverrides(ctx.commands, overrides);
    if (stats) stats.commands = commands.length;
    if (tvg && TVG) {
        paintThorvg(ctx, TVG, tvg, pool, collect(commands), stats);
    } else {
        const start = stats ? performance.now() : 0;
        const bg = ctx.bg;
        bg.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0);
        bg.clearRect(0, 0, ctx.W, ctx.H);
        paintCanvas(ctx, bg, commands);
        if (stats) stats.renderMs = performance.now() - start;
    }
    const labelsStart = stats ? performance.now() : 0;
    const lg = ctx.lg;
    lg.save();
    // System-font labels sit above the vector canvas, including its actors.
    paintCanvas(ctx, lg, ctx.foregroundActors);
    lg.restore();
    if (stats) stats.labelsMs = performance.now() - labelsStart;
}

function paintThorvg(ctx: RenderCtx, TVG: ThorVGNamespace, tvg: Canvas, pool: PaintPool, items: Item[], stats?: RenderStats) {
    const syncStart = stats ? performance.now() : 0;
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
    // ThorVG cannot take a clip or mask off a scene. A stand-in that lets everything through (a huge rect) is
    // drawn wrongly by the GL renderer: a Screen-blended, masked water layer smeared other actors across the
    // frame once its mask ended. A layer that loses its clip or mask, or flips its mask mode, starts over with
    // a fresh scene, and the canvas order is rebuilt because the old scene leaves it.
    // ThorVG는 scene의 clip/mask를 뗄 수 없고, GL 렌더러는 대체 mask를 잘못 그리므로 scene을 새로 만든다.
    for (const item of items) {
        if ('cmd' in item) continue;
        const slot = pool.layers.get(item.key);
        if (slot && staleSlot(slot, item.layer)) {
            pool.layers.delete(item.key);
            pool.signature = '';
        }
    }
    // ThorVG 1.1.3 crashes ("null function") when a scene that is already on the canvas gets new children and
    // is then removed before the next update. Empty the canvas first, so this frame's new children are only
    // ever added to scenes that are off the canvas.
    const reorder = signature !== pool.signature;
    if (reorder) {
        pool.signature = '';
        tvg.remove();
    }

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
            slot = { scene: new TVG.Scene(), shapes: [], clip: null, mask: null, maskInvert: false, retainedGeometry: null };
            pool.layers.set(item.key, slot);
        }
        const { scene, shapes } = slot;
        const spec = item.layer;
        const blurred = !!spec.blur || (!!spec.motionBlur && spec.motionBlur.distance > .5);
        const extent = stats || spec.effectBudget ? [Infinity, Infinity, -Infinity, -Infinity] : undefined;
        if (spec.retained && extent) {
            const bounds = spec.retained.bounds;
            extent[0] = Math.max(0, bounds.left);
            extent[1] = Math.max(0, bounds.top);
            extent[2] = Math.min(ctx.W, bounds.right);
            extent[3] = Math.min(ctx.H, bounds.bottom);
        }
        const retainedReady = !!spec.retained && slot.retainedGeometry === spec.retained.geometry;
        let i = 0;
        let anchor: [number, number] | null = null;
        for (const cmd of item.cmds) {
            const box: [number, number] | null = spec.retained
                ? [Math.max(0, spec.retained.bounds.left), Math.max(0, spec.retained.bounds.top)]
                : canvasBox(cmd, ctx.W, ctx.H, extent);
            if (!box) continue;
            anchor ??= box;
            let s = shapes[i];
            if (!s) {
                s = new TVG.Shape();
                shapes.push(s);
                scene.add(s);
            }
            if (!retainedReady) apply(s, cmd);
            i++;
        }
        if (spec.retained) {
            scene.transform(spec.retained.transform);
            slot.retainedGeometry = spec.retained.geometry;
        }
        // Spare shapes stay in the scene (re-adding leaks a ThorVG reference each time) but are parked as a
        // near-transparent pixel inside the drawn area: hiding them or emptying them would widen the region.
        const [px, py] = anchor ?? [0, 0];
        const area = extent && extent[2] > extent[0] && extent[3] > extent[1]
            ? (extent[2] - extent[0]) * (extent[3] - extent[1]) : 0;
        const effectScale = spec.effectBudget
            ? effectScaleForArea(area, spec.effectBudget.area, spec.effectBudget.minScale) : 1;
        if (stats) {
            stats.layers++;
            stats.layerShapes += shapes.length;
            stats.parkedShapes += shapes.length - i;
            if (spec.clip) stats.clips++;
            if (spec.mask) stats.masks++;
            if (spec.blur) {
                stats.gaussianBlurs++;
                stats.blurAmount += spec.blur * effectScale;
            }
            if (spec.motionBlur && spec.motionBlur.distance > .5) {
                stats.motionBlurs++;
                stats.blurAmount += spec.motionBlur.distance * effectScale;
            }
            if (blurred) stats.blurArea += area;
            const effects: string[] = [];
            if (spec.opacity !== undefined && spec.opacity < 1) effects.push(`α${spec.opacity.toFixed(2)}`);
            if (spec.blend && spec.blend !== 'normal') effects.push(spec.blend);
            if (spec.blur) effects.push(`blur${spec.blur}`);
            if (spec.motionBlur && spec.motionBlur.distance > .5) effects.push('motion');
            if (effectScale < 1) effects.push(`budget${Math.round(effectScale * 100)}%`);
            if (spec.clip) effects.push('clip');
            if (spec.mask) effects.push(spec.maskInvert ? 'invmask' : 'mask');
            stats.layerList.push({ key: spec.key, shapes: i, area, effects });
        }
        for (; i < shapes.length; i++) apply(shapes[i], { v: [[px, py], [px + 1, py], [px + 1, py + 1], [px, py + 1]], c: '#00000001' });

        scene.resetEffects();
        const quality = Math.max(20, Math.round(45 * effectScale));
        if (spec.blur) scene.gaussianBlur(spec.blur * effectScale, 0, 0, quality);
        if (spec.motionBlur && spec.motionBlur.distance > .5) {
            scene.motionBlur(spec.motionBlur.distance * effectScale, spec.motionBlur.angle, quality);
        }
        scene.blend(blendOf(spec.blend));
        scene.opacity(Math.round(Math.max(0, Math.min(1, spec.opacity ?? 1)) * 255));
        // A slot never keeps a clip or mask its layer dropped: staleSlot() replaced it before this loop.
        if (spec.clip) {
            if (!slot.clip) {
                slot.clip = new TVG.Shape();
                scene.clip(slot.clip);
            }
            tracePath(slot.clip, spec.clip);
            slot.clip.fill(255, 255, 255, 255);
        }
        if (spec.mask) {
            if (!slot.mask) {
                slot.mask = new TVG.Shape();
                slot.maskInvert = !!spec.maskInvert;
                scene.mask(slot.mask, slot.maskInvert ? TVG.MaskMethod.InvAlpha : TVG.MaskMethod.Alpha);
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
        }
        scene.visible(true);
        order.push(scene);
    }
    for (let i = topIndex; i < pool.top.length; i++) pool.top[i].visible(false);

    if (reorder) {
        for (const paint of order) tvg.add(paint);
        for (let i = topIndex; i < pool.top.length; i++) tvg.add(pool.top[i]);
        // Only a completed rebuild counts: if anything above throws, the next frame rebuilds again instead of
        // drawing an empty canvas until the layer set happens to change.
        pool.signature = signature;
    }
    if (stats) {
        stats.topShapes = topIndex;
        stats.poolTop = pool.top.length;
        stats.layerSlots = pool.layers.size;
        stats.reorder = reorder;
        const renderStart = performance.now();
        stats.syncMs = renderStart - syncStart;
        tvg.update().render();
        stats.renderMs = performance.now() - renderStart;
        return;
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
