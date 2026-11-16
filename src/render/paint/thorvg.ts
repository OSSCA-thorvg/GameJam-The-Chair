import type {
    Canvas,
    LinearGradient,
    RadialGradient,
    Scene,
    Shape,
    Text,
    ThorVGNamespace,
} from '@thorvg/webcanvas';
import type { RenderCtx } from '../context';
import type {
    Blend,
    PathCommand,
    Gradient,
    LayerSpec,
    TextSpec,
} from '../types';
import type { FontName } from '../fonts';
import { effectScaleForArea, type RenderStats } from '../perf';
import { canvasBox, type Item } from './commands';

type LayerSlot = {
    scene: Scene;
    shapes: Shape[];
    clip: Shape | null;
    mask: Shape | null;
    maskInvert: boolean;
    retainedGeometry: string | null;
};

type TextSlot = { back: Text; front: Text; font: string; content: string };

type AppliedStyle = { stroked: boolean; trimmed: boolean; blended: boolean };
const PX_TO_PT = 72 / 96;

export type PaintPool = {
    top: Shape[];
    texts: TextSlot[];
    layers: Map<string, LayerSlot>;
    styled: Map<Shape, AppliedStyle>;
    signature: string;
};

export function createPaintPool(): PaintPool {
    return {
        top: [],
        texts: [],
        layers: new Map(),
        styled: new Map(),
        signature: '',
    };
}

function staleSlot(slot: LayerSlot, spec: LayerSpec) {
    if (slot.clip && !spec.clip) return true;
    if (slot.mask && (!spec.mask || slot.maskInvert !== !!spec.maskInvert)) {
        return true;
    }
    return false;
}

export function thorvgTextWidth(TVG: ThorVGNamespace) {
    const probe = new TVG.Text();
    const cache = new Map<string, number>();
    return (content: string, font: FontName) => {
        const key = `${font}\n${content}`;
        let width = cache.get(key);
        if (width === undefined) {
            probe
                .font(font)
                .fontSize(100 * PX_TO_PT)
                .text(content);
            width = content ? probe.bounds().width / 100 : 0;
            cache.set(key, width);
        }
        return width;
    };
}

function blendOf(TVG: ThorVGNamespace, blend: Blend | undefined) {
    switch (blend) {
        case 'multiply':
            return TVG.BlendMethod.Multiply;
        case 'screen':
            return TVG.BlendMethod.Screen;
        case 'add':
            return TVG.BlendMethod.Add;
        case 'overlay':
            return TVG.BlendMethod.Overlay;
        case 'normal':
        case undefined:
            return TVG.BlendMethod.Normal;
    }
}

function fillOf(
    TVG: ThorVGNamespace,
    g: Gradient,
): LinearGradient | RadialGradient {
    const fill =
        g.radius === undefined
            ? new TVG.LinearGradient(...g.from, ...g.to)
            : new TVG.RadialGradient(...g.from, g.radius);
    fill.setStops(...g.stops);
    return fill;
}

function tracePath(s: Shape, cmd: PathCommand) {
    s.reset();
    s.moveTo(...cmd.points[0]);
    for (let j = 1; j < cmd.points.length; j++) s.lineTo(...cmd.points[j]);
    for (const c of cmd.curves || []) s.cubicTo(...c);
    if (!cmd.open) s.close();
}

