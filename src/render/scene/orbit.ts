import type { RenderCtx } from '../context';
import type { Point3 } from './sky-projection';
import { createSkyProjection } from './sky-projection';
import { endingChair } from './sky-ending-art';
import { orbitDrawer, orbitHoop } from './orbit-art';
import { STAGE_FIVE as C } from '../../game/stages/orbit/data';
import { translate } from '../../i18n';

export function drawOrbit(ctx: RenderCtx) {
    const { orbit, player: p } = ctx.state;
    if (!orbit) return;
    ctx.commands.push({ v: [[0,0],[ctx.W,0],[ctx.W,ctx.H],[0,ctx.H]], c: {
        from: [0,0], to: [0,ctx.H], stops: [[0,ctx.rgba('#678eae')],[.62,ctx.rgba('#b7ced1')],[1,ctx.rgba('#e9d7c4')]],
    } });
    const enter = Math.min(1, orbit.age / C.entryTime);
    const blend = enter * enter * (3 - 2 * enter);
    const view = createSkyProjection(ctx.W, ctx.H, 1, { centerY: .48 });
    const point = (x: number, y: number, z: number): Point3 => [z - orbit.z, 15 + y - p.y * .7, x - p.x * .7];
    orbitClouds(view, point, orbit.z);
    for (let i = 0; i < C.rings.length; i++) {
        const ring = C.rings[i];
        if (ring.z - orbit.z > -420) orbitHoop(view, point(ring.x, ring.y, ring.z), ring.radius, i < orbit.rings, ctx.t);
    }
    orbitDrawer(view, point(C.drawer.x, C.drawer.y, C.drawer.z), orbit.phase === 'parked', ctx.t);
    ctx.commands.push(...view.commands());
    const chair = createSkyProjection(ctx.W, ctx.H, 1, {
        zoom: 1 - blend * .16, centerY: .5 + blend * .2 - p.y / C.bounds.y * .14,
        offsetX: p.x / C.bounds.x * ctx.W * .18, roll: p.a,
    });
    endingChair(chair, ctx.t + 10, orbit.phase === 'parked' ? 0 : Math.max(.2, orbit.speed / C.cruise));
    ctx.commands.push(...chair.commands());
    orbitHint(ctx);
}

function orbitClouds(view: ReturnType<typeof createSkyProjection>, point: (x: number, y: number, z: number) => Point3, travel: number) {
    for (let i = 0; i < 24; i++) {
        const z = i * 330 - 700;
        const side = i % 2 === 0 ? -1 : 1;
        const x = side * (610 + (i % 5) * 145);
        const y = -260 + (i % 4) * 165;
        const r = 180 + i % 3 * 65;
        if (z - travel < -400) continue;
        view.oval(point(x, y, z), [r * .6, r * .24, r], '#f6e6dfb8');
        view.oval(point(x + side * r * .24, y + r * .1, z), [r * .4, r * .25, r * .5], '#f8e9dfba');
    }
}

function orbitHint(ctx: RenderCtx) {
    const { orbit } = ctx.state;
    if (!orbit || orbit.phase === 'entry') return;
    const parked = orbit.phase === 'parked';
    const hint = parked ? translate('orbit.parked', ctx.locale) : orbit.phase === 'drawer'
        ? translate('orbit.brake', ctx.locale) : '↑ ↓ ← → / WASD     ·     Space';
    ctx.lg.save();
    ctx.lg.font = '500 13px system-ui';
    ctx.lg.textAlign = 'center';
    ctx.lg.fillStyle = '#354f60';
    ctx.lg.fillText(hint, ctx.W / 2, 32);
    ctx.lg.restore();
    if (parked) {
        ctx.commands.push({ v: [[ctx.W * .5 - 18,ctx.H * .22],[ctx.W * .5 - 3,ctx.H * .22 + 15],[ctx.W * .5 + 25,ctx.H * .22 - 17]],
            c: null, open: true, stroke: { width: 4, color: '#b6f0c7', cap: 'round' }, trim: [0, Math.min(1, orbit.settled)] });
    }
}
