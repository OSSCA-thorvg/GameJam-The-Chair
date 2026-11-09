import type { Locale } from '../i18n';
import { LEVEL } from '../game/level';
import type { GameState } from '../game/game';
import type { DeepReadonly } from '../game/types';
import type { Vector, Curve, Color, Gradient, DrawCommand } from './types';
import { ART } from './art';
import type { EffectsState } from './effects';

export type RenderCtx = {
    locale: Locale;
    bg: CanvasRenderingContext2D;
    lg: CanvasRenderingContext2D;

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

    commands: DrawCommand[];
    foregroundActors: DrawCommand[];

    state: GameState;
    p: GameState['player'];
    mode: string;
    monitors: (GameState['monitors'][number] & typeof ART.monitors[number])[];
    cleaning: GameState['cleaning'];
    bin: GameState['bin'] & { bottom: number };
    copier: GameState['copier'] & { flash: number };
    people: GameState['people'];
    solids: GameState['solids'];
    papers: GameState['papers'];
    inBin: boolean;
    soaked: boolean;
    dirty: boolean;
    t: number;
    LEN: number;
    GOAL: number;

    waterDrops: DeepReadonly<EffectsState['waterDrops']>;
    waterRipples: DeepReadonly<EffectsState['waterRipples']>;
    specks: DeepReadonly<EffectsState['specks']>;
    paperFace: number;
    glare: number;
    practiceBurst: number;
    saveFlash: number;

    screenPoint(x: number, y: number): Vector;
    polygon(points: Vector[], color: string | Gradient): void;
    rgba(hex: string, alpha?: number): Color;
    rgb(hex: string): [number, number, number];
    gradientFill(x1: number, y1: number, x2: number, y2: number, stops: [number, string][], alpha?: number): Gradient;
    effectPath(start: Vector, curves: Curve[], fill: Gradient): void;
    gradientPolygon(points: Vector[], fill: Gradient): void;
    ripple(x: number, y: number, rx: number, ry: number, width: number, color: string): void;
    tint(hex: string, alpha: number): string;
    rect(x: number, y: number, w: number, h: number, c: string): void;
    ellipse(x: number, y: number, rx: number, ry: number, c: string): void;
    rod(x: number, y: number, xx: number, yy: number, w: number, c: string): void;
    label(text: string, x: number, y: number, size?: number, color?: string, align?: CanvasTextAlign): void;
};

export function createRenderCtx(bg: CanvasRenderingContext2D, lg: CanvasRenderingContext2D): RenderCtx {
    const TAU = Math.PI * 2;
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const ctx = {
        locale: 'en' satisfies Locale,
        bg,
        lg,
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
        commands: [] as DrawCommand[],
        foregroundActors: [],
        state: null as unknown as GameState,
        p: null as unknown as GameState['player'],
        mode: '',
        monitors: [] as RenderCtx['monitors'],
        cleaning: null as unknown as GameState['cleaning'],
        bin: null as unknown as GameState['bin'] & { bottom: number },
        copier: null as unknown as GameState['copier'] & { flash: number },
        people: [] as unknown as GameState['people'],
        solids: [] as unknown as GameState['solids'],
        papers: [] as unknown as GameState['papers'],
        inBin: false,
        soaked: false,
        dirty: false,
        t: 0,
        LEN: LEVEL.length,
        GOAL: LEVEL.goal,
        waterDrops: [] as DeepReadonly<EffectsState['waterDrops']>,
        waterRipples: [] as DeepReadonly<EffectsState['waterRipples']>,
        specks: [] as DeepReadonly<EffectsState['specks']>,
        paperFace: 0,
        glare: 0,
        practiceBurst: 0,
        saveFlash: 0,
    } as RenderCtx;

    ctx.screenPoint = (x, y) => {
        const c = Math.cos(ctx.rotation);
        const s = Math.sin(ctx.rotation);
        x *= ctx.localScale;
        y *= ctx.localScale;
        return [(x * c - y * s + ctx.ox - ctx.cam) * ctx.scale, (x * s + y * c + ctx.oy + ctx.vertical) * ctx.scale];
    };
    ctx.polygon = (points, color) => {
        ctx.commands.push({ v: points.map(([x, y]) => ctx.screenPoint(x, y)), c: color });
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
    ctx.effectPath = (start, curves, fill) => {
        ctx.commands.push({
            v: [ctx.screenPoint(...start)],
            curves: curves.map(c => [...ctx.screenPoint(c[0], c[1]), ...ctx.screenPoint(c[2], c[3]), ...ctx.screenPoint(c[4], c[5])]),
            c: fill,
        });
    };
    ctx.gradientPolygon = (points, fill) => {
        ctx.commands.push({ v: points.map(v => ctx.screenPoint(...v)), c: fill });
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
    ctx.ellipse = (x, y, rx, ry, c) => {
        ctx.polygon(Array.from({ length: 16 }, (_, i) => [x + rx * Math.cos(i / 16 * TAU), y + ry * Math.sin(i / 16 * TAU)]), c);
    };
    ctx.rod = (x, y, xx, yy, w, c) => {
        const dx = xx - x;
        const dy = yy - y;
        const l = Math.hypot(dx, dy) || 1;
        const nx = -dy / l * w / 2;
        const ny = dx / l * w / 2;
        ctx.polygon([[x + nx, y + ny], [xx + nx, yy + ny], [xx - nx, yy - ny], [x - nx, y - ny]], c);
    };
    ctx.label = (text, x, y, size = 12, color = '#333d4b', align: CanvasTextAlign = 'center') => {
        ctx.lg.font = `${size * ctx.scale}px system-ui,sans-serif`;
        ctx.lg.fillStyle = color;
        ctx.lg.textAlign = align;
        ctx.lg.fillText(text, (x - ctx.cam) * ctx.scale, (y + ctx.vertical) * ctx.scale);
    };

    return ctx;
}
