import type { Locale } from '../i18n';
import type { Canvas, ThorVGNamespace } from '@thorvg/webcanvas';
import { loadThorvg, thorvgRenderer } from './thorvg';
import { createGpuTimer, type GpuTimer } from './gpu-timer';
import type { GameState } from '../game/game';
import { ART } from './art';
import type { EffectsState } from './effects';
import { createRenderCtx } from './context';
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
import { resetRenderStats, type LayerOverrides, type RenderStats } from './perf';

/**
 * Logical game view. The scene keeps this aspect ratio and scales uniformly to fill the screen, so a
 * bigger window shows the same framing larger instead of revealing more of the level.
 */
export const VIEW_WIDTH = 1000;
export const VIEW_HEIGHT = 510;

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
    const ctx = createRenderCtx(bg);
    let lastTime = 0;
    let lastStage = 0;
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
        ctx.W = Math.max(1, base.clientWidth || VIEW_WIDTH);
        ctx.H = base.clientHeight || VIEW_HEIGHT;
        ctx.VW = VIEW_WIDTH;
        ctx.scale = ctx.W / ctx.VW;
        ctx.vertical = Math.max(0, ctx.H / ctx.scale - VIEW_HEIGHT) * .7;
        ctx.dpr = Math.min(devicePixelRatio || 1, 2);
        base.width = Math.round(ctx.W * ctx.dpr);
        base.height = Math.round(ctx.H * ctx.dpr);
        tvg?.resize(ctx.W, ctx.H);
    }
    const observer = new ResizeObserver(size);
    observer.observe(base);
    size();

    let lastWaterLife = 0;
    function draw(next: GameState, effects: EffectsState, camera?: number, opening?: OpeningFrame, talk?: SceneTalk) {
        ctx.locale = getLocale();
        ctx.state = next;
        ctx.LEN = next.level.length;
        ctx.GOAL = next.level.goal;
        ctx.p = next.player;
        ctx.mode = next.mode;
        ctx.cleaning = next.cleaning;
        ctx.people = next.people;
        ctx.solids = next.solids;
        ctx.papers = next.papers;
        ctx.inBin = next.inBin;
        ctx.soaked = next.soaked;
        // Count splashes from the 'water' focus notice: each new spill that hits the rider starts a fresh one.
        // The count clears once the rider is dry again (a retry), so it stays a render-only detail.
        const water = next.focusNotice?.kind === 'water' ? next.focusNotice.life : 0;
        if (!next.soaked) ctx.soaks = 0;
        else if (water > lastWaterLife) ctx.soaks++;
        lastWaterLife = water;
        ctx.dirty = next.dirty;
        ctx.t = next.time;
        ctx.monitors = next.monitors.map((monitor, index) => ({ ...monitor, ...ART.monitors[index] }));
        ctx.bin = { ...next.bin, bottom: ART.binBottom };
        ctx.copier = { ...next.copier, flash: effects.copierFlash };
        ctx.urgentCopier = next.urgentCopier;
        ctx.waterDrops = effects.waterDrops;
        ctx.waterRipples = effects.waterRipples;
        ctx.waterPour = effects.waterPour;
        ctx.waterPuddle = effects.waterPuddle;
        ctx.specks = effects.specks;
        ctx.paperFace = effects.paperFace;
        ctx.glare = effects.glare;
        ctx.practiceBurst = effects.practiceBurst;
        ctx.saveFlash = effects.saveFlash;
        ctx.keysTried = effects.keysTried;
        ctx.meetingVisit = effects.meetingVisit;
        ctx.personalBox = effects.personalBox;

        const baseWidth = VIEW_WIDTH;
        ctx.VW = next.stage === 4 ? baseWidth * 1.12 : baseWidth;
        ctx.scale = ctx.W / ctx.VW;
        const t = ctx.t;
        const dt = Math.max(0, t - lastTime);
        // Riding the sales graph and the climb that follows keep the chair centred, so the view moves right
        // with it and the rise into the sky stage reads as straight up.
        const centred = (next.stage === 3 && next.firstFlight.kind !== 'course') || (next.stage === 4 && next.sky.phase === 'arrival');
        const lead = centred ? .5 : .35;
        if (t < lastTime || next.stage !== lastStage) {
            ctx.cam = ctx.clamp(ctx.p.x - ctx.VW * lead, 0, Math.max(0, ctx.LEN - ctx.VW));
            ctx.wheel = 0;
        }
        if (camera !== undefined) {
            ctx.cam = ctx.clamp(camera, 0, Math.max(0, ctx.LEN - ctx.VW));
        } else if (ctx.mode === 'play' || (next.stage === 4 && ctx.mode === 'won')) {
            const focusX = ctx.p.x - ctx.VW * lead;
            const targetCamera = ctx.clamp(focusX, 0, Math.max(0, ctx.LEN - ctx.VW));
            ctx.cam += (targetCamera - ctx.cam) * Math.min(1, dt * 7);
            ctx.wheel += ctx.p.vx * dt / 8;
        }
        const baseVertical = Math.max(0, ctx.H / ctx.scale - VIEW_HEIGHT) * .7;
        // Nearing the sales-graph billboard the view tilts up to show the whole sign; riding it eases the
        // chair to the sky stage's framing, which the climb keeps.
        const flight = next.firstFlight;
        const signLook = next.stage === 3 ? 330 + 110 * ctx.clamp((ctx.p.x - 2050) / 300, 0, 1) : 330;
        const focusY = next.stage === 4 || flight.kind === 'flight' ? 265
            : flight.kind === 'ride' ? 440 - 175 * Math.min(1, flight.age / 1.2) : signLook;
        ctx.vertical = next.stage >= 3 ? baseVertical + Math.max(0, focusY - ctx.p.y) : baseVertical;
        if (opening) openingCamera(opening, baseWidth, baseVertical);
        lastStage = next.stage;
        lastTime = t;
        const buildStart = stats ? performance.now() : 0;
        if (opening) {
            drawOpening(ctx, opening);
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
        if (!opening) {
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
            TVG = await loadThorvg();
            if (!root.isConnected) return;
            tvg = new TVG.Canvas('#chair-office-one-tvg', { width: ctx.W, height: ctx.H });
            ctx.textWidth = thorvgTextWidth(TVG);
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
        ready,
        info: () => ({ renderer, renderError, commands: ctx.commands.length }),
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
            width: ctx.W,
            height: ctx.H,
            dpr: ctx.dpr,
            // The pixels actually rasterized. ThorVG scales its canvas by its own DPR (1 + (dpr - 1) × 0.75).
            raster: tvg ? { width: cn.width, height: cn.height, dpr: tvg.dpr } : { width: base.width, height: base.height, dpr: ctx.dpr },
        }),
        destroy() {
            observer.disconnect();
            gpuTimer?.dispose();
            gpuTimer = null;
            tvg?.destroy();
        },
    };
}