function applyShape(
    ctx: RenderCtx,
    TVG: ThorVGNamespace,
    pool: PaintPool,
    s: Shape,
    cmd: PathCommand,
) {
    tracePath(s, cmd);
    if (cmd.fill === null) {
        s.fill(0, 0, 0, 0);
    } else if (typeof cmd.fill === 'string') {
        s.fill(...ctx.rgba(cmd.fill));
    } else {
        const g = fillOf(TVG, cmd.fill);
        s.fill(g);
        g.dispose();
    }
    const style = pool.styled.get(s) ?? {
        stroked: false,
        trimmed: false,
        blended: false,
    };
    if (cmd.stroke) {
        const k = cmd.stroke;
        const gradient =
            typeof k.color === 'string' ? null : fillOf(TVG, k.color);
        s.stroke({
            width: k.width,
            ...(gradient
                ? { gradient }
                : { color: ctx.rgba(k.color as string) }),
            cap: k.cap === 'round' ? TVG.StrokeCap.Round : TVG.StrokeCap.Butt,
            join: TVG.StrokeJoin.Round,
            dash: k.dash ?? [],
            dashOffset: k.dashOffset ?? 0,
        });
        gradient?.dispose();
        style.stroked = true;
    } else if (style.stroked) {
        s.stroke({ width: 0, dash: [] });
        style.stroked = false;
    }
    if (cmd.trim) {
        s.trimPath(cmd.trim[0], cmd.trim[1], true);
        style.trimmed = true;
    } else if (style.trimmed) {
        s.trimPath(0, 1, true);
        style.trimmed = false;
    }
    if (cmd.blend && cmd.blend !== 'normal') {
        s.blend(blendOf(TVG, cmd.blend));
        style.blended = true;
    } else if (style.blended) {
        s.blend(TVG.BlendMethod.Normal);
        style.blended = false;
    }
    if (style.stroked || style.trimmed || style.blended) {
        pool.styled.set(s, style);
    } else pool.styled.delete(s);
    s.visible(true);
}

function applyText(ctx: RenderCtx, slot: TextSlot, spec: TextSpec) {
    if (slot.font !== spec.font) {
        slot.back.font(spec.font);
        slot.front.font(spec.font);
        slot.font = spec.font;
    }
    if (slot.content !== spec.content) {
        slot.back.text(spec.content);
        slot.front.text(spec.content);
        slot.content = spec.content;
    }
    const c = Math.cos(spec.rotation),
        s = Math.sin(spec.rotation);
    const matrix = {
        e11: c,
        e12: -s,
        e13: spec.x,
        e21: s,
        e22: c,
        e23: spec.y,
        e31: 0,
        e32: 0,
        e33: 1,
    };
    // ThorVG 1.1.3 Text sizes are points (96/72 px each); TextSpec sizes
    // are CSS px like Canvas2D.
    const size = spec.size * PX_TO_PT;
    const [r, g, b, a] = ctx.rgba(spec.fill);
    const fade = spec.opacity ?? 1;
    slot.front
        .fontSize(size)
        .fill(r, g, b)
        .opacity(Math.round(a * fade))
        .transform(matrix)
        .visible(true);
    if (spec.outline) {
        const [or, og, ob, oa] = ctx.rgba(spec.outline.color);
        slot.back
            .fontSize(size)
            .fill(or, og, ob)
            .outline(spec.outline.width, or, og, ob)
            .opacity(Math.round(oa * fade))
            .transform(matrix)
            .visible(true);
    } else {
        slot.back.visible(false);
    }
}

function recordLayerStats(
    stats: RenderStats,
    spec: LayerSpec,
    shapeCount: number,
    activeCount: number,
    area: number,
    effectScale: number,
    blurred: boolean,
) {
    stats.layers++;
    stats.layerShapes += shapeCount;
    stats.parkedShapes += shapeCount - activeCount;
    if (spec.clip) stats.clips++;
    if (spec.mask) stats.masks++;
    if (spec.blur) {
        stats.gaussianBlurs++;
        stats.blurAmount += spec.blur * effectScale;
    }
    if (spec.motionBlur && spec.motionBlur.distance > 0.5) {
        stats.motionBlurs++;
        stats.blurAmount += spec.motionBlur.distance * effectScale;
    }
    if (blurred) stats.blurArea += area;
    const effects: string[] = [];
    if (spec.opacity !== undefined && spec.opacity < 1) {
        effects.push(`α${spec.opacity.toFixed(2)}`);
    }
    if (spec.blend && spec.blend !== 'normal') effects.push(spec.blend);
    if (spec.blur) effects.push(`blur${spec.blur}`);
    if (spec.motionBlur && spec.motionBlur.distance > 0.5) {
        effects.push('motion');
    }
    if (effectScale < 1) {
        effects.push(`budget${Math.round(effectScale * 100)}%`);
    }
    if (spec.clip) effects.push('clip');
    if (spec.mask) effects.push(spec.maskInvert ? 'invmask' : 'mask');
    stats.layerList.push({ key: spec.key, shapes: activeCount, area, effects });
}

