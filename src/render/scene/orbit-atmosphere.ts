import type { RenderCtx } from '../context';
import type { SkyProjection } from './sky-projection';
import { breadCloud, seeded } from './cloud-art';

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

export function orbitSky(ctx: RenderCtx) {
    ctx.commands.push({ v: [[0,0],[ctx.W,0],[ctx.W,ctx.H],[0,ctx.H]], c: {
        from: [0,0], to: [0,ctx.H], stops: [[0,ctx.rgba('#7499b9')],[.55,ctx.rgba('#a7bdd0')],[1,ctx.rgba('#efd0bc')]],
    } });
    const horizon = ctx.H * .6;
    const offset = (ctx.state.player.x / 680) * ctx.W * .025;
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

export function orbitCloudBank(ctx: RenderCtx, view: SkyProjection, travel: number, foreground: boolean) {
    const saved = { scale: ctx.scale, cam: ctx.cam, vertical: ctx.vertical, ox: ctx.ox, oy: ctx.oy,
        rotation: ctx.rotation, localScale: ctx.localScale, mirror: ctx.mirror };
    Object.assign(ctx, { scale: 1, cam: 0, vertical: 0, ox: 0, oy: 0, rotation: 0, localScale: 1, mirror: null });
    for (const cloud of CLOUDS) {
        const z = ((cloud.z - travel + 12000) % 10000) - 500;
        if (z < -160 || (z < 900) !== foreground) continue;
        const center: [number,number,number] = [z, cloud.y - ctx.state.player.y * .45, cloud.x - ctx.state.player.x * .55];
        const [x,y] = view.project(center);
        const edge = view.project([z,center[1],center[2]+cloud.radius]);
        const size = Math.abs(edge[0]-x) / 170;
        if (!foreground && z < 4500 && Math.abs(x-ctx.W/2) < ctx.W*.34+size*90) continue;
        if (x < -size*300 || x > ctx.W+size*300 || y-size*180 > ctx.H || y+size*40 < 0) continue;
        breadCloud(ctx, x, y, size, cloud.seed, foreground);
    }
    if (!foreground) for (const [x,y,seed] of [[.15,.15,9201],[.83,.1,9202]]) {
        breadCloud(ctx, ctx.W*x + Math.sin(travel*.0003)*8, ctx.H*y, ctx.W/2500, seed);
    }
    // A low continuous cloud floor leaves the city visible above its crests.
    if (!foreground) for (let i = 0; i < 5; i++) {
        breadCloud(ctx, ctx.W * (i / 4), ctx.H * (.98+Math.sin(i*4)*.065), ctx.W/1000*(.8+(i%2)*.2), 700+i*2);
    }
    Object.assign(ctx, saved);
}

export function doorGlow(ctx: RenderCtx, view: SkyProjection, point: [number,number,number]) {
    if (view.depth(point) < 80) return;
    const [x,y] = view.project(point);
    const radius = Math.min(ctx.H * .42, 210000 / view.depth(point));
    ctx.commands.push({ v: [[x-radius,y-radius],[x+radius,y-radius],[x+radius,y+radius],[x-radius,y+radius]], c: {
        from: [x,y], to: [x+radius,y], radius, stops: [[0,ctx.rgba('#ffdda6',.8)],[1,ctx.rgba('#ffdda6',0)]],
    }, layer: { key: 'orbit-door-light', blend: 'screen' } });
}
