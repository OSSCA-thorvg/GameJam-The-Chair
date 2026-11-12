import { createRenderCtx } from '../src/render/context.ts';
import { createPaintPool, paint } from '../src/render/paint.ts';
import { drawOrbit } from '../src/render/scene/orbit.ts';
import { drawOrbit as drawBefore } from './.benchmark/baseline.mjs';
import { loadThorvg } from '../src/render/thorvg.ts';
import { previewScenes } from '../src/preview-scenes.ts';

const result = document.querySelector('#result');
const canvas = document.querySelector('canvas');
const scene = previewScenes.find(scene => scene.id === 'orbit-route');
const TVG = await loadThorvg();
const tvg = new TVG.Canvas('#orbit-benchmark', { width: 1000, height: 510 });
const labels = document.createElement('canvas').getContext('2d');
const ctx = createRenderCtx(canvas.getContext('2d'), labels);
Object.assign(ctx, { W: 1000, H: 510, dpr: 1 });

function draw(pool, optimized, at) {
    const { state } = scene.sample(at);
    // Clear BOTH sides: the baseline measures a conservative single frame, excluding its accumulation bug.
    Object.assign(ctx, { state, t: state.time, commands: [], foregroundActors: [] });
    (optimized ? drawOrbit : drawBefore)(ctx);
    paint(ctx, TVG, tvg, pool);
}

function verify(optimized) {
    tvg.remove();
    draw(createPaintPool(), optimized, 3);
    if (ctx.commands.length < 200) throw new Error('Missing drawing work');
    for (const c of ctx.commands) for (const p of [...c.v,...(c.curves??[])]) {
        if (!p.every(Number.isFinite)) throw new Error('Non-finite drawing geometry');
    }
    const image = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    const colors = new Set();
    for (let i=0;i<image.length;i+=400) colors.add(`${image[i]},${image[i+1]},${image[i+2]}`);
    if (colors.size < 20) throw new Error('Canvas did not render the scene');
    return { commands: ctx.commands.length, cubics: ctx.commands.reduce((n,c)=>n+(c.curves?.length??0),0),
        gradients: ctx.commands.filter(c=>c.c && typeof c.c==='object').length, colors: colors.size };
}

function profile(optimized) {
    tvg.remove();
    const pool = createPaintPool();
    draw(pool,optimized,3);
    let generationMs=0, paintMs=0;
    for (let i=0;i<8;i++) {
        const { state } = scene.sample(3+i/60);
        Object.assign(ctx,{state,t:state.time,commands:[],foregroundActors:[]});
        const start=performance.now();
        (optimized ? drawOrbit : drawBefore)(ctx);
        const generated=performance.now();
        paint(ctx,TVG,tvg,pool);
        generationMs+=generated-start;
        paintMs+=performance.now()-generated;
    }
    return { generationMs: generationMs/8, paintMs: paintMs/8 };
}

async function run(optimized) {
    tvg.remove();
    const pool=createPaintPool(), cpu=[], intervals=[];
    for (let i=0;i<8;i++) draw(pool,optimized,3+i/60);
    let previous;
    for (let i=0;i<40;i++) {
        const now=await new Promise(requestAnimationFrame);
        if (document.hidden) throw new Error('Tab became hidden; rerun in foreground.');
        if (previous!==undefined) intervals.push(now-previous);
        previous=now;
        const start=performance.now();
        draw(pool,optimized,3+i/60);
        cpu.push(performance.now()-start);
    }
    return { cpuMs: cpu.reduce((a,b)=>a+b,0)/cpu.length,
        frameMs: intervals.reduce((a,b)=>a+b,0)/intervals.length, frames: cpu.length };
}

const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
document.querySelector('#run').onclick=async event=>{
    event.target.disabled=true;
    const runs={baseline:[],optimized:[]};
    try {
        const work={baseline:verify(false),optimized:verify(true)};
        const profiling={baseline:profile(false),optimized:profile(true)};
        for (let i=0;i<5;i++) for (const optimized of [false,true]) {
            result.textContent=`Run ${i+1}/5 · ${optimized?'optimized':'baseline'}`;
            runs[optimized?'optimized':'baseline'].push(await run(optimized));
        }
        const summary=Object.fromEntries(Object.entries(runs).map(([key,rows])=>[key,{
            cpuMedianMs:median(rows.map(r=>r.cpuMs)),cpuRangeMs:[Math.min(...rows.map(r=>r.cpuMs)),Math.max(...rows.map(r=>r.cpuMs))],
            frameMedianMs:median(rows.map(r=>r.frameMs)),completedFrames:rows.reduce((n,r)=>n+r.frames,0),
        }]));
        result.replaceChildren();
        for (const [key,value] of Object.entries({renderer:tvg.renderer,viewport:[1000,510],raster:[canvas.width,canvas.height],errors:0,work,profiling,...summary})) {
            const row=document.createElement('div');row.textContent=`${key}: ${JSON.stringify(value)}`;result.append(row);
        }
    } catch(error) {result.textContent=JSON.stringify({errors:1,error:String(error),runs});}
    event.target.disabled=false;
};
