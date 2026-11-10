import type { Locale } from '../i18n';
import type { Canvas, ThorVGNamespace } from '@thorvg/webcanvas';
import { loadThorvg } from './thorvg';
import type { GameState } from '../game/game';
import { ART } from './art';
import type { EffectsState } from './effects';
import { createRenderCtx } from './context';
import { drawWorld } from './scene/world';
import { drawBuilding } from './scene/building';
import { drawRooftop } from './scene/rooftop';
import { drawCloudStart } from './scene/clouds';
import { createPaintPool, paint } from './paint';

export function createRenderer(root: HTMLElement, getLocale: () => Locale = () => 'en') {
    const base = root.querySelector<HTMLCanvasElement>('[data-base]');
    const cn = root.querySelector<HTMLCanvasElement>('[data-tvg]');
    const labels = root.querySelector<HTMLCanvasElement>('[data-labels]');
    const bg = base?.getContext('2d');
    const lg = labels?.getContext('2d');
    if (!base || !cn || !labels || !bg || !lg) {
        throw new Error('Game canvases are unavailable.');
    }
    return setup(root, base, cn, labels, bg, lg, getLocale);
}

function setup(
    root: HTMLElement,
    base: HTMLCanvasElement,
    cn: HTMLCanvasElement,
    labels: HTMLCanvasElement,
    bg: CanvasRenderingContext2D,
    lg: CanvasRenderingContext2D,
    getLocale: () => Locale,
) {
    const ctx = createRenderCtx(bg, lg);
    let lastTime = 0;
    let lastStage = 0;
    const pool = createPaintPool();
    let TVG: ThorVGNamespace | null = null;
    let tvg: Canvas | null = null;
    let renderer = 'canvas2d';
    let renderError: string | null = null;

    function size() {
        ctx.W = Math.max(300, base.clientWidth || 800);
        ctx.H = base.clientHeight || 510;
        ctx.VW = ctx.W < 520 ? 540 : Math.max(760, ctx.W);
        ctx.scale = ctx.W / ctx.VW;
        ctx.vertical = Math.max(0, ctx.H / ctx.scale - 510) * .7;
        ctx.dpr = Math.min(devicePixelRatio || 1, 2);
        for (const c of [base, labels]) {
            c.width = Math.round(ctx.W * ctx.dpr);
            c.height = Math.round(ctx.H * ctx.dpr);
        }
        tvg?.resize(ctx.W, ctx.H);
    }
    const observer = new ResizeObserver(size);
    observer.observe(base);
    size();

    function draw(next: GameState, effects: EffectsState, camera?: number) {
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
        ctx.dirty = next.dirty;
        ctx.t = next.time;
        ctx.monitors = next.monitors.map((monitor, index) => ({ ...monitor, ...ART.monitors[index] }));
        ctx.bin = { ...next.bin, bottom: ART.binBottom };
        ctx.copier = { ...next.copier, flash: effects.copierFlash };
        ctx.waterDrops = effects.waterDrops;
        ctx.waterRipples = effects.waterRipples;
        ctx.waterPour = effects.waterPour;
        ctx.waterPuddle = effects.waterPuddle;
        ctx.specks = effects.specks;
        ctx.paperFace = effects.paperFace;
        ctx.glare = effects.glare;
        ctx.practiceBurst = effects.practiceBurst;
        ctx.saveFlash = effects.saveFlash;

        const ending = next.stage === 4 && (next.sky.phase === 'reveal' || next.sky.phase === 'depth');
        const pullback = ending ? (next.sky.phase === 'depth' ? 1 : Math.min(1, next.sky.age / 5)) : 0;
        const baseWidth = ctx.W < 520 ? 540 : Math.max(760, ctx.W);
        ctx.VW = next.stage === 4 ? baseWidth * (1.12 + pullback * .65) : baseWidth;
        ctx.scale = ctx.W / ctx.VW;
        const t = ctx.t;
        const dt = Math.max(0, t - lastTime);
        if (t < lastTime || next.stage !== lastStage) {
            ctx.cam = ctx.clamp(ctx.p.x - ctx.VW * .35, 0, Math.max(0, ctx.LEN - ctx.VW));
            ctx.wheel = 0;
        }
        if (camera !== undefined) {
            ctx.cam = ctx.clamp(camera, 0, Math.max(0, ctx.LEN - ctx.VW));
        } else if (ctx.mode === 'play' || (next.stage === 4 && ctx.mode === 'won')) {
            const focusX = ctx.p.x - ctx.VW * .35;
            ctx.cam += (ctx.clamp(focusX, 0, Math.max(0, ctx.LEN - ctx.VW)) - ctx.cam) * Math.min(1, dt * 7);
            ctx.wheel += ctx.p.vx * dt / 8;
        }
        const baseVertical = Math.max(0, ctx.H / ctx.scale - 510) * .7;
        const focusY = next.stage === 4 ? 265 : next.firstFlight.kind === 'flight' ? 330 - Math.min(1, next.firstFlight.age) * 65 : 330;
        ctx.vertical = next.stage >= 3 ? baseVertical + Math.max(0, focusY - ctx.p.y) : baseVertical;
        lastStage = next.stage;
        lastTime = t;
        lg.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0);
        lg.clearRect(0, 0, ctx.W, ctx.H);
        ctx.foregroundActors = [];
        if (next.stage === 4) {
            drawCloudStart(ctx);
        } else if (next.stage === 3) {
            drawRooftop(ctx);
        } else if (next.stage === 2) {
            drawBuilding(ctx);
        } else {
            drawWorld(ctx);
        }
        paint(ctx, TVG, tvg, pool);
        return { cam: ctx.cam, scale: ctx.scale, vertical: ctx.vertical, width: ctx.W };
    }

    async function initRenderer() {
        try {
            TVG = await loadThorvg();
            if (!root.isConnected) return;
            tvg = new TVG.Canvas('#chair-office-one-tvg', { width: ctx.W, height: ctx.H });
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
        destroy() {
            observer.disconnect();
            tvg?.destroy();
        },
    };
}

export type Viewport = {
    cam: number;
    scale: number;
    vertical: number;
    width: number;
};
