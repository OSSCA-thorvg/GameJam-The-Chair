import { translate } from '../i18n';
import { createLayerPanel } from './perf-layers';
import { createLayerOverrides, createRenderStats } from '../render/perf';

import type { Locale } from '../i18n';
import type { LayerOverrides, RenderStats } from '../render/perf';

export type FrameSample = {
    frameMs: number;
    simMs: number;
    ticks: number;
    droppedMs: number;
    hudMs: number;
};

export type PerfSurface = {
    backend: string;
    renderError: string | null;
    width: number;
    height: number;
    dpr: number;
    raster: { width: number; height: number; dpr: number };
    requested: string;
    gpuTimer: 'on' | 'unsupported' | 'idle' | 'n/a';
};

type PerfDeps = {
    profile(stats: RenderStats | null): void;
    layerOverrides(overrides: LayerOverrides | null): void;
    surface(): PerfSurface | null;
};

const HISTORY = 240;
const TEXT_INTERVAL = 200;
const GRAPH_MIN_MS = 50;
const GRAPH_MAX_MS = 250;
const SERIES = ['sim', 'build', 'sync', 'render', 'hud'] as const;
type Series = (typeof SERIES)[number];
const COLORS: Record<Series | 'other' | 'gpu', string> = {
    sim: '#6aa9ff',
    build: '#f2d16b',
    sync: '#f29a4a',
    render: '#ef5f5f',
    hud: '#6fd49a',
    other: '#5c6573',
    gpu: '#ffffff',
};

function createFrameSample() {
    return {
        frameMs: 0,
        ticks: 0,
        droppedMs: 0,
        overlayMs: 0,
        gpuMs: NaN,
        reordered: false,
        segments: { sim: 0, build: 0, sync: 0, render: 0, hud: 0 },
    };
}

const mb = (bytes: number | null) =>
    bytes === null ? 'n/a' : `${(bytes / 1048576).toFixed(1)} MB`;
const ms = (value: number) => `${value.toFixed(2)}`;

function wasmMemory(): number | null {
    const module = (globalThis as { __ThorVGModule?: { HEAPU8?: Uint8Array } })
        .__ThorVGModule;
    return module?.HEAPU8?.buffer.byteLength ?? null;
}

function jsHeap(): { used: number; total: number; limit: number } | null {
    const memory = (
        performance as Performance & {
            memory?: {
                usedJSHeapSize: number;
                totalJSHeapSize: number;
                jsHeapSizeLimit: number;
            };
        }
    ).memory;
    return memory
        ? {
              used: memory.usedJSHeapSize,
              total: memory.totalJSHeapSize,
              limit: memory.jsHeapSizeLimit,
          }
        : null;
}

