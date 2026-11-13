import type { RenderCtx } from '../context';
import type { SkyProjection } from './sky-projection';
import { blendCloudTone, breadCloud, CLOUD_TONES, puffCloud, seeded } from './cloud-art';

const CITY = (() => {
    const random = seeded(9102);
    return Array.from({ length: 70 }, (_, i) => ({ x: i/69, w: .004+random()*.014, h: .01+random()*.05 }));
})();
const CLOUDS = (() => {
    const random = seeded(817);
    return Array.from({ length: 10 }, (_, i) => ({
        x: (i%2 ? 1 : -1) * (420+random()*1700), y: -330-random()*100,
        z: 800+random()*9000, radius: 190+random()*160, seed: 6100+i,
    })).sort((a,b) => b.z-a.z);
})();

/** Where the chair sits in the stage-five cloud basin; the stage-four ending passes the origin. */
export type BasinAnchor = { x: number; y: number };

export function orbitSky(ctx: RenderCtx, anchor: BasinAnchor = ctx.state.player) {
    ctx.commands.push({ v: [[0,0],[ctx.W,0],[ctx.W,ctx.H],[0,ctx.H]], c: {
        from: [0,0], to: [0,ctx.H], stops: [[0,ctx.rgba('#7499b9')],[.55,ctx.rgba('#a7bdd0')],[1,ctx.rgba('#efd0bc')]],
    } });
    const horizon = ctx.H * .6;
    const offset = (anchor.x / 680) * ctx.W * .025;
    for (const building of CITY) {
        const x = building.x * ctx.W - offset;
        const w = building.w * ctx.W, h = building.h * ctx.H;
        ctx.commands.push({ v: [[x,horizon],[x,horizon-h],[x+w,horizon-h],[x+w,horizon]], c: '#7d9fbb48' });
    }
    for (let i = 0; i < 18; i++) {
        const y = horizon + 10 + i * 5, spread = i * i * .48;
        ctx.commands.push({ v: [[ctx.W*.5-spread,y],[ctx.W*.5+spread,y],[ctx.W*.5+spread+15,y+1],[ctx.W*.5-spread-15,y+1]], c: '#d6dfdf40' });
    }
}

// Dough springs past its full size, then sinks back like a loaf leaving the oven.
function rise(t: number) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const u = t - 1, overshoot = 2.6;
    return 1 + (overshoot + 1) * u * u * u + overshoot * u * u;
}

/**
 * Bread cloud that can still be proofing: `proof` 0 is a small pale ball of dough, 1 the baked cloud.
 * `opacity` fades it further. Fully proofed, opaque clouds take the shared `breadCloud` path so stage five draws exactly what it always did.
 */
function bakedCloud(ctx: RenderCtx, x: number, y: number, size: number, seed: number, near: boolean, proof: number, opacity = 1) {
    if (proof >= 1 && opacity >= 1) {
        breadCloud(ctx, x, y, size, seed, near);
        return;
    }
    const swell = rise(proof);
    if (swell <= .02) return;
    const baked = ctx.clamp((proof - .25) / .6, 0, 1);
    const tone = blendCloudTone(CLOUD_TONES.ascent, CLOUD_TONES.bread, baked * baked * (3 - 2 * baked));
    // The puff stays seated on its flat base while it swells, so dough rises instead of inflating from the middle.
    const scale = .18 + .82 * swell;
    puffCloud(ctx, x, y + 34 * size * (1 - scale), size * scale, seed, tone,
        { alpha: (near ? .95 : .72) * Math.min(1, proof * 4) * opacity, fade: true });
}

export type CloudBankOptions = {
    anchor?: BasinAnchor;
    /** 0..1 progress of the stage-four ending; each cloud proofs on its own beat. */
    proof?: number;
    /** Clouds nearer the camera than this are skipped; the swinging ending camera passes close to some. */
    nearDepth?: number;
};

export function orbitCloudBank(ctx: RenderCtx, view: SkyProjection, travel: number, foreground: boolean, options: CloudBankOptions = {}) {
    const anchor = options.anchor ?? ctx.state.player;
    const proof = options.proof ?? 1;
    // Each cloud starts proofing a little after the previous one, so the basin bubbles up rather than appearing at once.
    const beat = (index: number, count: number) => ctx.clamp((proof - index / count * .45) / .55, 0, 1);
    const saved = { scale: ctx.scale, cam: ctx.cam, vertical: ctx.vertical, ox: ctx.ox, oy: ctx.oy,
        rotation: ctx.rotation, localScale: ctx.localScale, mirror: ctx.mirror };
    Object.assign(ctx, { scale: 1, cam: 0, vertical: 0, ox: 0, oy: 0, rotation: 0, localScale: 1, mirror: null });
    for (const [index, cloud] of CLOUDS.entries()) {
        const z = ((cloud.z - travel + 12000) % 10000) - 500;
        if (z < -160 || (z < 900) !== foreground) continue;
        const center: [number,number,number] = [z, cloud.y - anchor.y * .45, cloud.x - anchor.x * .55];
        const depth = view.depth(center);
        if (depth < (options.nearDepth ?? 200)) continue;
        const [x,y] = view.project(center);
        const edge = view.project([z,center[1],center[2]+cloud.radius]);
        const size = Math.abs(edge[0]-x) / 170;
        if (!foreground && z < 4500 && Math.abs(x-ctx.W/2) < ctx.W*.34+size*90) continue;
        if (x < -size*300 || x > ctx.W+size*300 || y-size*180 > ctx.H || y+size*40 < 0) continue;
        // With a custom cutoff, clouds swinging in past the camera fade in rather than popping at it.
        const opacity = options.nearDepth === undefined ? 1 : ctx.clamp((depth - options.nearDepth) / 600, 0, 1);
        bakedCloud(ctx, x, y, size, cloud.seed, foreground, beat(index, CLOUDS.length), opacity);
    }
    if (!foreground) for (const [i, [x,y,seed]] of [[.15,.15,9201],[.83,.1,9202]].entries()) {
        bakedCloud(ctx, ctx.W*x + Math.sin(travel*.0003)*8, ctx.H*y, ctx.W/2500, seed, false, beat(i * 4 + 2, 10));
    }
    // A low continuous cloud floor leaves the city visible above its crests. It carries over from stage four,
    // so it is already baked when the ending starts.
    if (!foreground) for (let i = 0; i < 5; i++) {
        breadCloud(ctx, ctx.W * (i / 4), ctx.H * (.98+Math.sin(i*4)*.065), ctx.W/1000*(.8+(i%2)*.2), 700+i*2);
    }
    Object.assign(ctx, saved);
}

export function doorGlow(ctx: RenderCtx, view: SkyProjection, point: [number,number,number], alpha = 1) {
    if (view.depth(point) < 80) return;
    const [x,y] = view.project(point);
    const radius = Math.min(ctx.H * .42, 210000 / view.depth(point));
    ctx.commands.push({ v: [[x-radius,y-radius],[x+radius,y-radius],[x+radius,y+radius],[x-radius,y+radius]], c: {
        from: [x,y], to: [x+radius,y], radius, stops: [[0,ctx.rgba('#ffdda6',.8*alpha)],[1,ctx.rgba('#ffdda6',0)]],
    }, layer: { key: 'orbit-door-light', blend: 'screen' } });
}
