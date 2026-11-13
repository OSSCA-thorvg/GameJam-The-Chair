import type { RenderCtx } from '../context';
import type { Point3 } from './sky-projection';
import { createSkyProjection } from './sky-projection';
import { endingChair } from './sky-ending-art';
import { SKY_TURN } from './sky-camera';
import { orbitSky, orbitCloudBank } from './orbit-atmosphere';
import { orbitBeacon, orbitCloudGlints, orbitWatchers, orbitWatchGlow } from './orbit-watch';
import { ATTENDANCE, attendanceBubble } from './attendance-bubble';
import { orbitPraise, orbitPraiseOnChair } from './orbit-praise';
import { inOpacity, orbitEarth, orbitHeights, orbitHighSky, orbitShadow } from './orbit-heights';
import { STAGE_FIVE as C } from '../../game/stages/orbit/data';

export function drawOrbit(ctx: RenderCtx) {
    ctx.commands = [];
    const { orbit, player: p } = ctx.state;
    if (!orbit) return;
    const heights = orbitHeights(orbit.z), clouds = 1 - heights.air;
    orbitSky(ctx);
    orbitHighSky(ctx, heights);
    orbitEarth(ctx, heights);
    const enter = Math.min(1, orbit.age / C.entryTime);
    const blend = enter * enter * (3 - 2 * enter);
    const view = createSkyProjection(ctx.W, ctx.H, 1, { centerY: .37, level: true });
    const point = (x: number, y: number, z: number): Point3 => [z-orbit.z, 15+y-p.y*.65, x-p.x*.7];
    inOpacity(ctx, { key: 'orbit-low-clouds', opacity: clouds }, () => orbitCloudBank(ctx, view, orbit.z, false));
    orbitCloudGlints(ctx, clouds);
    orbitBeacon(ctx, view, point);
    const lamps = orbitWatchers(view, point, orbit.z, ctx.t, 'route');
    ctx.commands.push(...view.commands());
    orbitWatchGlow(ctx, view, lamps);
    orbitPraise(ctx, view, point, orbit.age, orbit.z);
    inOpacity(ctx, { key: 'orbit-near-clouds', opacity: clouds }, () => orbitCloudBank(ctx, view, orbit.z, true));
    orbitShadow(ctx, heights);
    const chair = createSkyProjection(ctx.W, ctx.H, SKY_TURN.rear, {
        zoom: 1 - blend*.3, centerY: .5 + blend*.2 - p.y/C.bounds.y*.12,
        offsetX: p.x/C.bounds.x*ctx.W*.18, roll: p.a,
    });
    endingChair(chair, ctx.t+10, orbit.phase === 'parked' ? .2 : Math.max(.3,orbit.speed/C.cruise));
    ctx.commands.push(...chair.commands());
    orbitPraiseOnChair(ctx, chair.project([0, 0, 0]), orbit.age, p, orbit.z);
    const head = chair.project([4, 70, 0]);
    // The bubble from the end of stage four stays up for the first moments of stage five;
    // deep in the Earth's shadow the laptop finally loses its connection.
    if (orbit.phase === 'parked') attendanceBubble(ctx, head, 1, 'orbit.disconnected');
    else attendanceBubble(ctx, head, orbit.age + ATTENDANCE.lead);
}
