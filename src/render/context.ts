import type { Locale } from '../i18n';
import { LEVEL } from '../game/level';
import type { GameSnapshot } from '../game/game';
import type { DeepReadonly, Mode } from '../game/types';
import type { Vector, Curve, Color, Gradient, DrawCommand, PathCommand, LayerSpec, Blend, Stroke, Bounds, TextSpec } from './types';
import { fitGlyphs, fontCss, LABEL_FONT, SIGN_FONT, type FontName } from './fonts';
import { ART } from './art';
import type { EffectsState } from './effects';
import type { PersonalBoxReaction } from './personal-box-motion';
import type { KeysTried } from './key-hints';

export type RenderCtx = {
    locale: Locale;
    bg: CanvasRenderingContext2D;
    // Width at 1px font size.
    textWidth(content: string, font: FontName): number;

    readonly F: number;
    readonly TAU: number;
    readonly C: typeof ART.palette;
    clamp(v: number, a: number, b: number): number;

    W: number;
    H: number;
    scale: number;
    VW: number;
    vertical: number;
    dpr: number;
    cam: number;
    wheel: number;

    ox: number;
    oy: number;
    rotation: number;
    localScale: number;
    mirror: { y: number; k: number } | null;
    layer: LayerSpec | null;

    commands: DrawCommand[];

    state: GameSnapshot;
    player: GameSnapshot['player'];
    mode: Mode;
    monitors: (GameSnapshot['monitors'][number] & typeof ART.monitors[number])[];
    cleaning: GameSnapshot['cleaning'];
    bin: GameSnapshot['bin'] & { bottom: number };
    copier: GameSnapshot['copier'] & { flash: number };
    urgentCopier: GameSnapshot['urgentCopier'];
    people: GameSnapshot['people'];
    solids: GameSnapshot['solids'];
    papers: GameSnapshot['papers'];
    inBin: boolean;
    soaked: boolean;
    soaks: number;
    dirty: boolean;
    t: number;
    LEN: number;
    GOAL: number;

    waterDrops: DeepReadonly<EffectsState['waterDrops']>;
    waterRipples: DeepReadonly<EffectsState['waterRipples']>;
    waterPour: DeepReadonly<EffectsState['waterPour']>;
    waterPuddle: DeepReadonly<EffectsState['waterPuddle']>;
    specks: DeepReadonly<EffectsState['specks']>;
    paperFace: number;
    glare: number;
    practiceBurst: number;
    saveFlash: number;
    personalBox: PersonalBoxReaction;
    chairPose: { backrest: number; riderPop: number; shiver: number };
    cutscene: boolean;
    windowDusk: number;
    keysTried: KeysTried;
    meetingVisit: number;

    screenPoint(x: number, y: number): Vector;
    polygon(points: Vector[], color: string | Gradient, opts?: PathOptions): void;
    rgba(hex: string, alpha?: number): Color;
    rgb(hex: string): [number, number, number];
    gradientFill(x1: number, y1: number, x2: number, y2: number, stops: [number, string][], alpha?: number): Gradient;
    effectPath(start: Vector, curves: Curve[], fill: Gradient | string, opts?: PathOptions): void;
    strokePath(start: Vector, curves: Curve[], stroke: StrokeInput, opts?: PathOptions & { closed?: boolean }): void;
    pathCommand(start: Vector, curves: Curve[]): PathCommand;
    radialFill(cx: number, cy: number, r: number, stops: [number, string][], alpha?: number): Gradient;
    withTransform(transform: Partial<Pick<RenderCtx, 'ox' | 'oy' | 'rotation' | 'localScale' | 'mirror'>>, draw: () => void): void;
    withLayer(spec: LayerSpec, draw: () => void): void;
    beginLayer(spec: LayerSpec): void;
    endLayer(): void;
    gradientPolygon(points: Vector[], fill: Gradient, opts?: PathOptions): void;
    // Geometry is cached per key; draw must not depend on changing state.
    retainedGroup(key: string, bounds: Bounds, draw: () => void): void;
    visible(bounds: Bounds, margin?: number): boolean;
    ripple(x: number, y: number, rx: number, ry: number, width: number, color: string): void;
    tint(hex: string, alpha: number): string;
    rect(x: number, y: number, w: number, h: number, c: string): void;
    ellipse(x: number, y: number, rx: number, ry: number, c: string | Gradient, opts?: PathOptions): void;
    rod(x: number, y: number, xx: number, yy: number, w: number, c: string): void;
    // Baseline at world (x, y).
    label(text: string, x: number, y: number, size?: number, color?: string, font?: FontName): void;
    // Width at the requested size, in local units.
    measureText(content: string, size: number, font?: FontName): number;
    // Centred at local (x, y); follows the current transform.
    text(content: string, x: number, y: number, size: number, fill: string, opts?: TextOptions): void;
    // Centred at screen (x, y); ignores the camera.
    screenText(content: string, x: number, y: number, size: number, fill: string, opts?: TextOptions): void;
};

