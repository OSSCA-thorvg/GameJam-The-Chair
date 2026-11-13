import { translate, type Locale } from '../i18n';
import { createLayerOverrides, createRenderStats, type LayerOverrides, type RenderStats } from '../render/perf';
import { createLayerPanel } from './perf-layers';

/**
 * Developer performance overlay (toggle with F3 or `, or open with `?debug=1`).
 *
 * It lives outside the deterministic core: everything here is presentation-side timing. While closed it
 * measures nothing, and while open it keeps its own cost low — text refreshes a few times a second and the
 * graph is a separate Canvas2D element, so the ThorVG canvas being measured never draws overlay pixels.
 *
 * 개발자 성능 오버레이(F3 또는 ` 키, `?debug=1`). 결정적 코어 밖에서만 측정하며, 닫혀 있으면 아무것도 재지 않는다.
 */

/** Main-loop timings for one browser frame (ms). */
export type FrameSample = {
    /** Time since the previous browser frame. */
    frameMs: number;
    /** `game.advance()` (or replay/opening advance). */
    simMs: number;
    /** Fixed 120 Hz ticks run this frame. */
    ticks: number;
    /** Accumulated simulation time discarded on a mode change. */
    droppedMs: number;
    /** DOM HUD update. */
    hudMs: number;
};

export type PerfSurface = {
    backend: string;
    renderError: string | null;
    /** Canvas size in CSS px and the game's own DPR (used by the Canvas2D layers). */
    width: number;
    height: number;
    dpr: number;
    /** Pixels the vector renderer actually rasterizes, and the DPR it applied. */
    raster: { width: number; height: number; dpr: number };
    /** Backend that was asked for; a different `backend` means ThorVG failed to start with it. */
    requested: string;
    /** GPU timer state: on, unsupported by this browser, idle (not created yet) or n/a (not WebGL). */
    gpuTimer: 'on' | 'unsupported' | 'idle' | 'n/a';
};

type PerfDeps = {
    /** Starts (stats) or stops (null) the renderer's per-frame counters. */
    profile(stats: RenderStats | null): void;
    /** Applies (or with null, removes) debug layer hiding and flattening. */
    layerOverrides(overrides: LayerOverrides | null): void;
    surface(): PerfSurface | null;
};

const HISTORY = 240;
const TEXT_INTERVAL = 200;
/** Graph range: at least 50 ms, growing in 50 ms steps up to 250 ms so slow devices stay readable. */
const GRAPH_MIN_MS = 50;
const GRAPH_MAX_MS = 250;
const SERIES = ['sim', 'build', 'sync', 'render', 'labels', 'hud'] as const;
type Series = typeof SERIES[number];
const COLORS: Record<Series | 'other' | 'gpu', string> = {
    sim: '#6aa9ff', build: '#f2d16b', sync: '#f29a4a', render: '#ef5f5f', labels: '#c58cf2', hud: '#6fd49a', other: '#5c6573',
    gpu: '#ffffff',
};

function ring() {
    return new Float64Array(HISTORY);
}

const mb = (bytes: number | null) => bytes === null ? 'n/a' : `${(bytes / 1048576).toFixed(1)} MB`;
const ms = (value: number) => `${value.toFixed(2)}`;

/** Bytes of the ThorVG WebAssembly heap. It only grows, so its size tracks the module's peak use. */
function wasmMemory(): number | null {
    const module = (globalThis as { __ThorVGModule?: { HEAPU8?: Uint8Array } }).__ThorVGModule;
    return module?.HEAPU8?.buffer.byteLength ?? null;
}

/** Chrome-only JS heap figures. */
function jsHeap(): { used: number; total: number; limit: number } | null {
    const memory = (performance as Performance & {
        memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
    }).memory;
    return memory ? { used: memory.usedJSHeapSize, total: memory.totalJSHeapSize, limit: memory.jsHeapSizeLimit } : null;
}

