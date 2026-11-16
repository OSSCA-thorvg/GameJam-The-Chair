import { gameplayCamera } from './camera';
import type { Locale } from '../i18n';
import type { Canvas, ThorVGNamespace } from '@thorvg/webcanvas';
import { loadThorvg, thorvgRenderer } from './thorvg';
import { createGpuTimer, type GpuTimer } from './gpu-timer';
import type { GameState } from '../game/game';
import type { EffectsState } from './effects';
import { createRenderCtx, createRenderResources, type RenderCtx } from './context';
import { drawOrbit } from './scene/orbit';
import { drawWorld } from './scene/world';
import { drawBuilding } from './scene/building';
import { drawRooftop } from './scene/rooftop';
import { drawCloudStart } from './scene/clouds';
import { focusVignette } from './scene/focus-vignette';
import { drawStageTitle, drawTalk } from './scene/talk';
import type { SceneTalk } from './types';
import { createPaintPool, paint, thorvgTextWidth } from './paint';
import { drawOpening, openingFocusY, type OpeningFrame } from './scene/opening';
import { drawTitle } from './scene/title';
import { deathShotBurst, deathShotCloseness, DEATH_SHOT, type DeathShot } from './death-shot';
import { deathBurst } from './scene/death-burst';
import { resetRenderStats, type LayerOverrides, type RenderStats } from './perf';

/**
 * Logical game view. The scene keeps this aspect ratio and scales uniformly to fill the screen, so a
 * bigger window shows the same framing larger instead of revealing more of the level.
 */
export const VIEW_WIDTH = 1000;
export const VIEW_HEIGHT = 510;

/** The worker's face and eyes, chair-local as the player is drawn. */
const HEAD: [number, number] = [4, -74];
const EYES: [number, number] = [9, -83];