export type TextOptions = { font?: FontName; outline?: { width: number; color: string }; opacity?: number;   rotation?: number };
export type PathOptions = { blend?: Blend; trim?: [number, number] };
export type StrokeInput = { width: number; color: string | Gradient; cap?: Stroke['cap']; dash?: number[]; dashOffset?: number };

export function createRenderResources(bg: CanvasRenderingContext2D) {
    return {
        bg,
        retained: new Map<string, DrawCommand[]>(),
        textWidth(content: string, font: FontName) {
            if (typeof bg.measureText !== 'function') return content.length * .62;
            bg.font = fontCss(font, 100);
            return bg.measureText(content).width / 100;
        },
    };
}
export type RenderResources = ReturnType<typeof createRenderResources>;

export function createRenderCtx(resources: RenderResources, state: GameSnapshot, effects: EffectsState): RenderCtx {
    const ctx: RenderCtx = {
        bg: resources.bg,
        textWidth: (content, font) => resources.textWidth(content, font),
        locale: 'en', F: LEVEL.floor, TAU: Math.PI * 2, C: ART.palette,
        clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
        W: 800, H: 510, scale: 1, VW: 800, vertical: 0, dpr: 1, cam: 0, wheel: 0,
        ox: 0, oy: 0, rotation: 0, localScale: 1, mirror: null, layer: null, commands: [],
        state, player: state.player, mode: state.mode,
        monitors: state.monitors.map((monitor, index) => ({ ...monitor, ...ART.monitors[index] })),
        cleaning: state.cleaning, bin: { ...state.bin, bottom: ART.binBottom },
        copier: { ...state.copier, flash: effects.copierFlash }, urgentCopier: state.urgentCopier,
        people: state.people, solids: state.solids, papers: state.papers,
        inBin: state.inBin, soaked: state.soaked, soaks: 0, dirty: state.dirty, t: state.time,
        LEN: state.level.length, GOAL: state.level.goal,
        waterDrops: effects.waterDrops, waterRipples: effects.waterRipples,
        waterPour: effects.waterPour, waterPuddle: effects.waterPuddle, specks: effects.specks,
        paperFace: effects.paperFace, glare: effects.glare, practiceBurst: effects.practiceBurst,
        saveFlash: effects.saveFlash, personalBox: effects.personalBox,
        chairPose: { backrest: 0, riderPop: 0, shiver: 0 }, cutscene: false, windowDusk: 1,
        keysTried: effects.keysTried, meetingVisit: effects.meetingVisit,
        ...drawingMethods(() => ctx, resources),
    };
    return ctx;
}

