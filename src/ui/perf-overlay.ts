import { translate } from '../i18n';
import { createLayerPanel } from './perf-layers';
import { createLayerOverrides, createRenderStats } from '../render/perf';

import type { Locale } from '../i18n';
import type { LayerInfo, LayerOverrides, RenderStats } from '../render/perf';
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
    const module = (
        globalThis as {
            __ThorVGModule?: {
                HEAPU8?: Uint8Array;
            };
        }
    ).__ThorVGModule;
    return module?.HEAPU8?.buffer.byteLength ?? null;
}
function jsHeap(): {
    used: number;
    total: number;
    limit: number;
} | null {
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
    return new PerfOverlayRuntime(root, getLocale, deps).api();
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
class PerfOverlayRuntime {
    private root!: HTMLElement;
    private getLocale!: () => Locale;
    private deps!: PerfDeps;
    private stats!: RenderStats;
    private samples!: Array<{
        frameMs: number;
        ticks: number;
        droppedMs: number;
        overlayMs: number;
        gpuMs: number;
        reordered: boolean;
        segments: {
            sim: number;
            build: number;
            sync: number;
            render: number;
            hud: number;
        };
    }>;
    private head!: number;
    private count!: number;
    private reorders!: number;
    private lastText!: number;
    private heapPeak!: number;
    private wasmStart!: number | null;
    private open!: boolean;
    private panel!: HTMLDivElement;
    private header!: HTMLDivElement;
    private title!: HTMLElement;
    private copy!: HTMLButtonElement;
    private note!: HTMLElement;
    private graph!: HTMLCanvasElement;
    private legend!: HTMLDivElement;
    private text!: HTMLPreElement;
    private overrides!: LayerOverrides;
    private layers!: {
        element: HTMLDetailsElement;
        update: (
            layers: LayerInfo[],
            canvasArea: number,
            renderMs: number,
            now: number,
        ) => void;
        applyLocale: () => void;
        set: (key: string, action: 'hide' | 'flat', on: boolean) => void;
        clear: () => void;
        keys: () => string[];
        destroy(): void;
    };
    private g!: CanvasRenderingContext2D | null;
    private onKey: (event: KeyboardEvent) => void = (event: KeyboardEvent) => {
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
        this.setOpen(!this.open);
    };
    private initial!: boolean;
    constructor(root: HTMLElement, getLocale: () => Locale, deps: PerfDeps) {
        this.root = root;
        this.getLocale = getLocale;
        this.deps = deps;
        this.stats = createRenderStats();
        this.samples = Array.from({ length: HISTORY }, createFrameSample);
        this.head = 0;
        this.count = 0;
        this.reorders = 0;
        this.lastText = 0;
        this.heapPeak = 0;
        this.wasmStart = null;
        this.open = false;
        this.panel = document.createElement('div');
        this.panel.className = 'perf-overlay';
        this.panel.hidden = true;
        this.panel.setAttribute('aria-hidden', 'true');
        this.header = document.createElement('div');
        this.header.className = 'perf-header';
        this.title = document.createElement('b');
        this.copy = document.createElement('button');
        this.copy.type = 'button';
        this.note = document.createElement('small');
        this.header.append(this.title, this.copy, this.note);
        this.graph = document.createElement('canvas');
        this.graph.className = 'perf-graph';
        this.legend = document.createElement('div');
        this.legend.className = 'perf-legend';
        for (const name of [...SERIES, 'other', 'gpu'] as const) {
            const item = document.createElement('span');
            const chip = document.createElement('i');
            chip.style.background = COLORS[name];
            item.append(chip, name);
            this.legend.append(item);
        }
        this.text = document.createElement('pre');
        this.overrides = createLayerOverrides();
        this.layers = createLayerPanel(this.getLocale, this.overrides);
        this.panel.append(
            this.header,
            this.graph,
            this.legend,
            this.text,
            this.layers.element,
        );
        (this.root.querySelector('[data-scene]') ?? this.root).append(
            this.panel,
        );
        this.g = this.graph.getContext('2d');
        window.addEventListener('keydown', this.onKey);
        this.copy.addEventListener('click', () => {
            void this.copySnapshot();
        });
        this.initial = false;
        try {
            this.initial =
                new URLSearchParams(location.search).get('debug') === '1';
        } catch {}
        if (this.initial) {
            this.setOpen(true);
        }
    }
    private applyLocale = () => {
        const locale = this.getLocale();
        this.title.textContent = translate('perf.title', locale);
        this.copy.textContent = translate('perf.copy', locale);
        this.layers.applyLocale();
    };
    private setOpen = (next: boolean) => {
        if (next === this.open) {
            return;
        }
        this.open = next;
        this.panel.hidden = !this.open;
        this.deps.profile(this.open ? this.stats : null);
        this.layers.clear();
        this.deps.layerOverrides(this.open ? this.overrides : null);
        this.count = 0;
        this.head = 0;
        this.reorders = 0;
        for (const sample of this.samples) {
            sample.reordered = false;
            sample.gpuMs = NaN;
        }
        this.lastText = 0;
        this.heapPeak = 0;
        this.wasmStart = null;
        this.note.textContent = '';
        if (this.open) {
            this.applyLocale();
        }
    };
    private window1s = () => {
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
        for (let k = 0; k < this.count && elapsed < 1000; k++) {
            const i = (this.head - 1 - k + HISTORY) % HISTORY;
            const frame = this.samples[i];
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
    };
    private snapshot = () => {
        const heap = jsHeap();
        const wasm = wasmMemory();
        return {
            at: new Date().toISOString(),
            userAgent: navigator.userAgent,
            surface: this.deps.surface(),
            window: this.window1s(),
            render: { ...this.stats, reordersInHistory: this.reorders },
            layerOverrides: {
                hidden: [...this.overrides.hidden],
                flat: [...this.overrides.flat],
            },
            memory: {
                jsHeap: heap,
                jsHeapPeak: this.heapPeak || null,
                wasm,
                wasmGrowth:
                    wasm !== null && this.wasmStart !== null
                        ? wasm - this.wasmStart
                        : null,
            },
        };
    };
    private drawGraph = () => {
        if (!this.g) {
            return;
        }
        const dpr = Math.min(devicePixelRatio || 1, 2);
        const width = this.graph.clientWidth || 280;
        const height = this.graph.clientHeight || 64;
        if (
            this.graph.width !== Math.round(width * dpr) ||
            this.graph.height !== Math.round(height * dpr)
        ) {
            this.graph.width = Math.round(width * dpr);
            this.graph.height = Math.round(height * dpr);
        }
        const { bar, y, range } = this.paintGraph(dpr, width, height, this.g);
        let drawing = false;
        for (let k = 0; k < this.count; k++) {
            const i = (this.head - this.count + k + HISTORY) % HISTORY;
            const frame = this.samples[i];
            if (Number.isNaN(frame.gpuMs)) {
                continue;
            }
            const x = (HISTORY - this.count + k + 0.5) * bar;
            if (drawing) {
                this.g.lineTo(x, y(frame.gpuMs));
            } else {
                this.g.moveTo(x, y(frame.gpuMs));
            }
            drawing = true;
        }
        this.g.stroke();
        this.g.lineWidth = 1;
        this.g.font = '9px ui-monospace, monospace';
        this.g.fillStyle = '#ffffff99';
        this.g.fillText(`${range} ms`, width - 38, 9);
        for (const [limit, label] of [
            [1000 / 120, '120'],
            [1000 / 60, '60'],
            [1000 / 30, '30'],
        ] as const) {
            this.g.strokeStyle = limit === 1000 / 60 ? '#e8bc7c' : '#ffffff40';
            this.g.beginPath();
            this.g.moveTo(0, Math.round(y(limit)) + 0.5);
            this.g.lineTo(width, Math.round(y(limit)) + 0.5);
            this.g.stroke();
            this.g.fillStyle = '#ffffff99';
            this.g.fillText(label, 2, y(limit) - 2);
        }
    };
    private drawText = () => {
        const w = this.window1s();
        this.drawSurfaceText(w);
    };
    private record = (sample: FrameSample) => {
        if (!this.open) {
            return;
        }
        const start = performance.now();
        const i = this.head;
        const frame = this.samples[i];
        frame.frameMs = sample.frameMs;
        frame.ticks = sample.ticks;
        frame.droppedMs = sample.droppedMs;
        frame.segments.sim = sample.simMs;
        frame.segments.hud = sample.hudMs;
        frame.segments.build = this.stats.buildMs;
        frame.segments.sync = this.stats.syncMs;
        frame.segments.render = this.stats.renderMs;
        frame.gpuMs = this.stats.gpuMs.length
            ? this.stats.gpuMs.reduce((a, b) => a + b, 0) /
              this.stats.gpuMs.length
            : NaN;
        if (this.count === HISTORY && frame.reordered) {
            this.reorders--;
        }
        frame.reordered = this.stats.reorder;
        if (this.stats.reorder) {
            this.reorders++;
        }
        this.head = (this.head + 1) % HISTORY;
        this.count = Math.min(HISTORY, this.count + 1);
        this.drawGraph();
        if (start - this.lastText >= TEXT_INTERVAL) {
            this.lastText = start;
            this.drawText();
        }
        frame.overlayMs = performance.now() - start;
    };
    private copySnapshot = async () => {
        const locale = this.getLocale();
        try {
            await navigator.clipboard.writeText(
                JSON.stringify(this.snapshot(), null, 2),
            );
            this.note.textContent = translate('replay.copied', locale);
        } catch {
            this.note.textContent = translate('replay.copyFailed', locale);
        }
    };
    private paintGraph(
        dpr: number,
        width: number,
        height: number,
        g: CanvasRenderingContext2D,
    ) {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, width, height);
        const bar = width / HISTORY;
        let peak = 0;
        for (let k = 0; k < this.count; k++) {
            peak = Math.max(
                peak,
                this.samples[(this.head - 1 - k + HISTORY) % HISTORY].frameMs,
            );
        }
        const range = Math.min(
            GRAPH_MAX_MS,
            Math.max(GRAPH_MIN_MS, Math.ceil(peak / 50) * 50),
        );
        const y = (value: number) =>
            height - (Math.min(range, value) / range) * height;
        for (let k = 0; k < this.count; k++) {
            const i = (this.head - this.count + k + HISTORY) % HISTORY;
            const frame = this.samples[i];
            const x = (HISTORY - this.count + k) * bar;
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
        return { bar, y, range };
    }
    private drawSurfaceText(w: {
        samples: number;
        fps: number;
        frame: {
            avg: number;
            p95: number;
            max: number;
        };
        segments: Record<'sim' | 'build' | 'sync' | 'render' | 'hud', number>;
        ticks: {
            avg: number;
            max: number;
        };
        droppedMs: number;
        overlayMs: number;
        gpu: {
            avg: number;
            p95: number;
            max: number;
            samples: number;
        } | null;
    }) {
        const s = this.deps.surface();
        this.renderPerfText(w, s);
    }
    private renderPerfText(
        w: {
            samples: number;
            fps: number;
            frame: {
                avg: number;
                p95: number;
                max: number;
            };
            segments: Record<
                'sim' | 'build' | 'sync' | 'render' | 'hud',
                number
            >;
            ticks: {
                avg: number;
                max: number;
            };
            droppedMs: number;
            overlayMs: number;
            gpu: {
                avg: number;
                p95: number;
                max: number;
                samples: number;
            } | null;
        },
        s: PerfSurface | null,
    ) {
        const { seg, heap, wasm } = this.readMemoryUsage(w);
        const lines = [
            `FPS ${w.fps.toFixed(1)}   frame ${ms(w.frame.avg)} / p95 ${ms(w.frame.p95)} / max ${ms(w.frame.max)} ms`,
            `sim ${ms(seg.sim)}  build ${ms(seg.build)}  sync ${ms(seg.sync)}`,
            `render ${ms(seg.render)}  hud ${ms(seg.hud)}`,
            `ticks/frame ${w.ticks.avg.toFixed(2)} (max ${w.ticks.max})  dropped ${ms(w.droppedMs)} ms/s`,
            describeBackend(s),
            `gpu ${w.gpu ? `${ms(w.gpu.avg)} / p95 ${ms(w.gpu.p95)} / max ${ms(w.gpu.max)} ms` : 'n/a'}  (timer ${s?.gpuTimer ?? 'n/a'})`,
            s
                ? `canvas ${s.width}×${s.height} css · page dpr ${devicePixelRatio}`
                : 'canvas n/a',
            s
                ? `raster ${s.raster.width}×${s.raster.height} · ${((s.raster.width * s.raster.height) / 1e6).toFixed(2)} Mpx · dpr ${+s.raster.dpr.toFixed(3)}`
                : 'raster n/a',
            `cmds ${this.stats.commands}  shapes ${this.stats.topShapes}/${this.stats.poolTop}  text ${this.stats.texts}`,
            `layers ${this.stats.layers}/${this.stats.layerSlots}  layer shapes ${this.stats.layerShapes} (parked ${this.stats.parkedShapes})`,
            `reorder ${this.stats.reorder ? 'YES' : 'no'}  (${this.reorders}/${this.count} frames)`,
            `blur g${this.stats.gaussianBlurs} m${this.stats.motionBlurs}  Σ${this.stats.blurAmount.toFixed(1)}  area ${(this.stats.blurArea / 1e3).toFixed(0)}k px²` +
                (s
                    ? ` (${((this.stats.blurArea / Math.max(1, s.width * s.height)) * 100).toFixed(0)}%)`
                    : ''),
            `mask ${this.stats.masks}  clip ${this.stats.clips}`,
            `JS heap ${heap ? `${mb(heap.used)} / ${mb(heap.total)} (peak ${mb(this.heapPeak)})` : 'n/a'}`,
            `WASM ${mb(wasm)}${wasm !== null && this.wasmStart !== null && wasm > this.wasmStart ? ` (+${mb(wasm - this.wasmStart)})` : ''}`,
            `overlay ${ms(w.overlayMs)} ms`,
        ];
        this.text.textContent = lines.join('\n');
        this.layers.update(
            this.stats.layerList,
            s ? s.width * s.height : 0,
            seg.render,
            performance.now(),
        );
    }
    private readMemoryUsage(w: {
        samples: number;
        fps: number;
        frame: {
            avg: number;
            p95: number;
            max: number;
        };
        segments: Record<'sim' | 'build' | 'sync' | 'render' | 'hud', number>;
        ticks: {
            avg: number;
            max: number;
        };
        droppedMs: number;
        overlayMs: number;
        gpu: {
            avg: number;
            p95: number;
            max: number;
            samples: number;
        } | null;
    }) {
        const heap = jsHeap();
        const wasm = wasmMemory();
        if (heap) {
            this.heapPeak = Math.max(this.heapPeak, heap.used);
        }
        if (wasm !== null) {
            this.wasmStart ??= wasm;
        }
        const seg = w.segments;
        return { seg, heap, wasm };
    }
    api(): PerfOverlay {
        const readEnabled = () => {
            return this.open;
        };
        return {
            get enabled() {
                return readEnabled();
            },
            toggle: this.apiToggle,
            layers: {
                hide: (key: string, on = true) =>
                    this.layers.set(key, 'hide', on),
                flatten: (key: string, on = true) =>
                    this.layers.set(key, 'flat', on),
                reset: () => this.layers.clear(),
                list: () => this.layers.keys(),
            },
            record: this.record,
            snapshot: this.snapshot,
            destroy: this.apiDestroy,
        };
    }
    private apiToggle = (next: boolean | undefined = !this.open) => {
        return this.setOpen(next);
    };
    private apiDestroy = () => {
        window.removeEventListener('keydown', this.onKey);
        this.deps.profile(null);
        this.deps.layerOverrides(null);
        this.layers.destroy();
        this.panel.remove();
    };
}

function describeBackend(s: PerfSurface | null) {
    return `backend ${s?.backend ?? 'none'}${s && s.backend !== s.requested ? ` (FALLBACK, wanted ${s.requested})` : ''}`;
}
