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
import type { GpuTimer } from './gpu-timer';
import type { LayerOverrides, RenderStats } from './perf';
import type { OpeningFrame } from './scene/opening';
import type { SceneTalk } from './types';
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
    const resources = createRenderResources(bg);
    let lastFrame: RenderCtx | null = null;
    const viewport = {
        W: 800,
        H: 510,
        VW: VIEW_WIDTH,
        scale: 1,
        vertical: 0,
        dpr: 1,
    };
    let cameraState = { cam: 0, wheel: 0 };
    let soaks = 0;
    let lastTime = 0;
    let lastStage = 0;
    let closeUpFrom: { cam: number } | null = null;
    let closeUpAge = -1;
    const pool = createPaintPool();
    let TVG: ThorVGNamespace | null = null;
    let tvg: Canvas | null = null;
    let renderer = 'canvas2d';
    let renderError: string | null = null;
    let stats: RenderStats | null = null;
    let gpuTimer: GpuTimer | null = null;
    let gpuTimerTried = false;
    let overrides: LayerOverrides | null = null;

    function size() {
        viewport.W = Math.max(1, base.clientWidth || VIEW_WIDTH);
        viewport.H = base.clientHeight || VIEW_HEIGHT;
        viewport.VW = VIEW_WIDTH;
        viewport.scale = viewport.W / viewport.VW;
        viewport.vertical =
            Math.max(0, viewport.H / viewport.scale - VIEW_HEIGHT) * 0.7;
        viewport.dpr = Math.min(devicePixelRatio || 1, 2);
        base.width = Math.round(viewport.W * viewport.dpr);
        base.height = Math.round(viewport.H * viewport.dpr);
        tvg?.resize(viewport.W, viewport.H);
    }
    const observer = new ResizeObserver(size);
    observer.observe(base);
    size();

    let lastWaterLife = 0;
    function draw(
        next: GameSnapshot,
        effects: EffectsState,
        camera?: number,
        opening?: OpeningFrame,
        talk?: SceneTalk,
        titleTime?: number,
    ) {
        const ctx = createRenderCtx(resources, next, effects);
        lastFrame = ctx;
        Object.assign(ctx, viewport, cameraState);
        ctx.locale = getLocale();
        const water =
            next.focusNotice?.kind === 'water' ? next.focusNotice.life : 0;
        if (!next.soaked) {
            soaks = 0;
        } else if (water > lastWaterLife) {
            soaks++;
        }
        ctx.soaks = soaks;
        lastWaterLife = water;

        const t = ctx.t;
        const baseWidth = VIEW_WIDTH;
        const baseVertical = gameplayCamera(ctx, lastTime, lastStage, camera);
        if (opening) {
            openingCamera(ctx, opening, baseWidth, baseVertical);
        } else if (effects.deathShot) {
            deathCamera(ctx, effects.deathShot);
        } else {
            closeUpFrom = null;
        }
        cameraState = { cam: ctx.cam, wheel: ctx.wheel };
        lastStage = next.stage;
        lastTime = t;
        const buildStart = stats ? performance.now() : 0;
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
        if (!opening && !title) {
            const burst = effects.deathShot
                ? deathShotBurst(effects.deathShot)
                : null;
            if (burst !== null) {
                deathBurst(
                    ctx,
                    ctx.screenPoint(...riderPoint(ctx, HEAD)),
                    burst,
                );
            }
            focusVignette(ctx);
            if (talk) {
                drawTalk(ctx, talk);
            }
            drawStageTitle(ctx);
        }
        if (stats) {
            resetRenderStats(stats);
            stats.buildMs = performance.now() - buildStart;
        }
        const timing = stats ? gpuTiming() : null;
        const timed = timing?.begin() ?? false;
        try {
            paint(
                ctx,
                TVG,
                tvg,
                pool,
                stats ?? undefined,
                overrides ?? undefined,
            );
        } finally {
            if (timed) {
                timing!.end();
            }
        }
        if (stats && timing) {
            stats.gpuMs = timing.collect();
        }
        return {
            cam: ctx.cam,
            scale: ctx.scale,
            vertical: ctx.vertical,
            width: ctx.W,
        };
    }

    function openingCamera(
        ctx: RenderCtx,
        frame: OpeningFrame,
        baseWidth: number,
        baseVertical: number,
    ) {
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
    }

    function riderPoint(
        ctx: RenderCtx,
        [lx, ly]: [number, number],
    ): [number, number] {
        const c = Math.cos(ctx.player.a);
        const s = Math.sin(ctx.player.a);
        return [ctx.player.x + lx * c - ly * s, ctx.player.y + lx * s + ly * c];
    }

    function deathCamera(ctx: RenderCtx, shot: DeathShot) {
        if (!closeUpFrom || shot.age < closeUpAge) {
            closeUpFrom = { cam: ctx.cam };
        }
        closeUpAge = shot.age;
        const u = deathShotCloseness(shot);
        ctx.cam = closeUpFrom.cam;
        if (u <= 0) {
            return;
        }
        const width0 = ctx.VW;
        const scale0 = ctx.scale;
        const restX = closeUpFrom.cam + width0 / 2;
        const restY = ctx.H / (2 * scale0) - ctx.vertical;
        const [fx, fy] = riderPoint(ctx, shot.kind === 'focus' ? EYES : HEAD);
        const cx = restX + (fx - restX) * u;
        const cy = restY + (fy - restY) * u;
        ctx.VW = width0 / (1 + (DEATH_SHOT[shot.kind].zoom - 1) * u);
        ctx.scale = ctx.W / ctx.VW;
        ctx.cam = cx - ctx.VW / 2;
        ctx.vertical = ctx.H / (2 * ctx.scale) - cy;
    }

    function gpuTiming() {
        if (!gpuTimerTried && tvg && tvg.renderer === 'gl') {
            gpuTimerTried = true;
            gpuTimer = createGpuTimer(cn.getContext('webgl2'));
        }
        return gpuTimer;
    }

    async function initRenderer() {
        try {
            TVG = await loadThorvg().catch(() => loadThorvg());
            if (!root.isConnected) {
                return;
            }
            tvg = new TVG.Canvas(cn, { width: viewport.W, height: viewport.H });
            resources.textWidth = thorvgTextWidth(TVG);
            renderer = 'thorvg';
            cn.hidden = false;
        } catch (e) {
            renderError = String(e);
            renderer = 'canvas2d';
        }
    }
    const ready = initRenderer();

    return {
        draw,
        resetView() {
            lastTime = Infinity;
            lastStage = 0;
            soaks = 0;
            lastWaterLife = 0;
            closeUpFrom = null;
            closeUpAge = -1;
        },
        ready,
        info: () => ({
            renderer,
            renderError,
            commands: lastFrame?.commands.length ?? 0,
        }),
        profile(next: RenderStats | null) {
            stats = next;
            if (!next) {
                gpuTimer?.dispose();
                gpuTimer = null;
                gpuTimerTried = false;
            }
        },
        layerOverrides(next: LayerOverrides | null) {
            overrides = next;
        },
        surface: () => ({
            backend: tvg ? `thorvg-${tvg.renderer}` : renderer,
            requested: `thorvg-${thorvgRenderer()}`,
            gpuTimer:
                !tvg || tvg.renderer !== 'gl'
                    ? ('n/a' as const)
                    : gpuTimer
                      ? ('on' as const)
                      : gpuTimerTried
                        ? ('unsupported' as const)
                        : ('idle' as const),
            renderError,
            width: viewport.W,
            height: viewport.H,
            dpr: viewport.dpr,
            raster: tvg
                ? { width: cn.width, height: cn.height, dpr: tvg.dpr }
                : { width: base.width, height: base.height, dpr: viewport.dpr },
        }),
        destroy() {
            observer.disconnect();
            gpuTimer?.dispose();
            gpuTimer = null;
            tvg?.destroy();
        },
    };
}

export type Renderer = {
    draw: (
        next: GameSnapshot,
        effects: EffectsState,
        camera?: number,
        opening?: OpeningFrame,
        talk?: SceneTalk,
        titleTime?: number,
    ) => { cam: number; scale: number; vertical: number; width: number };
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
        raster: { width: number; height: number; dpr: number };
    };
    destroy(): void;
};
