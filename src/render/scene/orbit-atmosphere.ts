import type { RenderCtx } from '../context';
import type { SkyProjection } from './sky-projection';
import { puffCloud, CLOUD_TONES, seeded } from './cloud-art';

export function orbitSky(ctx: RenderCtx) {
    ctx.commands.push({ v: [[0,0],[ctx.W,0],[ctx.W,ctx.H],[0,ctx.H]], c: {
        from: [0,0], to: [0,ctx.H], stops: [[0,ctx.rgba('#7499b9')],[.55,ctx.rgba('#a7bdd0')],[1,ctx.rgba('#efd0bc')]],
    } });
    const horizon = ctx.H * .6;
    const random = seeded(9102);
    const offset = (ctx.state.player.x / 680) * ctx.W * .025;
    for (let i = 0; i < 70; i++) {
        const x = (i / 69) * ctx.W - offset;
        const w = 4 + random() * ctx.W * .014;
        const h = 5 + random() * ctx.H * .05;
        ctx.commands.push({ v: [[x,horizon],[x,horizon-h],[x+w,horizon-h],[x+w,horizon]], c: '#7d9fbb48' });
    }
    for (let i = 0; i < 18; i++) {
        const y = horizon + 10 + i * 5, spread = i * i * .48;
        ctx.commands.push({ v: [[ctx.W*.5-spread,y],[ctx.W*.5+spread,y],[ctx.W*.5+spread+15,y+1],[ctx.W*.5-spread-15,y+1]], c: '#d6dfdf40' });
    }
}

export function orbitCloudBank(ctx: RenderCtx, view: SkyProjection, travel: number, foreground: boolean) {
    const saved = { scale: ctx.scale, cam: ctx.cam, vertical: ctx.vertical, ox: ctx.ox, oy: ctx.oy,
        rotation: ctx.rotation, localScale: ctx.localScale, mirror: ctx.mirror };
    Object.assign(ctx, { scale: 1, cam: 0, vertical: 0, ox: 0, oy: 0, rotation: 0, localScale: 1, mirror: null });
    const random = seeded(817);
    const specs = Array.from({ length: 42 }, (_, i) => ({
        x: (i % 2 ? 1 : -1) * (420 + random() * 1700),
        y: -330 - random() * 100, z: 800 + random() * 9000,
        radius: 300 + random() * 430, seed: 6100 + i,
    })).sort((a,b) => b.z - a.z);
    for (const cloud of specs) {
        const z = ((cloud.z - travel + 12000) % 10000) - 500;
        if (z < -160 || (z < 900) !== foreground) continue;
        const center: [number,number,number] = [z, cloud.y - ctx.state.player.y * .45, cloud.x - ctx.state.player.x * .55];
        const [x,y] = view.project(center);
        const edge = view.project([z,center[1],center[2]+cloud.radius]);
        const size = Math.abs(edge[0]-x) / 170;
        if (!foreground && z < 4500 && Math.abs(x-ctx.W/2) < ctx.W*.34+size*90) continue;
        if (x < -size*220 || x > ctx.W+size*220) continue;
        puffCloud(ctx, x, y, size, cloud.seed, CLOUD_TONES.dusk, { alpha: .9 });
    }
    if (!foreground) for (const [x,y,seed] of [[.15,.15,9201],[.83,.1,9202]]) {
        puffCloud(ctx, ctx.W*x + Math.sin(travel*.0003)*8, ctx.H*y, ctx.W/3600, seed, CLOUD_TONES.dusk, { alpha: .6 });
    }
    // A low continuous cloud floor leaves the city visible above its crests.
    if (!foreground) for (let i = 0; i < 7; i++) {
        puffCloud(ctx, ctx.W * (i / 6), ctx.H * .94, ctx.W / 750, 7300+i, CLOUD_TONES.dusk);
    }
    Object.assign(ctx, saved);
}

export function doorGlow(ctx: RenderCtx, view: SkyProjection, point: [number,number,number]) {
    if (view.depth(point) < 80) return;
    const [x,y] = view.project(point);
    const radius = Math.min(ctx.H * .42, 210000 / view.depth(point));
    ctx.commands.push({ v: [[0,0],[ctx.W,0],[ctx.W,ctx.H],[0,ctx.H]], c: {
        from: [x,y], to: [x+radius,y], radius, stops: [[0,ctx.rgba('#ffdda6',.8)],[1,ctx.rgba('#ffdda6',0)]],
    }, layer: { key: 'orbit-door-light', blend: 'screen' } });
}
