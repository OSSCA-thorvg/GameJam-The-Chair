import type { Locale } from '../i18n';
import { LEVEL } from '../game/level';
import type { GameState } from '../game/game';
import type { DeepReadonly, Mode } from '../game/types';
import type { Vector, Curve, Color, Gradient, DrawCommand, LayerSpec, Blend, Stroke, Bounds, TextSpec } from './types';
import { fitGlyphs, fontCss, LABEL_FONT, SIGN_FONT, type FontName } from './fonts';
import { ART } from './art';
import type { EffectsState } from './effects';
import type { PersonalBoxReaction } from './personal-box-motion';
import type { KeysTried } from './key-hints';

export type RenderCtx = {
    locale: Locale;
    bg: CanvasRenderingContext2D;
    /** Width of `content` in `font` at 1px; ThorVG measures once it has loaded, Canvas2D until then. */
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
    /** Reflect world y around `y`, squashed by `k` (floor-plane reflections). */
    mirror: { y: number; k: number } | null;
    layer: LayerSpec | null;

    commands: DrawCommand[];

    state: GameState;
    p: GameState['player'];
    mode: Mode;
    monitors: (GameState['monitors'][number] & typeof ART.monitors[number])[];
    cleaning: GameState['cleaning'];
    bin: GameState['bin'] & { bottom: number };
    copier: GameState['copier'] & { flash: number };
    urgentCopier: GameState['urgentCopier'];
    people: GameState['people'];
    solids: GameState['solids'];
    papers: GameState['papers'];
    inBin: boolean;
    soaked: boolean;
    /** How many times the dirty bucket water has splashed the rider this attempt; each adds a layer of stains. */
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
    /** Which hinted keys the player has tried this stage; their keycap hints are gone. */
    keysTried: KeysTried;

    screenPoint(x: number, y: number): Vector;
    polygon(points: Vector[], color: string | Gradient, opts?: PathOptions): void;
    rgba(hex: string, alpha?: number): Color;
    rgb(hex: string): [number, number, number];
    gradientFill(x1: number, y1: number, x2: number, y2: number, stops: [number, string][], alpha?: number): Gradient;
    effectPath(start: Vector, curves: Curve[], fill: Gradient | string, opts?: PathOptions): void;
    strokePath(start: Vector, curves: Curve[], stroke: StrokeInput, opts?: PathOptions & { closed?: boolean }): void;
    pathCommand(start: Vector, curves: Curve[]): DrawCommand;
    radialFill(cx: number, cy: number, r: number, stops: [number, string][], alpha?: number): Gradient;
    beginLayer(spec: LayerSpec): void;
    endLayer(): void;
    gradientPolygon(points: Vector[], fill: Gradient, opts?: PathOptions): void;
    /** Build immutable local geometry once; ThorVG moves its retained Scene with the camera thereafter. */
    retainedGroup(key: string, bounds: Bounds, draw: () => void): void;
    /** Conservative world-space visibility test for skipping whole scene groups before command creation. */
    visible(bounds: Bounds, margin?: number): boolean;
    ripple(x: number, y: number, rx: number, ry: number, width: number, color: string): void;
    tint(hex: string, alpha: number): string;
    rect(x: number, y: number, w: number, h: number, c: string): void;
    ellipse(x: number, y: number, rx: number, ry: number, c: string | Gradient, opts?: PathOptions): void;
    rod(x: number, y: number, xx: number, yy: number, w: number, c: string): void;
    /** System label: a Do Hyeon line whose baseline sits at world (x, y), ordered with the shapes around it. */
    label(text: string, x: number, y: number, size?: number, color?: string, font?: FontName): void;
    /** Width of one line of `font` text at `size` local units, in local units. */
    measureText(content: string, size: number, font?: FontName): number;
    /** One line of ThorVG Text centred on local (x, y), turning with the current rotation. */
    text(content: string, x: number, y: number, size: number, fill: string, opts?: TextOptions): void;
    /** One line of ThorVG Text centred on canvas pixel (x, y), ignoring the camera. */
    screenText(content: string, x: number, y: number, size: number, fill: string, opts?: TextOptions): void;
};

export type TextOptions = { font?: FontName; outline?: { width: number; color: string }; opacity?: number; /** Screen text only, in radians. */ rotation?: number };
export type PathOptions = { blend?: Blend; trim?: [number, number] };
export type StrokeInput = { width: number; color: string | Gradient; cap?: Stroke['cap']; dash?: number[]; dashOffset?: number };

