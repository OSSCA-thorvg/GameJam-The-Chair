import { ART } from './art';
import { fitGlyphs, fontCss, LABEL_FONT, SIGN_FONT } from './fonts';
import { LEVEL } from '../game/level';

import type { EffectsState } from './effects';
import type { FontName } from './fonts';
import type { KeysTried } from './key-hints';
import type { PersonalBoxReaction } from './personal-box-motion';
import type {
    Vector,
    Curve,
    Color,
    Gradient,
    DrawCommand,
    PathCommand,
    LayerSpec,
    Blend,
    Stroke,
    Bounds,
    TextSpec,
} from './types';
import type { GameSnapshot } from '../game/game';
import type { DeepReadonly, Mode } from '../game/types';
import type { Locale } from '../i18n';
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
    mirror: {
        y: number;
        k: number;
    } | null;
    layer: LayerSpec | null;
    commands: DrawCommand[];
    state: GameSnapshot;
    player: GameSnapshot['player'];
    mode: Mode;
    monitors: Array<
        GameSnapshot['monitors'][number] & (typeof ART.monitors)[number]
    >;
    cleaning: GameSnapshot['cleaning'];
    bin: GameSnapshot['bin'] & {
        bottom: number;
    };
    copier: GameSnapshot['copier'] & {
        flash: number;
    };
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
    chairPose: {
        backrest: number;
        riderPop: number;
        shiver: number;
    };
    cutscene: boolean;
    windowDusk: number;
    keysTried: KeysTried;
    meetingVisit: number;
    screenPoint(x: number, y: number): Vector;
    polygon(
        points: Vector[],
        color: string | Gradient,
        opts?: PathOptions,
    ): void;
    rgba(hex: string, alpha?: number): Color;
    rgb(hex: string): [number, number, number];
    gradientFill(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        options: {
            stops: Array<[number, string]>;
            alpha?: number;
        },
    ): Gradient;
    effectPath(
        start: Vector,
        curves: Curve[],
        fill: Gradient | string,
        opts?: PathOptions,
    ): void;
    strokePath(
        start: Vector,
        curves: Curve[],
        stroke: StrokeInput,
        opts?: PathOptions & {
            closed?: boolean;
        },
    ): void;
    pathCommand(start: Vector, curves: Curve[]): PathCommand;
    radialFill(
        cx: number,
        cy: number,
        r: number,
        stops: Array<[number, string]>,
        alpha?: number,
    ): Gradient;
    withTransform(
        transform: Partial<
            Pick<RenderCtx, 'ox' | 'oy' | 'rotation' | 'localScale' | 'mirror'>
        >,
        draw: () => void,
    ): void;
    withLayer(spec: LayerSpec, draw: () => void): void;
    beginLayer(spec: LayerSpec): void;
    endLayer(): void;
    gradientPolygon(points: Vector[], fill: Gradient, opts?: PathOptions): void;
    // Geometry is cached per key; draw must not depend on changing state.
    retainedGroup(key: string, bounds: Bounds, draw: () => void): void;
    visible(bounds: Bounds, margin?: number): boolean;
    ripple(
        x: number,
        y: number,
        rx: number,
        ry: number,
        options: {
            width: number;
            color: string;
        },
    ): void;
    tint(hex: string, alpha: number): string;
    rect(x: number, y: number, w: number, h: number, c: string): void;
    ellipse(
        x: number,
        y: number,
        rx: number,
        ry: number,
        options: {
            c: string | Gradient;
            opts?: PathOptions;
        },
    ): void;
    rod(
        x: number,
        y: number,
        xx: number,
        yy: number,
        options: {
            w: number;
            c: string;
        },
    ): void;
    // Baseline at world (x, y).
    label(
        text: string,
        x: number,
        y: number,
        size?: number,
        options?: {
            color?: string;
            font?: FontName;
        },
    ): void;
    // Width at the requested size, in local units.
    measureText(content: string, size: number, font?: FontName): number;
    // Centred at local (x, y); follows the current transform.
    text(
        content: string,
        x: number,
        y: number,
        size: number,
        options: {
            fill: string;
            opts?: TextOptions;
        },
    ): void;
    // Centred at screen (x, y); ignores the camera.
    screenText(
        content: string,
        x: number,
        y: number,
        size: number,
        options: {
            fill: string;
            opts?: TextOptions;
        },
    ): void;
};
export type TextOptions = {
    font?: FontName;
    outline?: { width: number; color: string };
    opacity?: number;
    rotation?: number;
};
export type PathOptions = { blend?: Blend; trim?: [number, number] };
export type StrokeInput = {
    width: number;
    color: string | Gradient;
    cap?: Stroke['cap'];
    dash?: number[];
    dashOffset?: number;
};
export function createRenderResources(bg: CanvasRenderingContext2D): {
    bg: CanvasRenderingContext2D;
    retained: Map<string, DrawCommand[]>;
    textWidth(content: string, font: FontName): number;
} {
    return {
        bg,
        retained: new Map<string, DrawCommand[]>(),
        textWidth(content: string, font: FontName) {
            if (typeof bg.measureText !== 'function') {
                return content.length * 0.62;
            }
            bg.font = fontCss(font, 100);
            return bg.measureText(content).width / 100;
        },
    };
}
export type RenderResources = ReturnType<typeof createRenderResources>;
export function createRenderCtx(
    resources: RenderResources,
    state: GameSnapshot,
    effects: EffectsState,
): RenderCtx {
    const ctx: RenderCtx = {
        bg: resources.bg,
        textWidth: (content, font) => resources.textWidth(content, font),
        locale: 'en',
        F: LEVEL.floor,
        TAU: Math.PI * 2,
        C: ART.palette,
        clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
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
        commands: [],
        state,
        player: state.player,
        mode: state.mode,
        monitors: state.monitors.map((monitor, index) => ({
            ...monitor,
            ...ART.monitors[index],
        })),
        cleaning: state.cleaning,
        bin: { ...state.bin, bottom: ART.binBottom },
        copier: { ...state.copier, flash: effects.copierFlash },
        urgentCopier: state.urgentCopier,
        people: state.people,
        solids: state.solids,
        papers: state.papers,
        inBin: state.inBin,
        soaked: state.soaked,
        soaks: 0,
        dirty: state.dirty,
        t: state.time,
        LEN: state.level.length,
        GOAL: state.level.goal,
        waterDrops: effects.waterDrops,
        waterRipples: effects.waterRipples,
        waterPour: effects.waterPour,
        waterPuddle: effects.waterPuddle,
        specks: effects.specks,
        paperFace: effects.paperFace,
        glare: effects.glare,
        practiceBurst: effects.practiceBurst,
        saveFlash: effects.saveFlash,
        personalBox: effects.personalBox,
        chairPose: { backrest: 0, riderPop: 0, shiver: 0 },
        cutscene: false,
        windowDusk: 1,
        keysTried: effects.keysTried,
        meetingVisit: effects.meetingVisit,
        ...drawingMethods(() => ctx, resources),
    };
    return ctx;
}
function drawingMethods(
    getCtx: () => RenderCtx,
    { retained }: RenderResources,
) {
    return new DrawingMethods(getCtx, retained).api();
}
class DrawingMethods {
    private getCtx!: () => RenderCtx;
    private retained!: Map<string, DrawCommand[]>;
    private TAU!: number;
    private clamp: (v: number, a: number, b: number) => number = (
        v: number,
        a: number,
        b: number,
    ) => {
        return Math.max(a, Math.min(b, v));
    };
    private screenPoint: RenderCtx['screenPoint'] = (x, y) => {
        const c = Math.cos(this.getCtx().rotation);
        const s = Math.sin(this.getCtx().rotation);
        x *= this.getCtx().localScale;
        y *= this.getCtx().localScale;
        let wy = x * s + y * c + this.getCtx().oy;
        const mirror = this.getCtx().mirror;
        if (mirror) {
            wy = mirror.y + (mirror.y - wy) * mirror.k;
        }
        return [
            (x * c - y * s + this.getCtx().ox - this.getCtx().cam) *
                this.getCtx().scale,
            (wy + this.getCtx().vertical) * this.getCtx().scale,
        ];
    };
    private push: (cmd: DrawCommand) => void = (cmd: DrawCommand) => {
        const layer = this.getCtx().layer;
        if (layer) {
            cmd.layer = layer;
        }
        this.getCtx().commands.push(cmd);
    };
    private polygon: RenderCtx['polygon'] = (points, color, opts) => {
        this.push({
            kind: 'path',
            points: points.map(([x, y]) => this.getCtx().screenPoint(x, y)),
            fill: color,
            ...opts,
        });
    };
    private rgb: RenderCtx['rgb'] = (hex) => {
        const h = hex.slice(1);
        return [
            parseInt(h.slice(0, 2), 16),
            parseInt(h.slice(2, 4), 16),
            parseInt(h.slice(4, 6), 16),
        ];
    };
    private rgba: RenderCtx['rgba'] = (hex, alpha = 1) => {
        return [
            ...this.getCtx().rgb(hex),
            Math.round(
                (hex.length === 9 ? parseInt(hex.slice(7, 9), 16) : 255) *
                    this.clamp(alpha, 0, 1),
            ),
        ];
    };
    private gradientFill: RenderCtx['gradientFill'] = (
        x1,
        y1,
        x2,
        y2,
        {
            stops,
            alpha = 1,
        }: {
            stops: Array<[number, string]>;
            alpha?: number | undefined;
        },
    ) => {
        return {
            from: this.getCtx().screenPoint(x1, y1),
            to: this.getCtx().screenPoint(x2, y2),
            stops: stops.map(([at, c]) => [at, this.getCtx().rgba(c, alpha)]),
        };
    };
    private pathCommand: RenderCtx['pathCommand'] = (start, curves) => {
        return {
            kind: 'path',
            points: [this.getCtx().screenPoint(...start)],
            curves: curves.map((c) => [
                ...this.getCtx().screenPoint(c[0], c[1]),
                ...this.getCtx().screenPoint(c[2], c[3]),
                ...this.getCtx().screenPoint(c[4], c[5]),
            ]),
            fill: null,
        };
    };
    private effectPath: RenderCtx['effectPath'] = (
        start,
        curves,
        fill,
        opts,
    ) => {
        const cmd = this.getCtx().pathCommand(start, curves);
        cmd.fill = fill;
        if (opts?.blend) {
            cmd.blend = opts.blend;
        }
        if (opts?.trim) {
            cmd.trim = opts.trim;
        }
        this.push(cmd);
    };
    private strokePath: RenderCtx['strokePath'] = (
        start,
        curves,
        stroke,
        opts,
    ) => {
        const cmd = this.getCtx().pathCommand(start, curves);
        const unit = this.getCtx().scale * this.getCtx().localScale;
        cmd.open = !opts?.closed;
        cmd.stroke = {
            width: stroke.width * unit,
            color: stroke.color,
            cap: stroke.cap,
            dash: stroke.dash?.map((d) => d * unit),
            dashOffset:
                stroke.dashOffset === undefined
                    ? undefined
                    : stroke.dashOffset * unit,
        };
        if (opts?.blend) {
            cmd.blend = opts.blend;
        }
        if (opts?.trim) {
            cmd.trim = opts.trim;
        }
        this.push(cmd);
    };
    private radialFill: RenderCtx['radialFill'] = (
        cx,
        cy,
        r,
        stops,
        alpha = 1,
    ) => {
        return {
            from: this.getCtx().screenPoint(cx, cy),
            to: this.getCtx().screenPoint(cx + r, cy),
            radius: r * this.getCtx().scale * this.getCtx().localScale,
            stops: stops.map(([at, c]) => [at, this.getCtx().rgba(c, alpha)]),
        };
    };
    private layers!: Array<LayerSpec | null>;
    private beginLayer: RenderCtx['beginLayer'] = (spec) => {
        this.layers.push(this.getCtx().layer);
        this.getCtx().layer = spec;
    };
    private endLayer: RenderCtx['endLayer'] = () => {
        this.getCtx().layer = this.layers.pop() ?? null;
    };
    private withLayer: RenderCtx['withLayer'] = (spec, draw) => {
        const ctx = this.getCtx();
        const previous = ctx.layer;
        const depth = this.layers.length;
        ctx.layer = spec;
        try {
            draw();
        } finally {
            ctx.layer = previous;
            this.layers.length = depth;
        }
    };
    private withTransform: RenderCtx['withTransform'] = (transform, draw) => {
        const ctx = this.getCtx();
        const { ox, oy, rotation, localScale, mirror } = ctx;
        Object.assign(ctx, transform);
        try {
            draw();
        } finally {
            Object.assign(ctx, { ox, oy, rotation, localScale, mirror });
        }
    };
    private gradientPolygon: RenderCtx['gradientPolygon'] = (
        points,
        fill,
        opts,
    ) => {
        this.push({
            kind: 'path',
            points: points.map((v) => this.getCtx().screenPoint(...v)),
            fill,
            ...opts,
        });
    };
    private visible: RenderCtx['visible'] = (bounds, margin = 0) => {
        const left = this.getCtx().cam - margin;
        const right = this.getCtx().cam + this.getCtx().VW + margin;
        const top = -this.getCtx().vertical - margin;
        const bottom =
            this.getCtx().H / this.getCtx().scale -
            this.getCtx().vertical +
            margin;
        return (
            bounds.right > left &&
            bounds.left < right &&
            bounds.bottom > top &&
            bounds.top < bottom
        );
    };
    private retainedGroup: RenderCtx['retainedGroup'] = (key, bounds, draw) => {
        if (!this.getCtx().visible(bounds)) {
            return;
        }
        let geometry = this.retained.get(key);
        if (!geometry) {
            const saved = {
                commands: this.getCtx().commands,
                cam: this.getCtx().cam,
                vertical: this.getCtx().vertical,
                scale: this.getCtx().scale,
                ox: this.getCtx().ox,
                oy: this.getCtx().oy,
                rotation: this.getCtx().rotation,
                localScale: this.getCtx().localScale,
                mirror: this.getCtx().mirror,
                layer: this.getCtx().layer,
            };
            this.getCtx().commands = [];
            this.getCtx().cam =
                this.getCtx().vertical =
                this.getCtx().ox =
                this.getCtx().oy =
                this.getCtx().rotation =
                    0;
            this.getCtx().scale = this.getCtx().localScale = 1;
            this.getCtx().mirror = this.getCtx().layer = null;
            try {
                draw();
                geometry = this.getCtx().commands;
                this.retained.set(key, geometry);
            } finally {
                Object.assign(this.getCtx(), saved);
            }
        }
        const transform = {
            e11: this.getCtx().scale,
            e12: 0,
            e13: -this.getCtx().cam * this.getCtx().scale,
            e21: 0,
            e22: this.getCtx().scale,
            e23: this.getCtx().vertical * this.getCtx().scale,
            e31: 0 as const,
            e32: 0 as const,
            e33: 1 as const,
        };
        const screenBounds = {
            left: (bounds.left - this.getCtx().cam) * this.getCtx().scale,
            top: (bounds.top + this.getCtx().vertical) * this.getCtx().scale,
            right: (bounds.right - this.getCtx().cam) * this.getCtx().scale,
            bottom:
                (bounds.bottom + this.getCtx().vertical) * this.getCtx().scale,
        };
        const layer: LayerSpec = {
            key: `retained:${key}`,
            retained: { geometry: key, transform, bounds: screenBounds },
        };
        this.getCtx().commands.push(
            ...geometry.map((command) => ({ ...command, layer })),
        );
    };
    private ripple: RenderCtx['ripple'] = (
        x,
        y,
        rx,
        ry,
        {
            width,
            color,
        }: {
            width: number;
            color: string;
        },
    ) => {
        const points: Vector[] = [];
        for (let i = 0; i <= 24; i++) {
            const a = (i / 24) * this.TAU;
            points.push([x + rx * Math.cos(a), y + ry * Math.sin(a)]);
        }
        for (let i = 24; i >= 0; i--) {
            const a = (i / 24) * this.TAU;
            points.push([
                x + Math.max(0, rx - width) * Math.cos(a),
                y + Math.max(0, ry - width * 0.35) * Math.sin(a),
            ]);
        }
        this.getCtx().polygon(points, color);
    };
    private tint: RenderCtx['tint'] = (hex, alpha) => {
        return (
            hex +
            Math.round(this.clamp(alpha, 0, 1) * 255)
                .toString(16)
                .padStart(2, '0')
        );
    };
    private rect: RenderCtx['rect'] = (x, y, w, h, c) => {
        this.getCtx().polygon(
            [
                [x, y],
                [x + w, y],
                [x + w, y + h],
                [x, y + h],
            ],
            c,
        );
    };
    private ellipse: RenderCtx['ellipse'] = (
        x,
        y,
        rx,
        ry,
        {
            c,
            opts,
        }: {
            c: string | Gradient;
            opts: PathOptions | undefined;
        },
    ) => {
        this.getCtx().polygon(
            Array.from({ length: 16 }, (_, i) => [
                x + rx * Math.cos((i / 16) * this.TAU),
                y + ry * Math.sin((i / 16) * this.TAU),
            ]),
            c,
            opts,
        );
    };
    private rod: RenderCtx['rod'] = (
        x,
        y,
        xx,
        yy,
        {
            w,
            c,
        }: {
            w: number;
            c: string;
        },
    ) => {
        const dx = xx - x;
        const dy = yy - y;
        const l = Math.hypot(dx, dy) || 1;
        const nx = ((-dy / l) * w) / 2;
        const ny = ((dx / l) * w) / 2;
        this.getCtx().polygon(
            [
                [x + nx, y + ny],
                [xx + nx, yy + ny],
                [xx - nx, yy - ny],
                [x - nx, y - ny],
            ],
            c,
        );
    };
    private measureText: RenderCtx['measureText'] = (
        content,
        size,
        font = SIGN_FONT,
    ) => {
        return this.getCtx().textWidth(fitGlyphs(content), font) * size;
    };
    private pushText: (
        content: string,
        cx: number,
        cy: number,
        size: number,
        {
            rotation,
            fill,
            opts,
        }: {
            rotation: number;
            fill: string;
            opts?: TextOptions;
        },
    ) => void = (
        content: string,
        cx: number,
        cy: number,
        size: number,
        {
            rotation,
            fill,
            opts = {},
        }: {
            rotation: number;
            fill: string;
            opts?: TextOptions;
        },
    ) => {
        const font = opts.font ?? SIGN_FONT;
        content = fitGlyphs(content);
        const outline = opts.outline?.width ?? 0;
        const halfWidth =
            (this.getCtx().textWidth(content, font) * size) / 2 + outline;
        const halfHeight = size * 0.6 + outline;
        const c = Math.cos(rotation);
        const s = Math.sin(rotation);
        const box = (
            [
                [-halfWidth, -halfHeight],
                [halfWidth, -halfHeight],
                [halfWidth, halfHeight],
                [-halfWidth, halfHeight],
            ] as Vector[]
        ).map(([bx, by]): Vector => [
            cx + bx * c - by * s,
            cy + bx * s + by * c,
        ]);
        const text: TextSpec = {
            content,
            font,
            size,
            x: cx,
            y: cy,
            rotation,
            fill,
            ...(opts.outline ? { outline: opts.outline } : {}),
            ...(opts.opacity !== undefined ? { opacity: opts.opacity } : {}),
        };
        this.push({ kind: 'text', points: box, text });
    };
    private text: RenderCtx['text'] = (
        content,
        x,
        y,
        size,
        {
            fill,
            opts,
        }: {
            fill: string;
            opts: TextOptions | undefined;
        },
    ) => {
        const unit = this.getCtx().scale * this.getCtx().localScale;
        const [cx, cy] = this.getCtx().screenPoint(x, y);
        const outline = opts?.outline && {
            width: opts.outline.width * unit,
            color: opts.outline.color,
        };
        this.pushText(content, cx, cy, size * unit, {
            rotation: this.getCtx().rotation,
            fill,
            opts: {
                ...opts,
                outline,
            },
        });
    };
    private screenText: RenderCtx['screenText'] = (
        content,
        x,
        y,
        size,
        {
            fill,
            opts,
        }: {
            fill: string;
            opts: TextOptions | undefined;
        },
    ) => {
        return this.pushText(content, x, y, size, {
            rotation: opts?.rotation ?? 0,
            fill,
            opts,
        });
    };
    private label: RenderCtx['label'] = (
        text,
        x,
        y,
        size = 12,
        {
            color = '#333d4b',
            font = LABEL_FONT,
        }: {
            color?: string | undefined;
            font?: FontName | undefined;
        } = {},
    ) => {
        this.getCtx().text(text, x, y - size * 0.35, size, {
            fill: color,
            opts: { font },
        });
    };
    constructor(getCtx: () => RenderCtx, retained: Map<string, DrawCommand[]>) {
        this.getCtx = getCtx;
        this.retained = retained;
        this.TAU = Math.PI * 2;
        this.layers = [];
    }
    api() {
        return {
            withTransform: this.withTransform,
            withLayer: this.withLayer,
            screenPoint: this.screenPoint,
            polygon: this.polygon,
            rgb: this.rgb,
            rgba: this.rgba,
            gradientFill: this.gradientFill,
            pathCommand: this.pathCommand,
            effectPath: this.effectPath,
            strokePath: this.strokePath,
            radialFill: this.radialFill,
            beginLayer: this.beginLayer,
            endLayer: this.endLayer,
            gradientPolygon: this.gradientPolygon,
            visible: this.visible,
            retainedGroup: this.retainedGroup,
            ripple: this.ripple,
            tint: this.tint,
            rect: this.rect,
            ellipse: this.ellipse,
            rod: this.rod,
            measureText: this.measureText,
            text: this.text,
            screenText: this.screenText,
            label: this.label,
        };
    }
}