export function createRenderer(root: HTMLElement, getLocale: () => Locale = () => 'en') {
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
    let ctx: RenderCtx;
    const viewport = { W: 800, H: 510, VW: VIEW_WIDTH, scale: 1, vertical: 0, dpr: 1 };
    let cameraState = { cam: 0, wheel: 0 };
    let soaks = 0;
    let lastTime = 0;
    let lastStage = 0;
    /** The view the end-of-run close-up started from, and how far into the shot the last frame was. */
    let closeUpFrom: { cam: number } | null = null;
    let closeUpAge = -1;
    const pool = createPaintPool();
    let TVG: ThorVGNamespace | null = null;
    let tvg: Canvas | null = null;
    let renderer = 'canvas2d';
    let renderError: string | null = null;
    // Set only while the developer performance overlay is open.
    let stats: RenderStats | null = null;
    // GPU timer queries on the WebGL2 canvas; only while profiling, and null when unsupported.
    let gpuTimer: GpuTimer | null = null;
    let gpuTimerTried = false;
    let overrides: LayerOverrides | null = null;

    function size() {
        viewport.W = Math.max(1, base.clientWidth || VIEW_WIDTH);
        viewport.H = base.clientHeight || VIEW_HEIGHT;
        viewport.VW = VIEW_WIDTH;
        viewport.scale = viewport.W / viewport.VW;
        viewport.vertical = Math.max(0, viewport.H / viewport.scale - VIEW_HEIGHT) * .7;
        viewport.dpr = Math.min(devicePixelRatio || 1, 2);
        base.width = Math.round(viewport.W * viewport.dpr);
        base.height = Math.round(viewport.H * viewport.dpr);
        tvg?.resize(viewport.W, viewport.H);
    }
    const observer = new ResizeObserver(size);
    observer.observe(base);
    size();

    let lastWaterLife = 0;
    function draw(next: GameState, effects: EffectsState, camera?: number, opening?: OpeningFrame, talk?: SceneTalk, titleTime?: number) {
        ctx = createRenderCtx(resources, next, effects);
        Object.assign(ctx, viewport, cameraState);
        ctx.locale = getLocale();
        const water = next.focusNotice?.kind === 'water' ? next.focusNotice.life : 0;
        if (!next.soaked) soaks = 0;
        else if (water > lastWaterLife) soaks++;
        ctx.soaks = soaks;
        lastWaterLife = water;

        const t = ctx.t;
        const baseWidth = VIEW_WIDTH;
        const baseVertical = gameplayCamera(ctx, lastTime, lastStage, camera);
        if (opening) openingCamera(opening, baseWidth, baseVertical);
        else if (effects.deathShot) deathCamera(effects.deathShot);
        else closeUpFrom = null;
        cameraState = { cam: ctx.cam, wheel: ctx.wheel };
        lastStage = next.stage;
        lastTime = t;
        const buildStart = stats ? performance.now() : 0;
        const title = !opening && (titleTime !== undefined || (next.mode === 'intro' && next.stage === 1));
        if (opening) {
            drawOpening(ctx, opening);
        } else if (title) {
            // The title loops on the page clock; the motion preview passes its own time.
            drawTitle(ctx, titleTime ?? performance.now() / 1000);
        } else if (next.stage === 5) {
            drawOrbit(ctx);
        } else if (next.stage === 4) {
            drawCloudStart(ctx);
        } else if (next.stage === 3) {
            drawRooftop(ctx);
        } else if (next.stage === 2) {
            drawBuilding(ctx);
        } else {
            drawWorld(ctx);
        }
        if (!opening && !title) {
            const burst = effects.deathShot ? deathShotBurst(effects.deathShot) : null;
            if (burst !== null) deathBurst(ctx, ctx.screenPoint(...riderPoint(HEAD)), burst);
            focusVignette(ctx);
            if (talk) drawTalk(ctx, talk);
            drawStageTitle(ctx);
        }
        if (stats) {
            resetRenderStats(stats);
            stats.buildMs = performance.now() - buildStart;
        }
        const timing = stats ? gpuTiming() : null;
        const timed = timing?.begin() ?? false;
        try {
            paint(ctx, TVG, tvg, pool, stats ?? undefined, overrides ?? undefined);
        } finally {
            if (timed) timing!.end();
        }
        if (stats && timing) stats.gpuMs = timing.collect();
        return { cam: ctx.cam, scale: ctx.scale, vertical: ctx.vertical, width: ctx.W };
    }

    /**
     * Cutscene camera: the chair stays at the centre while the view zooms (a narrower world width), then
     * blends back to the gameplay framing on handoff so the first playable frame matches.
     */
    function openingCamera(frame: OpeningFrame, baseWidth: number, baseVertical: number) {
        const width = baseWidth / frame.zoom;
        const scale = ctx.W / width;
        const cam = ctx.p.x - width / 2;
        const vertical = ctx.H / (2 * scale) - openingFocusY(frame, ctx.p.y);
        const playCam = ctx.clamp(ctx.p.x - baseWidth * .35, 0, Math.max(0, ctx.LEN - baseWidth));
        const u = frame.handoff;
        ctx.VW = width + (baseWidth - width) * u;
        ctx.scale = ctx.W / ctx.VW;
        ctx.cam = cam + (playCam - cam) * u + frame.shake[0] / ctx.scale;
        ctx.vertical = vertical + (baseVertical - vertical) * u + frame.shake[1] / ctx.scale;
        ctx.wheel = 0;
    }

    /** A point on the worker (chair-local, as the player is drawn) in world space, turning with the chair. */
    function riderPoint([lx, ly]: [number, number]): [number, number] {
        const c = Math.cos(ctx.p.a), s = Math.sin(ctx.p.a);
        return [ctx.p.x + lx * c - ly * s, ctx.p.y + lx * s + ly * c];
    }

    /**
     * End-of-run close-up: from the usual framing the view narrows onto the worker's face (his eyes for a focus
     * loss), then eases back. The screen centre and the visible width blend between the two framings.
     */
    function deathCamera(shot: DeathShot) {
        // Outside play the camera is not recomputed each frame, so the shot works from where it found the view.
        if (!closeUpFrom || shot.age < closeUpAge) closeUpFrom = { cam: ctx.cam };
        closeUpAge = shot.age;
        const u = deathShotCloseness(shot);
        // It pushes in from the play framing the run ended in and eases back to exactly that framing.
        ctx.cam = closeUpFrom.cam;
        if (u <= 0) return;
        const width0 = ctx.VW, scale0 = ctx.scale;
        const restX = closeUpFrom.cam + width0 / 2;
        const restY = ctx.H / (2 * scale0) - ctx.vertical;
        const [fx, fy] = riderPoint(shot.kind === 'focus' ? EYES : HEAD);
        const cx = restX + (fx - restX) * u;
        const cy = restY + (fy - restY) * u;
        ctx.VW = width0 / (1 + (DEATH_SHOT[shot.kind].zoom - 1) * u);
        ctx.scale = ctx.W / ctx.VW;
        ctx.cam = cx - ctx.VW / 2;
        ctx.vertical = ctx.H / (2 * ctx.scale) - cy;
    }

    /** The GPU timer, created on first use once the WebGL2 canvas exists. */
    function gpuTiming() {
        if (!gpuTimerTried && tvg && tvg.renderer === 'gl') {
            gpuTimerTried = true;
            // ThorVG already owns a WebGL2 context on this canvas; asking again returns that same context.
            gpuTimer = createGpuTimer(cn.getContext('webgl2'));
        }
        return gpuTimer;
    }

    async function initRenderer() {
        try {
            TVG = await loadThorvg().catch(() => loadThorvg());
            if (!root.isConnected) return;
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
        info: () => ({ renderer, renderError, commands: ctx?.commands.length ?? 0 }),
        /** Start (or with null, stop) filling render counters each frame. */
        profile(next: RenderStats | null) {
            stats = next;
            if (!next) {
                gpuTimer?.dispose();
                gpuTimer = null;
                gpuTimerTried = false;
            }
        },
        /** Debug-only layer hiding and flattening; null draws every layer normally. */
        layerOverrides(next: LayerOverrides | null) {
            overrides = next;
        },
        /** Backend and canvas size for the performance overlay. */
        surface: () => ({
            backend: tvg ? `thorvg-${tvg.renderer}` : renderer,
            /** The backend that was requested; differs from `backend` when ThorVG failed to start. */
            requested: `thorvg-${thorvgRenderer()}`,
            gpuTimer: !tvg || tvg.renderer !== 'gl' ? 'n/a' as const : gpuTimer ? 'on' as const : gpuTimerTried ? 'unsupported' as const : 'idle' as const,
            renderError,
            width: viewport.W,
            height: viewport.H,
            dpr: viewport.dpr,
            // The pixels actually rasterized. ThorVG scales its canvas by its own DPR (1 + (dpr - 1) × 0.75).
            raster: tvg ? { width: cn.width, height: cn.height, dpr: tvg.dpr } : { width: base.width, height: base.height, dpr: viewport.dpr },
        }),
        destroy() {
            observer.disconnect();
            gpuTimer?.dispose();
            gpuTimer = null;
            tvg?.destroy();
        },
    };
}