export function createPerfOverlay(
    root: HTMLElement,
    getLocale: () => Locale,
    deps: PerfDeps,
): PerfOverlay {
    const stats = createRenderStats();
    const samples = Array.from({ length: HISTORY }, createFrameSample);
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
        if (next === open) {
            return;
        }
        open = next;
        panel.hidden = !open;
        deps.profile(open ? stats : null);
        layers.clear();
        deps.layerOverrides(open ? overrides : null);
        count = 0;
        head = 0;
        reorders = 0;
        for (const sample of samples) {
            sample.reordered = false;
            sample.gpuMs = NaN;
        }
        lastText = 0;
        heapPeak = 0;
        wasmStart = null;
        note.textContent = '';
        if (open) {
            applyLocale();
        }
    }

    function window1s() {
        const picked: number[] = [];
        const sums: Record<Series, number> = {
            sim: 0,
            build: 0,
            sync: 0,
            render: 0,
            hud: 0,
        };
        const gpuPicked: number[] = [];
        let elapsed = 0;
        let tickSum = 0;
        let tickMax = 0;
        let droppedSum = 0;
        let cost = 0;
        for (let k = 0; k < count && elapsed < 1000; k++) {
            const i = (head - 1 - k + HISTORY) % HISTORY;
            const frame = samples[i];
            picked.push(frame.frameMs);
            elapsed += frame.frameMs;
            for (const name of SERIES) {
                sums[name] += frame.segments[name];
            }
            tickSum += frame.ticks;
            tickMax = Math.max(tickMax, frame.ticks);
            droppedSum += frame.droppedMs;
            cost += frame.overlayMs;
            if (!Number.isNaN(frame.gpuMs)) {
                gpuPicked.push(frame.gpuMs);
            }
        }
        const gpuSorted = gpuPicked.sort((a, b) => a - b);
        const n = Math.max(1, picked.length);
        const sorted = [...picked].sort((a, b) => a - b);
        const avg = elapsed / n;
        const avgs: Record<Series, number> = {
            sim: sums.sim / n,
            build: sums.build / n,
            sync: sums.sync / n,
            render: sums.render / n,
            hud: sums.hud / n,
        };
        return {
            samples: picked.length,
            fps: elapsed > 0 ? (picked.length * 1000) / elapsed : 0,
            frame: {
                avg,
                p95:
                    sorted[
                        Math.min(
                            sorted.length - 1,
                            Math.floor(sorted.length * 0.95),
                        )
                    ] ?? 0,
                max: sorted[sorted.length - 1] ?? 0,
            },
            segments: avgs,
            ticks: { avg: tickSum / n, max: tickMax },
            droppedMs: droppedSum,
            overlayMs: cost / n,
            gpu: gpuSorted.length
                ? {
                      avg:
                          gpuSorted.reduce((a, b) => a + b, 0) /
                          gpuSorted.length,
                      p95: gpuSorted[
                          Math.min(
                              gpuSorted.length - 1,
                              Math.floor(gpuSorted.length * 0.95),
                          )
                      ],
                      max: gpuSorted[gpuSorted.length - 1],
                      samples: gpuSorted.length,
                  }
                : null,
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
            layerOverrides: {
                hidden: [...overrides.hidden],
                flat: [...overrides.flat],
            },
            memory: {
                jsHeap: heap,
                jsHeapPeak: heapPeak || null,
                wasm,
                wasmGrowth:
                    wasm !== null && wasmStart !== null
                        ? wasm - wasmStart
                        : null,
            },
        };
    }

    function drawGraph() {
        if (!g) {
            return;
        }
        const dpr = Math.min(devicePixelRatio || 1, 2);
        const width = graph.clientWidth || 280;
        const height = graph.clientHeight || 64;
        if (
            graph.width !== Math.round(width * dpr) ||
            graph.height !== Math.round(height * dpr)
        ) {
            graph.width = Math.round(width * dpr);
            graph.height = Math.round(height * dpr);
        }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, width, height);
        const bar = width / HISTORY;
        let peak = 0;
        for (let k = 0; k < count; k++) {
            peak = Math.max(
                peak,
                samples[(head - 1 - k + HISTORY) % HISTORY].frameMs,
            );
        }
        const range = Math.min(
            GRAPH_MAX_MS,
            Math.max(GRAPH_MIN_MS, Math.ceil(peak / 50) * 50),
        );
        const y = (value: number) =>
            height - (Math.min(range, value) / range) * height;
        for (let k = 0; k < count; k++) {
            const i = (head - count + k + HISTORY) % HISTORY;
            const frame = samples[i];
            const x = (HISTORY - count + k) * bar;
            let base = 0;
            for (const name of SERIES) {
                const value = frame.segments[name];
                if (value <= 0) {
                    continue;
                }
                g.fillStyle = COLORS[name];
                g.fillRect(
                    x,
                    y(base + value),
                    Math.max(1, bar),
                    y(base) - y(base + value),
                );
                base += value;
            }
            if (frame.frameMs > base) {
                g.fillStyle = COLORS.other;
                g.fillRect(
                    x,
                    y(frame.frameMs),
                    Math.max(1, bar),
                    y(base) - y(frame.frameMs),
                );
            }
        }
        g.strokeStyle = COLORS.gpu;
        g.lineWidth = 1.5;
        g.beginPath();
        let drawing = false;
        for (let k = 0; k < count; k++) {
            const i = (head - count + k + HISTORY) % HISTORY;
            const frame = samples[i];
            if (Number.isNaN(frame.gpuMs)) {
                continue;
            }
            const x = (HISTORY - count + k + 0.5) * bar;
            if (drawing) {
                g.lineTo(x, y(frame.gpuMs));
            } else {
                g.moveTo(x, y(frame.gpuMs));
            }
            drawing = true;
        }
        g.stroke();
        g.lineWidth = 1;
        g.font = '9px ui-monospace, monospace';
        g.fillStyle = '#ffffff99';
        g.fillText(`${range} ms`, width - 38, 9);
        for (const [limit, label] of [
            [1000 / 120, '120'],
            [1000 / 60, '60'],
            [1000 / 30, '30'],
        ] as const) {
            g.strokeStyle = limit === 1000 / 60 ? '#e8bc7c' : '#ffffff40';
            g.beginPath();
            g.moveTo(0, Math.round(y(limit)) + 0.5);
            g.lineTo(width, Math.round(y(limit)) + 0.5);
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
        if (heap) {
            heapPeak = Math.max(heapPeak, heap.used);
        }
        if (wasm !== null) {
            wasmStart ??= wasm;
        }
        const seg = w.segments;
        const lines = [
            `FPS ${w.fps.toFixed(1)}   frame ${ms(w.frame.avg)} / p95 ${ms(w.frame.p95)} / max ${ms(w.frame.max)} ms`,
            `sim ${ms(seg.sim)}  build ${ms(seg.build)}  sync ${ms(seg.sync)}`,
            `render ${ms(seg.render)}  hud ${ms(seg.hud)}`,
            `ticks/frame ${w.ticks.avg.toFixed(2)} (max ${w.ticks.max})  dropped ${ms(w.droppedMs)} ms/s`,
            `backend ${s?.backend ?? 'none'}${s && s.backend !== s.requested ? ` (FALLBACK, wanted ${s.requested})` : ''}`,
            `gpu ${w.gpu ? `${ms(w.gpu.avg)} / p95 ${ms(w.gpu.p95)} / max ${ms(w.gpu.max)} ms` : 'n/a'}  (timer ${s?.gpuTimer ?? 'n/a'})`,
            s
                ? `canvas ${s.width}×${s.height} css · page dpr ${devicePixelRatio}`
                : 'canvas n/a',
            s
                ? `raster ${s.raster.width}×${s.raster.height} · ${((s.raster.width * s.raster.height) / 1e6).toFixed(2)} Mpx · dpr ${+s.raster.dpr.toFixed(3)}`
                : 'raster n/a',
            `cmds ${stats.commands}  shapes ${stats.topShapes}/${stats.poolTop}  text ${stats.texts}`,
            `layers ${stats.layers}/${stats.layerSlots}  layer shapes ${stats.layerShapes} (parked ${stats.parkedShapes})`,
            `reorder ${stats.reorder ? 'YES' : 'no'}  (${reorders}/${count} frames)`,
            `blur g${stats.gaussianBlurs} m${stats.motionBlurs}  Σ${stats.blurAmount.toFixed(1)}  area ${(stats.blurArea / 1e3).toFixed(0)}k px²` +
                (s
                    ? ` (${((stats.blurArea / Math.max(1, s.width * s.height)) * 100).toFixed(0)}%)`
                    : ''),
            `mask ${stats.masks}  clip ${stats.clips}`,
            `JS heap ${heap ? `${mb(heap.used)} / ${mb(heap.total)} (peak ${mb(heapPeak)})` : 'n/a'}`,
            `WASM ${mb(wasm)}${wasm !== null && wasmStart !== null && wasm > wasmStart ? ` (+${mb(wasm - wasmStart)})` : ''}`,
            `overlay ${ms(w.overlayMs)} ms`,
        ];
        text.textContent = lines.join('\n');
        layers.update(
            stats.layerList,
            s ? s.width * s.height : 0,
            seg.render,
            performance.now(),
        );
    }

    function record(sample: FrameSample) {
        if (!open) {
            return;
        }
        const start = performance.now();
        const i = head;
        const frame = samples[i];
        frame.frameMs = sample.frameMs;
        frame.ticks = sample.ticks;
        frame.droppedMs = sample.droppedMs;
        frame.segments.sim = sample.simMs;
        frame.segments.hud = sample.hudMs;
        frame.segments.build = stats.buildMs;
        frame.segments.sync = stats.syncMs;
        frame.segments.render = stats.renderMs;
        frame.gpuMs = stats.gpuMs.length
            ? stats.gpuMs.reduce((a, b) => a + b, 0) / stats.gpuMs.length
            : NaN;
        if (count === HISTORY && frame.reordered) {
            reorders--;
        }
        frame.reordered = stats.reorder;
        if (stats.reorder) {
            reorders++;
        }
        head = (head + 1) % HISTORY;
        count = Math.min(HISTORY, count + 1);
        drawGraph();
        if (start - lastText >= TEXT_INTERVAL) {
            lastText = start;
            drawText();
        }
        frame.overlayMs = performance.now() - start;
    }

    const onKey = (event: KeyboardEvent) => {
        if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }
        if (event.key !== 'F3' && event.code !== 'Backquote') {
            return;
        }
        if (
            event.target instanceof Element &&
            /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)
        ) {
            return;
        }
        event.preventDefault();
        setOpen(!open);
    };
    window.addEventListener('keydown', onKey);

    async function copySnapshot() {
        const locale = getLocale();
        try {
            await navigator.clipboard.writeText(
                JSON.stringify(snapshot(), null, 2),
            );
            note.textContent = translate('replay.copied', locale);
        } catch {
            note.textContent = translate('replay.copyFailed', locale);
        }
    }
    copy.addEventListener('click', () => {
        void copySnapshot();
    });

    let initial = false;
    try {
        initial = new URLSearchParams(location.search).get('debug') === '1';
    } catch {}
    if (initial) {
        setOpen(true);
    }

    return {
        get enabled() {
            return open;
        },
        toggle: (next = !open) => setOpen(next),
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

export type PerfOverlay = {
    readonly enabled: boolean;
    toggle: (next?: boolean) => void;
    layers: {
        hide: (key: string, on?: boolean) => void;
        flatten: (key: string, on?: boolean) => void;
        reset: () => void;
        list: () => string[];
    };
    record: (sample: FrameSample) => void;
    snapshot: () => {
        at: string;
        userAgent: string;
        surface: PerfSurface | null;
        window: {
            samples: number;
            fps: number;
            frame: { avg: number; p95: number; max: number };
            segments: Record<
                'sim' | 'build' | 'sync' | 'render' | 'hud',
                number
            >;
            ticks: { avg: number; max: number };
            droppedMs: number;
            overlayMs: number;
            gpu: {
                avg: number;
                p95: number;
                max: number;
                samples: number;
            } | null;
        };
        render: RenderStats & { reordersInHistory: number };
        layerOverrides: { hidden: string[]; flat: string[] };
        memory: {
            jsHeap: { used: number; total: number; limit: number } | null;
            jsHeapPeak: number | null;
            wasm: number | null;
            wasmGrowth: number | null;
        };
    };
    destroy(): void;
};