function applyLayerEffects(
    ctx: RenderCtx,
    TVG: ThorVGNamespace,
    slot: LayerSlot,
    spec: LayerSpec,
    effectScale: number,
) {
    const { scene } = slot;
    scene.resetEffects();
    const quality = Math.max(20, Math.round(45 * effectScale));
    if (spec.blur) {
        scene.gaussianBlur(spec.blur * effectScale, 0, 0, quality);
    }
    if (spec.motionBlur && spec.motionBlur.distance > 0.5) {
        scene.motionBlur(
            spec.motionBlur.distance * effectScale,
            spec.motionBlur.angle,
            quality,
        );
    }
    scene.blend(blendOf(TVG, spec.blend));
    scene.opacity(
        Math.round(Math.max(0, Math.min(1, spec.opacity ?? 1)) * 255),
    );
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
            scene.mask(
                slot.mask,
                slot.maskInvert
                    ? TVG.MaskMethod.InvAlpha
                    : TVG.MaskMethod.Alpha,
            );
        }
        const fill = spec.mask.fill;
        tracePath(slot.mask, spec.mask);
        if (fill === null) slot.mask.fill(255, 255, 255, 255);
        else if (typeof fill === 'string') {
            slot.mask.fill(...ctx.rgba(fill));
        } else {
            const g = fillOf(TVG, fill);
            slot.mask.fill(g);
            g.dispose();
        }
    }
}

function syncLayer(
    ctx: RenderCtx,
    TVG: ThorVGNamespace,
    pool: PaintPool,
    item: Extract<Item, { layer: LayerSpec }>,
    stats?: RenderStats,
) {
    let slot = pool.layers.get(item.key);
    if (!slot) {
        slot = {
            scene: new TVG.Scene(),
            shapes: [],
            clip: null,
            mask: null,
            maskInvert: false,
            retainedGeometry: null,
        };
        pool.layers.set(item.key, slot);
    }
    const { scene, shapes } = slot;
    const spec = item.layer;
    const blurred =
        !!spec.blur || (!!spec.motionBlur && spec.motionBlur.distance > 0.5);
    const extent =
        stats || spec.effectBudget
            ? [Infinity, Infinity, -Infinity, -Infinity]
            : undefined;
    if (spec.retained && extent) {
        const bounds = spec.retained.bounds;
        extent[0] = Math.max(0, bounds.left);
        extent[1] = Math.max(0, bounds.top);
        extent[2] = Math.min(ctx.W, bounds.right);
        extent[3] = Math.min(ctx.H, bounds.bottom);
    }
    const retainedReady =
        !!spec.retained && slot.retainedGeometry === spec.retained.geometry;
    let i = 0;
    let anchor: [number, number] | null = null;
    for (const cmd of item.cmds) {
        const box: [number, number] | null = spec.retained
            ? [
                  Math.max(0, spec.retained.bounds.left),
                  Math.max(0, spec.retained.bounds.top),
              ]
            : canvasBox(cmd, ctx.W, ctx.H, extent);
        if (!box) continue;
        anchor ??= box;
        let s = shapes[i];
        if (!s) {
            s = new TVG.Shape();
            shapes.push(s);
            scene.add(s);
        }
        if (!retainedReady) applyShape(ctx, TVG, pool, s, cmd);
        i++;
    }
    if (spec.retained) {
        scene.transform(spec.retained.transform);
        slot.retainedGeometry = spec.retained.geometry;
    }
    // Re-adding shapes leaks ThorVG references; park unused shapes inside
    // the drawn area.
    const [px, py] = anchor ?? [0, 0];
    const area =
        extent && extent[2] > extent[0] && extent[3] > extent[1]
            ? (extent[2] - extent[0]) * (extent[3] - extent[1])
            : 0;
    const effectScale = spec.effectBudget
        ? effectScaleForArea(
              area,
              spec.effectBudget.area,
              spec.effectBudget.minScale,
          )
        : 1;
    if (stats) {
        recordLayerStats(
            stats,
            spec,
            shapes.length,
            i,
            area,
            effectScale,
            blurred,
        );
    }
    for (; i < shapes.length; i++) {
        applyShape(ctx, TVG, pool, shapes[i], {
            kind: 'path',
            points: [
                [px, py],
                [px + 1, py],
                [px + 1, py + 1],
                [px, py + 1],
            ],
            fill: '#00000001',
        });
    }

    applyLayerEffects(ctx, TVG, slot, spec, effectScale);
    scene.visible(true);
    return scene;
}

