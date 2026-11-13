import type { RenderCtx } from '../context';
import type { Point3 } from './sky-projection';
import { createSkyProjection } from './sky-projection';
import { endingChair } from './sky-ending-art';
import { SKY_TURN } from './sky-camera';
import { orbitDoor } from './orbit-art';
import { orbitSky, orbitCloudBank, doorGlow } from './orbit-atmosphere';
import { orbitBeacon, orbitCloudGlints, orbitWatchers, orbitWatchGlow } from './orbit-watch';
import { ATTENDANCE, attendanceBubble } from './attendance-bubble';
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
    orbitCloudGlints(ctx);
    doorGlow(ctx, view, point(C.door.x, C.door.y+60, C.door.z));
    orbitBeacon(ctx, view, point);
    orbitDoor(view, point(C.door.x, C.door.y, C.door.z));
    const lamps = orbitWatchers(view, point, orbit.z, ctx.t, 'route');
    ctx.commands.push(...view.commands());
    orbitWatchGlow(ctx, view, lamps);
    orbitCloudBank(ctx, view, orbit.z, true);
    const chair = createSkyProjection(ctx.W, ctx.H, SKY_TURN.rear, {
        zoom: 1 - blend*.3, centerY: .5 + blend*.2 - p.y/C.bounds.y*.12,
        offsetX: p.x/C.bounds.x*ctx.W*.18, roll: p.a,
    });
    endingChair(chair, ctx.t+10, orbit.phase === 'parked' ? .2 : Math.max(.3,orbit.speed/C.cruise));
    ctx.commands.push(...chair.commands());
    // The bubble from the end of stage four stays up for the first moments of stage five.
    attendanceBubble(ctx, chair.project([4, 70, 0]), orbit.age + ATTENDANCE.lead);
}