export function createPerfOverlay(root: HTMLElement, getLocale: () => Locale, deps: PerfDeps) {
    const stats = createRenderStats();
    const frames = ring();
    const ticks = ring();
    const dropped = ring();
    const series: Record<Series, Float64Array> = { sim: ring(), build: ring(), sync: ring(), render: ring(), labels: ring(), hud: ring() };
    const overlayCost = ring();
    // GPU ms whose timer results arrived in each frame (NaN when none did). They describe earlier frames.
    const gpu = ring().fill(NaN);
    const reordered = new Uint8Array(HISTORY);
    let head = 0;
    let count = 0;
    let reorders = 0;
    let lastText = 0;
    let heapPeak = 0;
    let wasmStart: number | null = null;
    let open = false;

    const panel = document.createElement('div');
    panel.className = 'perf-overlay';
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
    const header = document.createElement('div');
    header.className = 'perf-header';
    const title = document.createElement('b');
    const copy = document.createElement('button');
    copy.type = 'button';
    const note = document.createElement('small');
    header.append(title, copy, note);
    const graph = document.createElement('canvas');
    graph.className = 'perf-graph';
    const legend = document.createElement('div');
    legend.className = 'perf-legend';
    for (const name of [...SERIES, 'other', 'gpu'] as const) {
        const item = document.createElement('span');
        const chip = document.createElement('i');
        chip.style.background = COLORS[name];
        item.append(chip, name);
        legend.append(item);
    }
    const text = document.createElement('pre');
    const overrides = createLayerOverrides();
    const layers = createLayerPanel(getLocale, overrides);
    panel.append(header, graph, legend, text, layers.element);
    (root.querySelector('[data-scene]') ?? root).append(panel);
    const g = graph.getContext('2d');

    function applyLocale() {
        const locale = getLocale();
        title.textContent = translate('perf.title', locale);
        copy.textContent = translate('perf.copy', locale);
        layers.applyLocale();
    }

    function setOpen(next: boolean) {
        if (next === open) return;
        open = next;
        panel.hidden = !open;
        deps.profile(open ? stats : null);
        // Layer switches only live while the overlay is open, so a closed overlay never hides scenery.
        layers.clear();
        deps.layerOverrides(open ? overrides : null);
        count = 0;
        head = 0;
        reorders = 0;
        reordered.fill(0);
        gpu.fill(NaN);
        lastText = 0;
        heapPeak = 0;
        wasmStart = null;
        note.textContent = '';
        if (open) applyLocale();
    }

    /** Average, p95 and max of the newest samples covering about one second of frames. */
    function window1s() {
        const picked: number[] = [];
        const sums: Record<Series, number> = { sim: 0, build: 0, sync: 0, render: 0, labels: 0, hud: 0 };
        const gpuPicked: number[] = [];
        let elapsed = 0, tickSum = 0, tickMax = 0, droppedSum = 0, cost = 0;
        for (let k = 0; k < count && elapsed < 1000; k++) {
            const i = (head - 1 - k + HISTORY) % HISTORY;
            picked.push(frames[i]);
            elapsed += frames[i];
            for (const name of SERIES) sums[name] += series[name][i];
            tickSum += ticks[i];
            tickMax = Math.max(tickMax, ticks[i]);
            droppedSum += dropped[i];
            cost += overlayCost[i];
            if (!Number.isNaN(gpu[i])) gpuPicked.push(gpu[i]);
        }
        const gpuSorted = gpuPicked.sort((a, b) => a - b);
        const n = Math.max(1, picked.length);
        const sorted = [...picked].sort((a, b) => a - b);
        const avg = elapsed / n;
        const avgs = {} as Record<Series, number>;
        for (const name of SERIES) avgs[name] = sums[name] / n;
        return {
            samples: picked.length,
            fps: elapsed > 0 ? picked.length * 1000 / elapsed : 0,
            frame: { avg, p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] ?? 0, max: sorted[sorted.length - 1] ?? 0 },
            segments: avgs,
            ticks: { avg: tickSum / n, max: tickMax },
            droppedMs: droppedSum,
            overlayMs: cost / n,
            gpu: gpuSorted.length ? {
                avg: gpuSorted.reduce((a, b) => a + b, 0) / gpuSorted.length,
                p95: gpuSorted[Math.min(gpuSorted.length - 1, Math.floor(gpuSorted.length * .95))],
                max: gpuSorted[gpuSorted.length - 1],
                samples: gpuSorted.length,
            } : null,
        };
    }

    function snapshot() {
        const heap = jsHeap();
        const wasm = wasmMemory();
        return {
            at: new Date().toISOString(),
            userAgent: navigator.userAgent,
            surface: deps.surface(),
            window: window1s(),
            render: { ...stats, reordersInHistory: reorders },
            layerOverrides: { hidden: [...overrides.hidden], flat: [...overrides.flat] },
            memory: {
                jsHeap: heap,
                jsHeapPeak: heapPeak || null,
                wasm,
                wasmGrowth: wasm !== null && wasmStart !== null ? wasm - wasmStart : null,
            },
        };
    }

    function drawGraph() {
        if (!g) return;
        const dpr = Math.min(devicePixelRatio || 1, 2);
        const width = graph.clientWidth || 280;
        const height = graph.clientHeight || 64;
        if (graph.width !== Math.round(width * dpr) || graph.height !== Math.round(height * dpr)) {
            graph.width = Math.round(width * dpr);
            graph.height = Math.round(height * dpr);
        }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, width, height);
        const bar = width / HISTORY;
        let peak = 0;
        for (let k = 0; k < count; k++) peak = Math.max(peak, frames[(head - 1 - k + HISTORY) % HISTORY]);
        const range = Math.min(GRAPH_MAX_MS, Math.max(GRAPH_MIN_MS, Math.ceil(peak / 50) * 50));
        const y = (value: number) => height - Math.min(range, value) / range * height;
        for (let k = 0; k < count; k++) {
            const i = (head - count + k + HISTORY) % HISTORY;
            const x = (HISTORY - count + k) * bar;
            let base = 0;
            for (const name of SERIES) {
                const value = series[name][i];
                if (value <= 0) continue;
                g.fillStyle = COLORS[name];
                g.fillRect(x, y(base + value), Math.max(1, bar), y(base) - y(base + value));
                base += value;
            }
            if (frames[i] > base) {
                g.fillStyle = COLORS.other;
                g.fillRect(x, y(frames[i]), Math.max(1, bar), y(base) - y(frames[i]));
            }
        }
        // GPU time runs alongside the CPU work, so it is a line over the bars, not another bar segment.
        g.strokeStyle = COLORS.gpu;
        g.lineWidth = 1.5;
        g.beginPath();
        let drawing = false;
        for (let k = 0; k < count; k++) {
            const i = (head - count + k + HISTORY) % HISTORY;
            if (Number.isNaN(gpu[i])) continue;
            const x = (HISTORY - count + k + .5) * bar;
            if (drawing) g.lineTo(x, y(gpu[i]));
            else g.moveTo(x, y(gpu[i]));
            drawing = true;
        }
        g.stroke();
        g.lineWidth = 1;
        g.font = '9px ui-monospace, monospace';
        g.fillStyle = '#ffffff99';
        g.fillText(`${range} ms`, width - 38, 9);
        for (const [limit, label] of [[1000 / 120, '120'], [1000 / 60, '60'], [1000 / 30, '30']] as const) {
            g.strokeStyle = limit === 1000 / 60 ? '#e8bc7c' : '#ffffff40';
            g.beginPath();
            g.moveTo(0, Math.round(y(limit)) + .5);
            g.lineTo(width, Math.round(y(limit)) + .5);
            g.stroke();
            g.fillStyle = '#ffffff99';
            g.fillText(label, 2, y(limit) - 2);
        }
    }

    function drawText() {
        const w = window1s();
        const s = deps.surface();
        const heap = jsHeap();
        const wasm = wasmMemory();
        if (heap) heapPeak = Math.max(heapPeak, heap.used);
        if (wasm !== null) wasmStart ??= wasm;
        const seg = w.segments;
        const lines = [
            `FPS ${w.fps.toFixed(1)}   frame ${ms(w.frame.avg)} / p95 ${ms(w.frame.p95)} / max ${ms(w.frame.max)} ms`,
            `sim ${ms(seg.sim)}  build ${ms(seg.build)}  sync ${ms(seg.sync)}`,
            `render ${ms(seg.render)}  labels ${ms(seg.labels)}  hud ${ms(seg.hud)}`,
            `ticks/frame ${w.ticks.avg.toFixed(2)} (max ${w.ticks.max})  dropped ${ms(w.droppedMs)} ms/s`,
            `backend ${s?.backend ?? 'none'}${s && s.backend !== s.requested ? ` (FALLBACK, wanted ${s.requested})` : ''}`,
            `gpu ${w.gpu ? `${ms(w.gpu.avg)} / p95 ${ms(w.gpu.p95)} / max ${ms(w.gpu.max)} ms` : 'n/a'}  (timer ${s?.gpuTimer ?? 'n/a'})`,
            s ? `canvas ${s.width}×${s.height} css · page dpr ${devicePixelRatio}` : 'canvas n/a',
            s ? `raster ${s.raster.width}×${s.raster.height} · ${(s.raster.width * s.raster.height / 1e6).toFixed(2)} Mpx · dpr ${+s.raster.dpr.toFixed(3)}` : 'raster n/a',
            `cmds ${stats.commands}  shapes ${stats.topShapes}/${stats.poolTop}  text ${stats.texts}`,
            `layers ${stats.layers}/${stats.layerSlots}  layer shapes ${stats.layerShapes} (parked ${stats.parkedShapes})`,
            `reorder ${stats.reorder ? 'YES' : 'no'}  (${reorders}/${count} frames)`,
            `blur g${stats.gaussianBlurs} m${stats.motionBlurs}  Σ${stats.blurAmount.toFixed(1)}  area ${(stats.blurArea / 1e3).toFixed(0)}k px²` +
                (s ? ` (${(stats.blurArea / Math.max(1, s.width * s.height) * 100).toFixed(0)}%)` : ''),
            `mask ${stats.masks}  clip ${stats.clips}`,
            `JS heap ${heap ? `${mb(heap.used)} / ${mb(heap.total)} (peak ${mb(heapPeak)})` : 'n/a'}`,
            `WASM ${mb(wasm)}${wasm !== null && wasmStart !== null && wasm > wasmStart ? ` (+${mb(wasm - wasmStart)})` : ''}`,
            `overlay ${ms(w.overlayMs)} ms`,
        ];
        text.textContent = lines.join('\n');
        layers.update(stats.layerList, s ? s.width * s.height : 0, seg.render, performance.now());
    }

    function record(sample: FrameSample) {
        if (!open) return;
        const start = performance.now();
        const i = head;
        frames[i] = sample.frameMs;
        ticks[i] = sample.ticks;
        dropped[i] = sample.droppedMs;
        series.sim[i] = sample.simMs;
        series.hud[i] = sample.hudMs;
        series.build[i] = stats.buildMs;
        series.sync[i] = stats.syncMs;
        series.render[i] = stats.renderMs;
        series.labels[i] = stats.labelsMs;
        gpu[i] = stats.gpuMs.length ? stats.gpuMs.reduce((a, b) => a + b, 0) / stats.gpuMs.length : NaN;
        // `reorders` counts paint-order rebuilds inside the history window.
        if (count === HISTORY && reordered[i]) reorders--;
        reordered[i] = stats.reorder ? 1 : 0;
        if (stats.reorder) reorders++;
        head = (head + 1) % HISTORY;
        count = Math.min(HISTORY, count + 1);
        drawGraph();
        if (start - lastText >= TEXT_INTERVAL) {
            lastText = start;
            drawText();
        }
        overlayCost[i] = performance.now() - start;
    }

    const onKey = (event: KeyboardEvent) => {
        if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.key !== 'F3' && event.code !== 'Backquote') return;
        if (event.target instanceof Element && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
        event.preventDefault();
        setOpen(!open);
    };
    window.addEventListener('keydown', onKey);

    copy.addEventListener('click', async () => {
        const locale = getLocale();
        try {
            await navigator.clipboard.writeText(JSON.stringify(snapshot(), null, 2));
            note.textContent = translate('replay.copied', locale);
        } catch {
            note.textContent = translate('replay.copyFailed', locale);
        }
    });

    let initial = false;
    try {
        initial = new URLSearchParams(location.search).get('debug') === '1';
    } catch {}
    if (initial) setOpen(true);

    return {
        get enabled() {
            return open;
        },
        toggle: (next = !open) => setOpen(next),
        /** Console access to the layer switches (the overlay must be open). */
        layers: {
            hide: (key: string, on = true) => layers.set(key, 'hide', on),
            flatten: (key: string, on = true) => layers.set(key, 'flat', on),
            reset: () => layers.clear(),
            list: () => layers.keys(),
        },
        record,
        snapshot,
        destroy() {
            window.removeEventListener('keydown', onKey);
            deps.profile(null);
            deps.layerOverrides(null);
            layers.destroy();
            panel.remove();
        },
    };
}
