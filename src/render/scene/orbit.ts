import type { RenderCtx } from '../context';
import type { Point3 } from './sky-projection';
import { createSkyProjection } from './sky-projection';
import { endingChair } from './sky-ending-art';
import { SKY_TURN } from './sky-camera';
import { orbitDoor, orbitHoop } from './orbit-art';
import { orbitSky, orbitCloudBank, doorGlow } from './orbit-atmosphere';
import { STAGE_FIVE as C } from '../../game/stages/orbit/data';

export function drawOrbit(ctx: RenderCtx) {
    ctx.commands = [];
    const { orbit, player: p } = ctx.state;
    if (!orbit) return;
    orbitSky(ctx);
    const enter = Math.min(1, orbit.age / C.entryTime);
    const blend = enter * enter * (3 - 2 * enter);
    const view = createSkyProjection(ctx.W, ctx.H, 1, { centerY: .37, level: true });
    const point = (x: number, y: number, z: number): Point3 => [z-orbit.z, 15+y-p.y*.65, x-p.x*.7];
    orbitCloudBank(ctx, view, orbit.z, false);
    doorGlow(ctx, view, point(C.door.x, C.door.y+60, C.door.z));
    orbitDoor(view, point(C.door.x, C.door.y, C.door.z));
    ctx.commands.push(...view.commands());
    for (let i = C.rings.length-1; i >= 0; i--) {
        const ring = C.rings[i];
        orbitHoop(ctx, view, point(ring.x,ring.y,ring.z), ring.radius, i < orbit.rings);
    }
    orbitCloudBank(ctx, view, orbit.z, true);
    const chair = createSkyProjection(ctx.W, ctx.H, SKY_TURN.orbit, {
        zoom: 1 - blend*.3, centerY: .5 + blend*.2 - p.y/C.bounds.y*.12,
        offsetX: p.x/C.bounds.x*ctx.W*.18, roll: p.a,
    });
    endingChair(chair, ctx.t+10, orbit.phase === 'parked' ? .2 : Math.max(.3,orbit.speed/C.cruise));
    ctx.commands.push(...chair.commands());
}
