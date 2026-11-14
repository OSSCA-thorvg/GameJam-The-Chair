import { createRenderCtx } from '../src/render/context.ts';
import { createPaintPool, paint } from '../src/render/paint.ts';
import { drawOrbit as drawCurrent } from '../src/render/scene/orbit.ts';
import { drawOrbit as drawBaseline } from './.benchmark/baseline.mjs';
import { loadThorvg } from '../src/render/thorvg.ts';
import { previewScenes } from '../src/preview-scenes.ts';

const result = document.querySelector('#result');
const canvas = document.querySelector('canvas');
const scene = previewScenes.find(item => item.id === 'orbit-ending');
const TVG = await loadThorvg();
const tvg = new TVG.Canvas('#ending-benchmark', { width: 1000, height: 510 });
const capture = document.createElement('canvas');
capture.width = canvas.width;
capture.height = canvas.height;
const captureContext = capture.getContext('2d');
const ctx = createRenderCtx(captureContext);
Object.assign(ctx, { W: 1000, H: 510, dpr: 1 });

function draw(pool, current, at) {
    const { state } = scene.sample(at);
    Object.assign(ctx, { state, t: state.time, commands: [] });
    (current ? drawCurrent : drawBaseline)(ctx);
    const work = ctx.commands.length;
    paint(ctx, TVG, tvg, pool);
    return work;
}

function pixels(current, at) {
    tvg.remove();
    const work = draw(createPaintPool(), current, at);
    if (work < (at >= 36.5 ? 1 : 100)) throw new Error(`Missing work at ${at}: ${work}`);
    captureContext.drawImage(canvas, 0, 0);
    return new Uint8ClampedArray(captureContext.getImageData(0, 0, capture.width, capture.height).data);
}

async function run(current, at) {
    tvg.remove();
    const pool = createPaintPool(), times = [], intervals = [];
    const software = tvg.renderer === 'sw';
    for (let i = 0; i < (software ? 2 : 8); i++) draw(pool, current, at + i / 60);
    let previous;
    for (let i = 0; i < (software ? 8 : 32); i++) {
        const now = await new Promise(requestAnimationFrame);
        if (document.hidden) throw new Error('Benchmark tab hidden');
        if (previous !== undefined) intervals.push(now - previous);
        previous = now;
        const start = performance.now();
        draw(pool, current, at + i / 60);
        times.push(performance.now() - start);
    }
    return { drawMs: times.reduce((a, b) => a + b) / times.length,
        intervalMs: intervals.reduce((a, b) => a + b) / intervals.length,
        frames: times.length };
}

const params = new URLSearchParams(location.search);
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
document.querySelector('#run').onclick = async event => {
    event.target.disabled = true;
    try {
        const samples = params.get('at')?.split(',').map(Number) ?? (tvg.renderer === 'sw' ? [15, 20, 25, 30, 38] : [5, 15, 20, 25, 30, 38]);
        const differences = {};
        const from = Number(params.get('from') ?? 14), to = Number(params.get('to') ?? 38), step = Number(params.get('step') ?? .5);
        for (const at of Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step)) {
            const a = pixels(false, at), b = pixels(true, at);
            let count = 0, max = 0;
            for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) {
                count++;
                max = Math.max(max, Math.abs(a[i] - b[i]));
            }
            differences[at] = { channels: count, max };
        }
        if (params.has('verify')) {
            result.textContent = JSON.stringify({ renderer: tvg.renderer, raster: [canvas.width, canvas.height], differences }, null, 2);
            event.target.disabled = false;
            return;
        }
        const runs = {};
        for (const at of samples) {
            const baseline = [], current = [];
            for (let i = 0; i < 5; i++) {
                result.textContent = `Scene ${at}s, pair ${i + 1}/5`;
                if (i % 2 === 0) {
                    baseline.push(await run(false, at)); current.push(await run(true, at));
                } else {
                    current.push(await run(true, at)); baseline.push(await run(false, at));
                }
            }
            const summarize = rows => ({
                drawMs: median(rows.map(row => row.drawMs)),
                intervalMs: median(rows.map(row => row.intervalMs)),
                rangeMs: [Math.min(...rows.map(row => row.drawMs)), Math.max(...rows.map(row => row.drawMs))],
                intervalRangeMs: [Math.min(...rows.map(row => row.intervalMs)), Math.max(...rows.map(row => row.intervalMs))],
                frames: rows.reduce((total, row) => total + row.frames, 0),
            });
            runs[at] = { baseline: summarize(baseline), current: summarize(current) };
        }
        result.textContent = JSON.stringify({ renderer: tvg.renderer, raster: [canvas.width, canvas.height],
            errors: 0, differences, runs }, null, 2);
    } catch (error) { result.textContent = JSON.stringify({ errors: 1, error: String(error) }); }
    event.target.disabled = false;
};