function drawingMethods(getCtx: () => RenderCtx, { retained }: RenderResources) {
    const TAU = Math.PI * 2;
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const screenPoint: RenderCtx['screenPoint'] = (x, y) => {
        const c = Math.cos(getCtx().rotation);
        const s = Math.sin(getCtx().rotation);
        x *= getCtx().localScale;
        y *= getCtx().localScale;
        let wy = x * s + y * c + getCtx().oy;
        const mirror = getCtx().mirror;
        if (mirror) wy = mirror.y + (mirror.y - wy) * mirror.k;
        return [(x * c - y * s + getCtx().ox - getCtx().cam) * getCtx().scale, (wy + getCtx().vertical) * getCtx().scale];
    };
    const push = (cmd: DrawCommand) => {
        const layer = getCtx().layer;
        if (layer) cmd.layer = layer;
        getCtx().commands.push(cmd);
    };
    const polygon: RenderCtx['polygon'] = (points, color, opts) => {
        push({ kind: 'path', points: points.map(([x, y]) => getCtx().screenPoint(x, y)), fill: color, ...opts });
    };
    const rgb: RenderCtx['rgb'] = (hex) => {
        const h = hex.slice(1);
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    };
    const rgba: RenderCtx['rgba'] = (hex, alpha = 1) => {
        return [...getCtx().rgb(hex), Math.round((hex.length === 9 ? parseInt(hex.slice(7, 9), 16) : 255) * clamp(alpha, 0, 1))];
    };
    const gradientFill: RenderCtx['gradientFill'] = (x1, y1, x2, y2, stops, alpha = 1) => {
        return { from: getCtx().screenPoint(x1, y1), to: getCtx().screenPoint(x2, y2), stops: stops.map(([at, c]) => [at, getCtx().rgba(c, alpha)]) };
    };
    const pathCommand: RenderCtx['pathCommand'] = (start, curves) => ({ kind: 'path',
        points: [getCtx().screenPoint(...start)],
        curves: curves.map(c => [...getCtx().screenPoint(c[0], c[1]), ...getCtx().screenPoint(c[2], c[3]), ...getCtx().screenPoint(c[4], c[5])]),
        fill: null,
    });
    const effectPath: RenderCtx['effectPath'] = (start, curves, fill, opts) => {
        const cmd = getCtx().pathCommand(start, curves);
        cmd.fill = fill;
        if (opts?.blend) cmd.blend = opts.blend;
        if (opts?.trim) cmd.trim = opts.trim;
        push(cmd);
    };
    const strokePath: RenderCtx['strokePath'] = (start, curves, stroke, opts) => {
        const cmd = getCtx().pathCommand(start, curves);
        const unit = getCtx().scale * getCtx().localScale;
        cmd.open = !opts?.closed;
        cmd.stroke = {
            width: stroke.width * unit,
            color: stroke.color,
            cap: stroke.cap,
            dash: stroke.dash?.map(d => d * unit),
            dashOffset: stroke.dashOffset === undefined ? undefined : stroke.dashOffset * unit,
        };
        if (opts?.blend) cmd.blend = opts.blend;
        if (opts?.trim) cmd.trim = opts.trim;
        push(cmd);
    };
    const radialFill: RenderCtx['radialFill'] = (cx, cy, r, stops, alpha = 1) => ({
        from: getCtx().screenPoint(cx, cy),
        to: getCtx().screenPoint(cx + r, cy),
        radius: r * getCtx().scale * getCtx().localScale,
        stops: stops.map(([at, c]) => [at, getCtx().rgba(c, alpha)]),
    });
    const layers: (LayerSpec | null)[] = [];
    const beginLayer: RenderCtx['beginLayer'] = spec => {
        layers.push(getCtx().layer);
        getCtx().layer = spec;
    };
    const endLayer: RenderCtx['endLayer'] = () => {
        getCtx().layer = layers.pop() ?? null;
    };
    const withLayer: RenderCtx['withLayer'] = (spec, draw) => {
        const ctx = getCtx();
        const previous = ctx.layer;
        const depth = layers.length;
        ctx.layer = spec;
        try { draw(); } finally {
            ctx.layer = previous;
            layers.length = depth;
        }
    };
    const withTransform: RenderCtx['withTransform'] = (transform, draw) => {
        const ctx = getCtx();
        const { ox, oy, rotation, localScale, mirror } = ctx;
        Object.assign(ctx, transform);
        try { draw(); } finally {
            Object.assign(ctx, { ox, oy, rotation, localScale, mirror });
        }
    };
    const gradientPolygon: RenderCtx['gradientPolygon'] = (points, fill, opts) => {
        push({ kind: 'path', points: points.map(v => getCtx().screenPoint(...v)), fill: fill, ...opts });
    };
    const visible: RenderCtx['visible'] = (bounds, margin = 0) => {
        const left = getCtx().cam - margin, right = getCtx().cam + getCtx().VW + margin;
        const top = -getCtx().vertical - margin, bottom = getCtx().H / getCtx().scale - getCtx().vertical + margin;
        return bounds.right > left && bounds.left < right && bounds.bottom > top && bounds.top < bottom;
    };
    const retainedGroup: RenderCtx['retainedGroup'] = (key, bounds, draw) => {
        if (!getCtx().visible(bounds)) return;
        let geometry = retained.get(key);
        if (!geometry) {
            const saved = {
                commands: getCtx().commands, cam: getCtx().cam, vertical: getCtx().vertical, scale: getCtx().scale,
                ox: getCtx().ox, oy: getCtx().oy, rotation: getCtx().rotation, localScale: getCtx().localScale,
                mirror: getCtx().mirror, layer: getCtx().layer,
            };
            getCtx().commands = [];
            getCtx().cam = getCtx().vertical = getCtx().ox = getCtx().oy = getCtx().rotation = 0;
            getCtx().scale = getCtx().localScale = 1;
            getCtx().mirror = getCtx().layer = null;
            try {
                draw();
                geometry = getCtx().commands;
                retained.set(key, geometry);
            } finally {
                Object.assign(getCtx(), saved);
            }
        }
        const transform = {
            e11: getCtx().scale, e12: 0, e13: -getCtx().cam * getCtx().scale,
            e21: 0, e22: getCtx().scale, e23: getCtx().vertical * getCtx().scale,
            e31: 0 as const, e32: 0 as const, e33: 1 as const,
        };
        const screenBounds = {
            left: (bounds.left - getCtx().cam) * getCtx().scale,
            top: (bounds.top + getCtx().vertical) * getCtx().scale,
            right: (bounds.right - getCtx().cam) * getCtx().scale,
            bottom: (bounds.bottom + getCtx().vertical) * getCtx().scale,
        };
        const layer: LayerSpec = { key: `retained:${key}`, retained: { geometry: key, transform, bounds: screenBounds } };
        getCtx().commands.push(...geometry.map(command => ({ ...command, layer })));
    };
    const ripple: RenderCtx['ripple'] = (x, y, rx, ry, width, color) => {
        const points: Vector[] = [];
        for (let i = 0; i <= 24; i++) {
            const a = i / 24 * TAU;
            points.push([x + rx * Math.cos(a), y + ry * Math.sin(a)]);
        }
        for (let i = 24; i >= 0; i--) {
            const a = i / 24 * TAU;
            points.push([x + Math.max(0, rx - width) * Math.cos(a), y + Math.max(0, ry - width * .35) * Math.sin(a)]);
        }
        getCtx().polygon(points, color);
    };
    const tint: RenderCtx['tint'] = (hex, alpha) => hex + Math.round(clamp(alpha, 0, 1) * 255).toString(16).padStart(2, '0');
    const rect: RenderCtx['rect'] = (x, y, w, h, c) => {
        getCtx().polygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], c);
    };
    const ellipse: RenderCtx['ellipse'] = (x, y, rx, ry, c, opts) => {
        getCtx().polygon(Array.from({ length: 16 }, (_, i) => [x + rx * Math.cos(i / 16 * TAU), y + ry * Math.sin(i / 16 * TAU)]), c, opts);
    };
    const rod: RenderCtx['rod'] = (x, y, xx, yy, w, c) => {
        const dx = xx - x;
        const dy = yy - y;
        const l = Math.hypot(dx, dy) || 1;
        const nx = -dy / l * w / 2;
        const ny = dx / l * w / 2;
        getCtx().polygon([[x + nx, y + ny], [xx + nx, yy + ny], [xx - nx, yy - ny], [x - nx, y - ny]], c);
    };
    const measureText: RenderCtx['measureText'] = (content, size, font = SIGN_FONT) => getCtx().textWidth(fitGlyphs(content), font) * size;
    const pushText = (content: string, cx: number, cy: number, size: number, rotation: number, fill: string, opts: TextOptions = {}) => {
        const font = opts.font ?? SIGN_FONT;
        content = fitGlyphs(content);
        const outline = opts.outline?.width ?? 0;
        const halfWidth = getCtx().textWidth(content, font) * size / 2 + outline;
        const halfHeight = size * .6 + outline;
        const c = Math.cos(rotation), s = Math.sin(rotation);
        const box = ([[-halfWidth, -halfHeight], [halfWidth, -halfHeight], [halfWidth, halfHeight], [-halfWidth, halfHeight]] as Vector[])
            .map(([bx, by]): Vector => [cx + bx * c - by * s, cy + bx * s + by * c]);
        const text: TextSpec = {
            content, font, size, x: cx, y: cy, rotation, fill,
            ...(opts.outline ? { outline: opts.outline } : {}),
            ...(opts.opacity !== undefined ? { opacity: opts.opacity } : {}),
        };
        push({ kind: 'text', points: box, text });
    };
    const text: RenderCtx['text'] = (content, x, y, size, fill, opts) => {
        const unit = getCtx().scale * getCtx().localScale;
        const [cx, cy] = getCtx().screenPoint(x, y);
        const outline = opts?.outline && { width: opts.outline.width * unit, color: opts.outline.color };
        pushText(content, cx, cy, size * unit, getCtx().rotation, fill, { ...opts, outline });
    };
    const screenText: RenderCtx['screenText'] = (content, x, y, size, fill, opts) => pushText(content, x, y, size, opts?.rotation ?? 0, fill, opts);
    const label: RenderCtx['label'] = (text, x, y, size = 12, color = '#333d4b', font = LABEL_FONT) => {
        getCtx().text(text, x, y - size * .35, size, color, { font });
    };

    return { withTransform, withLayer, screenPoint, polygon, rgb, rgba, gradientFill, pathCommand, effectPath, strokePath, radialFill, beginLayer, endLayer, gradientPolygon, visible, retainedGroup, ripple, tint, rect, ellipse, rod, measureText, text, screenText, label };
}