export function createRenderCtx(bg: CanvasRenderingContext2D): RenderCtx {
    const TAU = Math.PI * 2;
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const ctx = {
        locale: 'en' satisfies Locale,
        bg,
        F: LEVEL.floor,
        TAU,
        C: ART.palette,
        clamp,
        W: 800,
        H: 510,
        scale: 1,
        VW: 800,
        vertical: 0,
        dpr: 1,
        cam: 0,
        wheel: 0,
        ox: 0,
        oy: 0,
        rotation: 0,
        localScale: 1,
        mirror: null,
        layer: null,
        commands: [] as DrawCommand[],
        state: null as unknown as GameState,
        p: null as unknown as GameState['player'],
        mode: 'intro' as Mode,
        monitors: [] as RenderCtx['monitors'],
        cleaning: null as unknown as GameState['cleaning'],
        bin: null as unknown as GameState['bin'] & { bottom: number },
        copier: null as unknown as GameState['copier'] & { flash: number },
        urgentCopier: null as unknown as GameState['urgentCopier'],
        people: [] as unknown as GameState['people'],
        solids: [] as unknown as GameState['solids'],
        papers: [] as unknown as GameState['papers'],
        inBin: false,
        soaked: false,
        soaks: 0,
        dirty: false,
        t: 0,
        LEN: LEVEL.length,
        GOAL: LEVEL.goal,
        waterDrops: [] as DeepReadonly<EffectsState['waterDrops']>,
        waterRipples: [] as DeepReadonly<EffectsState['waterRipples']>,
        waterPour: null,
        waterPuddle: null,
        specks: [] as DeepReadonly<EffectsState['specks']>,
        paperFace: 0,
        glare: 0,
        practiceBurst: 0,
        saveFlash: 0,
        personalBox: { kind: 'idle' },
        keysTried: { left: false, right: false, jump: false, spray: false },
    } as unknown as RenderCtx;

    ctx.screenPoint = (x, y) => {
        const c = Math.cos(ctx.rotation);
        const s = Math.sin(ctx.rotation);
        x *= ctx.localScale;
        y *= ctx.localScale;
        let wy = x * s + y * c + ctx.oy;
        if (ctx.mirror) wy = ctx.mirror.y + (ctx.mirror.y - wy) * ctx.mirror.k;
        return [(x * c - y * s + ctx.ox - ctx.cam) * ctx.scale, (wy + ctx.vertical) * ctx.scale];
    };
    const push = (cmd: DrawCommand) => {
        if (ctx.layer) cmd.layer = ctx.layer;
        ctx.commands.push(cmd);
    };
    ctx.polygon = (points, color, opts) => {
        push({ v: points.map(([x, y]) => ctx.screenPoint(x, y)), c: color, ...opts });
    };
    ctx.rgb = (hex) => {
        const h = hex.slice(1);
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    };
    ctx.rgba = (hex, alpha = 1) => {
        return [...ctx.rgb(hex), Math.round((hex.length === 9 ? parseInt(hex.slice(7, 9), 16) : 255) * clamp(alpha, 0, 1))];
    };
    ctx.gradientFill = (x1, y1, x2, y2, stops, alpha = 1) => {
        return { from: ctx.screenPoint(x1, y1), to: ctx.screenPoint(x2, y2), stops: stops.map(([at, c]) => [at, ctx.rgba(c, alpha)]) };
    };
    ctx.pathCommand = (start, curves) => ({
        v: [ctx.screenPoint(...start)],
        curves: curves.map(c => [...ctx.screenPoint(c[0], c[1]), ...ctx.screenPoint(c[2], c[3]), ...ctx.screenPoint(c[4], c[5])]),
        c: null,
    });
    ctx.effectPath = (start, curves, fill, opts) => {
        const cmd = ctx.pathCommand(start, curves);
        cmd.c = fill;
        if (opts?.blend) cmd.blend = opts.blend;
        if (opts?.trim) cmd.trim = opts.trim;
        push(cmd);
    };
    ctx.strokePath = (start, curves, stroke, opts) => {
        const cmd = ctx.pathCommand(start, curves);
        const unit = ctx.scale * ctx.localScale;
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
    ctx.radialFill = (cx, cy, r, stops, alpha = 1) => ({
        from: ctx.screenPoint(cx, cy),
        to: ctx.screenPoint(cx + r, cy),
        radius: r * ctx.scale * ctx.localScale,
        stops: stops.map(([at, c]) => [at, ctx.rgba(c, alpha)]),
    });
    ctx.beginLayer = (spec) => {
        ctx.layer = spec;
    };
    ctx.endLayer = () => {
        ctx.layer = null;
    };
    ctx.gradientPolygon = (points, fill, opts) => {
        push({ v: points.map(v => ctx.screenPoint(...v)), c: fill, ...opts });
    };
    const retained = new Map<string, DrawCommand[]>();
    ctx.visible = (bounds, margin = 0) => {
        const left = ctx.cam - margin, right = ctx.cam + ctx.VW + margin;
        const top = -ctx.vertical - margin, bottom = ctx.H / ctx.scale - ctx.vertical + margin;
        return bounds.right > left && bounds.left < right && bounds.bottom > top && bounds.top < bottom;
    };
    ctx.retainedGroup = (key, bounds, draw) => {
        if (!ctx.visible(bounds)) return;
        let geometry = retained.get(key);
        if (!geometry) {
            const saved = {
                commands: ctx.commands, cam: ctx.cam, vertical: ctx.vertical, scale: ctx.scale,
                ox: ctx.ox, oy: ctx.oy, rotation: ctx.rotation, localScale: ctx.localScale,
                mirror: ctx.mirror, layer: ctx.layer,
            };
            ctx.commands = [];
            ctx.cam = ctx.vertical = ctx.ox = ctx.oy = ctx.rotation = 0;
            ctx.scale = ctx.localScale = 1;
            ctx.mirror = ctx.layer = null;
            try {
                draw();
                geometry = ctx.commands;
                retained.set(key, geometry);
            } finally {
                Object.assign(ctx, saved);
            }
        }
        const transform = {
            e11: ctx.scale, e12: 0, e13: -ctx.cam * ctx.scale,
            e21: 0, e22: ctx.scale, e23: ctx.vertical * ctx.scale,
            e31: 0 as const, e32: 0 as const, e33: 1 as const,
        };
        const screenBounds = {
            left: (bounds.left - ctx.cam) * ctx.scale,
            top: (bounds.top + ctx.vertical) * ctx.scale,
            right: (bounds.right - ctx.cam) * ctx.scale,
            bottom: (bounds.bottom + ctx.vertical) * ctx.scale,
        };
        const layer: LayerSpec = { key: `retained:${key}`, retained: { geometry: key, transform, bounds: screenBounds } };
        ctx.commands.push(...geometry.map(command => ({ ...command, layer })));
    };
    ctx.ripple = (x, y, rx, ry, width, color) => {
        const points: Vector[] = [];
        for (let i = 0; i <= 24; i++) {
            const a = i / 24 * TAU;
            points.push([x + rx * Math.cos(a), y + ry * Math.sin(a)]);
        }
        for (let i = 24; i >= 0; i--) {
            const a = i / 24 * TAU;
            points.push([x + Math.max(0, rx - width) * Math.cos(a), y + Math.max(0, ry - width * .35) * Math.sin(a)]);
        }
        ctx.polygon(points, color);
    };
    ctx.tint = (hex, alpha) => hex + Math.round(clamp(alpha, 0, 1) * 255).toString(16).padStart(2, '0');
    ctx.rect = (x, y, w, h, c) => {
        ctx.polygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], c);
    };
    ctx.ellipse = (x, y, rx, ry, c, opts) => {
        ctx.polygon(Array.from({ length: 16 }, (_, i) => [x + rx * Math.cos(i / 16 * TAU), y + ry * Math.sin(i / 16 * TAU)]), c, opts);
    };
    ctx.rod = (x, y, xx, yy, w, c) => {
        const dx = xx - x;
        const dy = yy - y;
        const l = Math.hypot(dx, dy) || 1;
        const nx = -dy / l * w / 2;
        const ny = dx / l * w / 2;
        ctx.polygon([[x + nx, y + ny], [xx + nx, yy + ny], [xx - nx, yy - ny], [x - nx, y - ny]], c);
    };
    ctx.textWidth = (content, font) => {
        const measure = (bg as Partial<CanvasRenderingContext2D>).measureText;
        if (typeof measure !== 'function') return content.length * .62;
        bg.font = fontCss(font, 100);
        return measure.call(bg, content).width / 100;
    };
    ctx.measureText = (content, size, font = SIGN_FONT) => ctx.textWidth(fitGlyphs(content), font) * size;
    const pushText = (content: string, cx: number, cy: number, size: number, rotation: number, fill: string, opts: TextOptions = {}) => {
        const font = opts.font ?? SIGN_FONT;
        content = fitGlyphs(content);
        const outline = opts.outline?.width ?? 0;
        const halfWidth = ctx.textWidth(content, font) * size / 2 + outline;
        const halfHeight = size * .6 + outline;
        const c = Math.cos(rotation), s = Math.sin(rotation);
        const box = ([[-halfWidth, -halfHeight], [halfWidth, -halfHeight], [halfWidth, halfHeight], [-halfWidth, halfHeight]] as Vector[])
            .map(([bx, by]): Vector => [cx + bx * c - by * s, cy + bx * s + by * c]);
        const text: TextSpec = {
            content, font, size, x: cx, y: cy, rotation, fill,
            ...(opts.outline ? { outline: opts.outline } : {}),
            ...(opts.opacity !== undefined ? { opacity: opts.opacity } : {}),
        };
        push({ v: box, c: fill, text });
    };
    ctx.text = (content, x, y, size, fill, opts) => {
        const unit = ctx.scale * ctx.localScale;
        const [cx, cy] = ctx.screenPoint(x, y);
        const outline = opts?.outline && { width: opts.outline.width * unit, color: opts.outline.color };
        pushText(content, cx, cy, size * unit, ctx.rotation, fill, { ...opts, outline });
    };
    ctx.screenText = (content, x, y, size, fill, opts) => pushText(content, x, y, size, opts?.rotation ?? 0, fill, opts);
    // A label's y is its baseline, as with Canvas2D fillText; the middle of the line sits a third of a size above.
    ctx.label = (text, x, y, size = 12, color = '#333d4b', font = LABEL_FONT) => {
        ctx.text(text, x, y - size * .35, size, color, { font });
    };

    return ctx;
}
