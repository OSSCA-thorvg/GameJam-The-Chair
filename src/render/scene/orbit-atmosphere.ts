import type { RenderCtx } from '../context';
import type { SkyProjection } from './sky-projection';
import { CLOUD_TONES, puffCloud, seeded } from './cloud-art';

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

/** `turn`: how far round the camera faces (radians), sliding the far city sideways; one full turn wraps it six times. */
export function orbitSky(ctx: RenderCtx, anchor: BasinAnchor = ctx.state.player, turn = 0) {
    ctx.commands.push({ v: [[0,0],[ctx.W,0],[ctx.W,ctx.H],[0,ctx.H]], c: {
        from: [0,0], to: [0,ctx.H], stops: [[0,ctx.rgba('#7499b9')],[.55,ctx.rgba('#a7bdd0')],[1,ctx.rgba('#efd0bc')]],
    } });
    const horizon = ctx.H * .6;
    const offset = (anchor.x / 680) * ctx.W * .025 + turn / (Math.PI * 2) * ctx.W * 6;
    for (const building of CITY) {
        const x = ((building.x * ctx.W - offset) % ctx.W + ctx.W) % ctx.W;
        const w = building.w * ctx.W, h = building.h * ctx.H;
        ctx.commands.push({ v: [[x,horizon],[x,horizon-h],[x+w,horizon-h],[x+w,horizon]], c: '#7d9fbb48' });
    }
    for (let i = 0; i < 18; i++) {
        const y = horizon + 10 + i * 5, spread = i * i * .48;
        ctx.commands.push({ v: [[ctx.W*.5-spread,y],[ctx.W*.5+spread,y],[ctx.W*.5+spread+15,y+1],[ctx.W*.5-spread-15,y+1]], c: '#d6dfdf40' });
    }
}

export type CloudBankOptions = {
    anchor?: BasinAnchor;
    /**
     * Draw only these cloud seeds. They skip stage five's clear-centre rule, because the caller already chose
     * them as the clouds that stay on screen; the stage-four ending passes the clouds of stage five's first frame.
     */
    only?: ReadonlySet<number>;
    /** Clouds nearer the camera than this are skipped and fade in beyond it; the ending camera passes close to some. */
    nearDepth?: number;
    /**
     * Place each cloud by its stage five start position minus `travel`, without wrapping round the loop, so clouds
     * gliding in before stage five (negative travel) stay continuous with its first frame.
     */
    unwrapped?: boolean;
    /** Which way the camera faces (radians, 0 along the route): the cloud field turns round the chair by it. */
    turn?: number;
    /**
     * Fades the whole bank. Folded into every cloud's own alpha rather than a layer opacity, which would cost a
     * full-canvas offscreen pass; the clouds are translucent anyway, so their overlaps read the same.
     */
    alpha?: number;
};

/** Route distance ahead of the chair over which a cloud fades out as the chair flies into it. */
const PASS_FADE = 260;

type PlacedCloud = { seed: number; x: number; y: number; size: number; opacity: number };

function placeClouds(ctx: RenderCtx, view: SkyProjection, travel: number, foreground: boolean, options: CloudBankOptions) {
    const anchor = options.anchor ?? ctx.state.player;
    const placed: PlacedCloud[] = [];
    for (const cloud of CLOUDS) {
        if (options.only && !options.only.has(cloud.seed)) continue;
        const z = options.unwrapped ? ((cloud.z + 12000) % 10000) - 500 - travel : ((cloud.z - travel + 12000) % 10000) - 500;
        // Nothing the chair has passed is drawn: a cloud thins out as the chair reaches it.
        const across = cloud.x - anchor.x * .55, turn = options.turn ?? 0;
        const ahead = z * Math.cos(turn) + across * Math.sin(turn);
        if (ahead <= 0 || (ahead < 900) !== foreground) continue;
        const center: [number,number,number] = [ahead, cloud.y - anchor.y * .45, across * Math.cos(turn) - z * Math.sin(turn)];
        const depth = view.depth(center);
        if (depth < (options.nearDepth ?? 200)) continue;
        const [x,y] = view.project(center);
        const edge = view.project([z,center[1],center[2]+cloud.radius]);
        const size = Math.abs(edge[0]-x) / 170;
        if (!options.only && !foreground && z < 4500 && Math.abs(x-ctx.W/2) < ctx.W*.34+size*90) continue;
        if (x < -size*300 || x > ctx.W+size*300 || y-size*180 > ctx.H || y+size*40 < 0) continue;
        // With a custom cutoff, clouds swinging in past the camera fade in rather than popping at it.
        const reach = ctx.clamp(ahead / PASS_FADE, 0, 1);
        const opacity = reach * (options.nearDepth === undefined ? 1 : ctx.clamp((depth - options.nearDepth) / 600, 0, 1));
        placed.push({ seed: cloud.seed, x, y, size, opacity });
    }
    return placed;
}

/** Seeds of the basin clouds this view shows, by stage five's own rules. */
export function basinCloudSeeds(ctx: RenderCtx, view: SkyProjection, travel: number, anchor: BasinAnchor) {
    return new Set([false, true].flatMap(foreground =>
        placeClouds(ctx, view, travel, foreground, { anchor }).map(cloud => cloud.seed)));
}

export function orbitCloudBank(ctx: RenderCtx, view: SkyProjection, travel: number, foreground: boolean, options: CloudBankOptions = {}) {
    const placed = placeClouds(ctx, view, travel, foreground, options);
    const saved = { scale: ctx.scale, cam: ctx.cam, vertical: ctx.vertical, ox: ctx.ox, oy: ctx.oy,
        rotation: ctx.rotation, localScale: ctx.localScale, mirror: ctx.mirror };
    Object.assign(ctx, { scale: 1, cam: 0, vertical: 0, ox: 0, oy: 0, rotation: 0, localScale: 1, mirror: null });
    const fade = options.alpha ?? 1;
    const bread = (x: number, y: number, size: number, seed: number, near: boolean, opacity = 1) =>
        puffCloud(ctx, x, y, size, seed, CLOUD_TONES.bread, { alpha: (near ? .95 : .72) * opacity * fade, fade: true });
    for (const { seed, x, y, size, opacity } of placed) bread(x, y, size, seed, foreground, opacity);
    if (!foreground) for (const [x,y,seed] of [[.15,.15,9201],[.83,.1,9202]]) {
        bread(ctx.W*x + Math.sin(travel*.0003)*8, ctx.H*y, ctx.W/2500, seed, false);
    }
    // A low continuous cloud floor leaves the city visible above its crests. It carries over from stage four.
    if (!foreground) for (let i = 0; i < 5; i++) {
        bread(ctx.W * (i / 4), ctx.H * (.98+Math.sin(i*4)*.065), ctx.W/1000*(.8+(i%2)*.2), 700+i*2, false);
    }
    Object.assign(ctx, saved);
}
