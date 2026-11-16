import { gameplayCamera } from './camera';
import { createRenderCtx, createRenderResources } from './context';
import { deathShotBurst, deathShotCloseness, DEATH_SHOT } from './death-shot';
import { createGpuTimer } from './gpu-timer';
import { createPaintPool, paint, thorvgTextWidth } from './paint';
import { resetRenderStats } from './perf';
import { drawBuilding } from './scene/building';
import { STAGE_PRESENTATION } from '../presentation/stages';
import { deathBurst } from './scene/effects/death-burst';
import { focusVignette } from './scene/effects/focus-vignette';
import { drawWorld } from './scene/office/world';
import { drawOpening, openingFocusY } from './scene/opening';
import { drawOrbit } from './scene/orbit';
import { drawRooftop } from './scene/rooftop';
import { drawStageTitle, drawTalk } from './scene/shared/talk';
import { drawTitle } from './scene/shared/title';
import { drawCloudStart } from './scene/sky/clouds';
import { loadThorvg, thorvgRenderer } from './thorvg';

import type { RenderCtx } from './context';
import type { DeathShot } from './death-shot';
import type { EffectsState } from './effects';
import type { FontName } from './fonts';
import type { GpuTimer } from './gpu-timer';
import type { PaintPool } from './paint';
import type { LayerOverrides, RenderStats } from './perf';
import type { OpeningFrame } from './scene/opening';
import type { DrawCommand, SceneTalk } from './types';
import type { GameSnapshot } from '../game/game';
import type { Locale } from '../i18n';
import type { Canvas, ThorVGNamespace } from '@thorvg/webcanvas';
export const VIEW_WIDTH = 1000;
export const VIEW_HEIGHT = 510;
const HEAD: [number, number] = [4, -74];
const EYES: [number, number] = [9, -83];
export function createRenderer(
    root: HTMLElement,
    getLocale: () => Locale = () => 'en',
): Renderer {
    const base = root.querySelector<HTMLCanvasElement>('[data-base]');
    const cn = root.querySelector<HTMLCanvasElement>('[data-tvg]');
    const bg = base?.getContext('2d');
    if (!base || !cn || !bg) {
        throw new Error('Game canvases are unavailable.');
    }
    return setup(root, base, cn, bg, getLocale);
}
function setup(
    root: HTMLElement,
    base: HTMLCanvasElement,
    cn: HTMLCanvasElement,
    bg: CanvasRenderingContext2D,
    getLocale: () => Locale,
) {
    return new RendererRuntime(root, base, cn, bg, getLocale).api();
}
export type Renderer = {
    draw: (
        next: GameSnapshot,
        effects: EffectsState,
        camera?: number,
        opening?: OpeningFrame,
        options?: {
            talk?: SceneTalk;
            titleTime?: number;
        },
    ) => {
        cam: number;
        scale: number;
        vertical: number;
        width: number;
    };
    resetView(): void;
    ready: Promise<void>;
    info: () => {
        renderer: string;
        renderError: string | null;
        commands: number;
    };
    profile(next: RenderStats | null): void;
    layerOverrides(next: LayerOverrides | null): void;
    surface: () => {
        backend: string;
        requested: string;
        gpuTimer: 'idle' | 'n/a' | 'on' | 'unsupported';
        renderError: string | null;
        width: number;
        height: number;
        dpr: number;
        raster: {
            width: number;
            height: number;
            dpr: number;
        };
    };
    destroy(): void;
};
class RendererRuntime {
    private root!: HTMLElement;
    private base!: HTMLCanvasElement;
    private cn!: HTMLCanvasElement;
    private bg!: CanvasRenderingContext2D;
    private getLocale!: () => Locale;
    private resources!: {
        bg: CanvasRenderingContext2D;
        retained: Map<string, DrawCommand[]>;
        textWidth(content: string, font: FontName): number;
    };
    private lastFrame!: RenderCtx | null;
    private viewport!: {
        W: number;
        H: number;
        VW: number;
        scale: number;
        vertical: number;
        dpr: number;
    };
    private cameraState!: {
        cam: number;
        wheel: number;
    };
    private soaks!: number;
    private lastTime!: number;
    private lastStage!: number;
    private closeUpFrom!: {
        cam: number;
    } | null;
    private closeUpAge!: number;
    private pool!: PaintPool;
    private TVG!: ThorVGNamespace | null;
    private tvg!: Canvas | null;
    private renderer!: string;
    private renderError!: string | null;
    private stats!: RenderStats | null;
    private gpuTimer!: GpuTimer | null;
    private gpuTimerTried!: boolean;
    private overrides!: LayerOverrides | null;
    private observer!: ResizeObserver;
    private lastWaterLife!: number;
    private ready!: Promise<void>;
    constructor(
        root: HTMLElement,
        base: HTMLCanvasElement,
        cn: HTMLCanvasElement,
        bg: CanvasRenderingContext2D,
        getLocale: () => Locale,
    ) {
        this.root = root;
        this.base = base;
        this.cn = cn;
        this.bg = bg;
        this.getLocale = getLocale;
        this.resources = createRenderResources(this.bg);
        this.lastFrame = null;
        this.viewport = {
            W: 800,
            H: 510,
            VW: VIEW_WIDTH,
            scale: 1,
            vertical: 0,
            dpr: 1,
        };
        this.cameraState = { cam: 0, wheel: 0 };
        this.soaks = 0;
        this.lastTime = 0;
        this.lastStage = 0;
        this.closeUpFrom = null;
        this.closeUpAge = -1;
        this.pool = createPaintPool();
        this.TVG = null;
        this.tvg = null;
        this.renderer = 'canvas2d';
        this.renderError = null;
        this.stats = null;
        this.gpuTimer = null;
        this.gpuTimerTried = false;
        this.overrides = null;
        this.observer = new ResizeObserver(this.size);
        this.observer.observe(this.base);
        this.size();
        this.lastWaterLife = 0;
        this.ready = this.initRenderer();
    }
    private size = () => {
        this.viewport.W = Math.max(1, this.base.clientWidth || VIEW_WIDTH);
        this.viewport.H = this.base.clientHeight || VIEW_HEIGHT;
        this.viewport.VW = VIEW_WIDTH;
        this.viewport.scale = this.viewport.W / this.viewport.VW;
        this.viewport.vertical =
            Math.max(0, this.viewport.H / this.viewport.scale - VIEW_HEIGHT) *
            0.7;
        this.viewport.dpr = Math.min(devicePixelRatio || 1, 2);
        this.base.width = Math.round(this.viewport.W * this.viewport.dpr);
        this.base.height = Math.round(this.viewport.H * this.viewport.dpr);
        this.tvg?.resize(this.viewport.W, this.viewport.H);
    };
    private draw = (
        next: GameSnapshot,
        effects: EffectsState,
        camera?: number,
        opening?: OpeningFrame,
        {
            talk,
            titleTime,
        }: {
            talk?: SceneTalk;
            titleTime?: number;
        } = {},
    ) => {
        const ctx = createRenderCtx(this.resources, next, effects);
        this.lastFrame = ctx;
        Object.assign(ctx, this.viewport, this.cameraState);
        ctx.locale = this.getLocale();
        const water =
            next.focusNotice?.kind === 'water' ? next.focusNotice.life : 0;
        if (!next.soaked) {
            this.soaks = 0;
        } else if (water > this.lastWaterLife) {
            this.soaks++;
        }
        ctx.soaks = this.soaks;
        this.lastWaterLife = water;
        const t = ctx.t;
        const baseWidth = VIEW_WIDTH;
        const baseVertical = gameplayCamera(
            ctx,
            this.lastTime,
            this.lastStage,
            camera,
        );
        if (opening) {
            this.openingCamera(ctx, opening, baseWidth, baseVertical);
        } else if (effects.deathShot) {
            this.deathCamera(ctx, effects.deathShot);
        } else {
            this.closeUpFrom = null;
        }
        this.cameraState = { cam: ctx.cam, wheel: ctx.wheel };
        this.lastStage = next.stage;
        this.lastTime = t;
        const buildStart = this.stats ? performance.now() : 0;
        const title =
            !opening &&
            (titleTime !== undefined ||
                (next.mode === 'intro' && next.stage === 1));
        if (opening) {
            drawOpening(ctx, opening);
        } else if (title) {
            drawTitle(ctx, titleTime ?? performance.now() / 1000);
        } else {
            const scenes = {
                office: drawWorld,
                building: drawBuilding,
                rooftop: drawRooftop,
                sky: drawCloudStart,
                orbit: drawOrbit,
            };
            scenes[STAGE_PRESENTATION[next.stage].scene](ctx);
        }
        return this.drawFrameFeedback(opening, title, effects, ctx, {
            talk,
            buildStart,
        });
    };
    private openingCamera = (
        ctx: RenderCtx,
        frame: OpeningFrame,
        baseWidth: number,
        baseVertical: number,
    ) => {
        const width = baseWidth / frame.zoom;
        const scale = ctx.W / width;
        const cam = ctx.player.x - width / 2;
        const vertical =
            ctx.H / (2 * scale) - openingFocusY(frame, ctx.player.y);
        const playCam = ctx.clamp(
            ctx.player.x - baseWidth * 0.35,
            0,
            Math.max(0, ctx.LEN - baseWidth),
        );
        const u = frame.handoff;
        ctx.VW = width + (baseWidth - width) * u;
        ctx.scale = ctx.W / ctx.VW;
        ctx.cam = cam + (playCam - cam) * u + frame.shake[0] / ctx.scale;
        ctx.vertical =
            vertical +
            (baseVertical - vertical) * u +
            frame.shake[1] / ctx.scale;
        ctx.wheel = 0;
    };
    private riderPoint = (
        ctx: RenderCtx,
        [lx, ly]: [number, number],
    ): [number, number] => {
        const c = Math.cos(ctx.player.a);
        const s = Math.sin(ctx.player.a);
        return [ctx.player.x + lx * c - ly * s, ctx.player.y + lx * s + ly * c];
    };
    private deathCamera = (ctx: RenderCtx, shot: DeathShot) => {
        if (!this.closeUpFrom || shot.age < this.closeUpAge) {
            this.closeUpFrom = { cam: ctx.cam };
        }
        this.closeUpAge = shot.age;
        const u = deathShotCloseness(shot);
        ctx.cam = this.closeUpFrom.cam;
        if (u <= 0) {
            return;
        }
        const width0 = ctx.VW;
        const scale0 = ctx.scale;
        const restX = this.closeUpFrom.cam + width0 / 2;
        const restY = ctx.H / (2 * scale0) - ctx.vertical;
        const [fx, fy] = this.riderPoint(
            ctx,
            shot.kind === 'focus' ? EYES : HEAD,
        );
        const cx = restX + (fx - restX) * u;
        const cy = restY + (fy - restY) * u;
        ctx.VW = width0 / (1 + (DEATH_SHOT[shot.kind].zoom - 1) * u);
        ctx.scale = ctx.W / ctx.VW;
        ctx.cam = cx - ctx.VW / 2;
        ctx.vertical = ctx.H / (2 * ctx.scale) - cy;
    };
    private gpuTiming = () => {
        if (!this.gpuTimerTried && this.tvg && this.tvg.renderer === 'gl') {
            this.gpuTimerTried = true;
            this.gpuTimer = createGpuTimer(this.cn.getContext('webgl2'));
        }
        return this.gpuTimer;
    };
    private initRenderer = async () => {
        try {
            this.TVG = await loadThorvg().catch(() => loadThorvg());
            if (!this.root.isConnected) {
                return;
            }
            this.tvg = new this.TVG.Canvas(this.cn, {
                width: this.viewport.W,
                height: this.viewport.H,
            });
            this.resources.textWidth = thorvgTextWidth(this.TVG);
            this.renderer = 'thorvg';
            this.cn.hidden = false;
        } catch (e) {
            this.renderError = String(e);
            this.renderer = 'canvas2d';
        }
    };
    private drawFrameFeedback(
        opening: OpeningFrame | undefined,
        title: boolean,
        effects: EffectsState,
        ctx: RenderCtx,
        {
            talk,
            buildStart,
        }: {
            talk: SceneTalk | undefined;
            buildStart: number;
        },
    ) {
        if (!opening && !title) {
            const burst = effects.deathShot
                ? deathShotBurst(effects.deathShot)
                : null;
            if (burst !== null) {
                deathBurst(
                    ctx,
                    ctx.screenPoint(...this.riderPoint(ctx, HEAD)),
                    burst,
                );
            }
            focusVignette(ctx);
            if (talk) {
                drawTalk(ctx, talk);
            }
            drawStageTitle(ctx);
        }
        if (this.stats) {
            resetRenderStats(this.stats);
            this.stats.buildMs = performance.now() - buildStart;
        }
        const timing = this.stats ? this.gpuTiming() : null;
        const timed = timing?.begin() ?? false;
        try {
            paint(ctx, this.TVG, this.tvg, this.pool, {
                stats: this.stats ?? undefined,
                overrides: this.overrides ?? undefined,
            });
        } finally {
            if (timed) {
                timing!.end();
            }
        }
        if (this.stats && timing) {
            this.stats.gpuMs = timing.collect();
        }
        return {
            cam: ctx.cam,
            scale: ctx.scale,
            vertical: ctx.vertical,
            width: ctx.W,
        };
    }
    api() {
        return {
            draw: this.draw,
            resetView: this.apiResetView,
            ready: this.ready,
            info: this.apiInfo,
            profile: this.apiProfile,
            layerOverrides: this.apiLayerOverrides,
            surface: this.apiSurface,
            destroy: this.apiDestroy,
        };
    }
    private apiResetView = () => {
        this.lastTime = Infinity;
        this.lastStage = 0;
        this.soaks = 0;
        this.lastWaterLife = 0;
        this.closeUpFrom = null;
        this.closeUpAge = -1;
    };
    private apiInfo = () => {
        return {
            renderer: this.renderer,
            renderError: this.renderError,
            commands: this.lastFrame?.commands.length ?? 0,
        };
    };
    private apiProfile = (next: RenderStats | null) => {
        this.stats = next;
        if (!next) {
            this.gpuTimer?.dispose();
            this.gpuTimer = null;
            this.gpuTimerTried = false;
        }
    };
    private apiLayerOverrides = (next: LayerOverrides | null) => {
        this.overrides = next;
    };
    private apiSurface = () => {
        return {
            backend: this.tvg ? `thorvg-${this.tvg.renderer}` : this.renderer,
            requested: `thorvg-${thorvgRenderer()}`,
            gpuTimer:
                !this.tvg || this.tvg.renderer !== 'gl'
                    ? ('n/a' as const)
                    : this.gpuTimer
                      ? ('on' as const)
                      : this.gpuTimerTried
                        ? ('unsupported' as const)
                        : ('idle' as const),
            renderError: this.renderError,
            width: this.viewport.W,
            height: this.viewport.H,
            dpr: this.viewport.dpr,
            raster: this.tvg
                ? {
                      width: this.cn.width,
                      height: this.cn.height,
                      dpr: this.tvg.dpr,
                  }
                : {
                      width: this.base.width,
                      height: this.base.height,
                      dpr: this.viewport.dpr,
                  },
        };
    };
    private apiDestroy = () => {
        this.observer.disconnect();
        this.gpuTimer?.dispose();
        this.gpuTimer = null;
        this.tvg?.destroy();
    };
}
