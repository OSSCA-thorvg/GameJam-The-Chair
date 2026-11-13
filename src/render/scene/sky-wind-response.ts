import { skyGust } from '../../game/stages/sky/data';
import { ART } from '../art';
import type { RenderCtx } from '../context';
import type { Vector } from '../types';

// Presentation only: use the same clock as the headwind without changing contacts or steering.
export function skyWindResponse(ctx: Pick<RenderCtx, 'state' | 't'>) {
    if (ctx.state.stage !== 4 || ctx.state.sky.phase !== 'course' || ctx.state.mode !== 'play') {
        return { chairTilt: 0, plumeDrift: 0 };
    }
    const { warn, strength } = skyGust(ctx.t);
    const onset = Math.max(0, strength - skyGust(ctx.t - .08).strength);
    const tremble = warn * (1 - strength) * Math.sin(ctx.t * 16) * .008;
    const chairTilt = (tremble - strength * .06 - onset * .05) * (ctx.state.ground ? .22 : 1);
    return { chairTilt, plumeDrift: -8 - warn * 10 - strength * 70 };
}

export function sprayOrigin(ctx: RenderCtx): Vector {
    const wind = skyWindResponse(ctx);
    if (wind.plumeDrift === 0) return [ctx.p.x - 45, ctx.p.y - 15];
    const angle = ctx.p.a + wind.chairTilt;
    const x = -45 * ART.player.scale, y = -15 * ART.player.scale;
    return [ctx.p.x + ART.player.offsetX + x * Math.cos(angle) - y * Math.sin(angle),
        ctx.p.y + ART.player.offsetY + x * Math.sin(angle) + y * Math.cos(angle)];
}