export function paintThorvg(
    ctx: RenderCtx,
    TVG: ThorVGNamespace,
    tvg: Canvas,
    pool: PaintPool,
    items: Item[],
    stats?: RenderStats,
) {
    const syncStart = stats ? performance.now() : 0;

    let topCount = 0;
    let textCount = 0;
    let signature = '';
    for (const item of items) {
        if ('cmd' in item) topCount++;
        else if ('text' in item) signature += `${topCount}:text${textCount++};`;
        else signature += `${topCount}:${item.key};`;
    }
    while (pool.top.length < topCount) {
        pool.top.push(new TVG.Shape());
        signature += '+';
    }
    while (pool.texts.length < textCount) {
        const make = () => new TVG.Text().align(0.5, 0.5);
        pool.texts.push({ back: make(), front: make(), font: '', content: '' });
        signature += '+';
    }
    signature += `${pool.top.length}/${pool.texts.length}`;
    // ThorVG cannot detach clips or masks; replace the scene to avoid GL
    // smearing.
    for (const item of items) {
        if (!('layer' in item)) continue;
        const slot = pool.layers.get(item.key);
        if (slot && staleSlot(slot, item.layer)) {
            pool.layers.delete(item.key);
            pool.signature = '';
        }
    }
    // Empty the canvas before adding children: ThorVG 1.1.3 crashes if such a
    // scene is then removed.
    const reorder = signature !== pool.signature;
    if (reorder) {
        pool.signature = '';
        tvg.remove();
    }

    let topIndex = 0;
    let textIndex = 0;
    const order: Array<Shape | Scene | Text> = [];
    for (const item of items) {
        if ('cmd' in item) {
            const s = pool.top[topIndex++];
            applyShape(ctx, TVG, pool, s, item.cmd);
            order.push(s);
            continue;
        }
        if ('text' in item) {
            const slot = pool.texts[textIndex++];
            applyText(ctx, slot, item.text);
            order.push(slot.back, slot.front);
            if (stats) stats.texts++;
            continue;
        }
        order.push(syncLayer(ctx, TVG, pool, item, stats));
    }
    for (let i = topIndex; i < pool.top.length; i++) pool.top[i].visible(false);
    for (let i = textIndex; i < pool.texts.length; i++) {
        pool.texts[i].back.visible(false);
        pool.texts[i].front.visible(false);
    }

    if (reorder) {
        for (const paint of order) tvg.add(paint);
        for (let i = topIndex; i < pool.top.length; i++) tvg.add(pool.top[i]);
        for (let i = textIndex; i < pool.texts.length; i++) {
            tvg.add(pool.texts[i].back).add(pool.texts[i].front);
        }
        // Commit the signature only after success so a failed rebuild is
        // retried.
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
