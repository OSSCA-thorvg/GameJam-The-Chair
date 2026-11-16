import { stageCamera } from '../presentation/stages';
import type { RenderCtx } from './context';

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 510;

export function gameplayCamera(ctx: RenderCtx, lastTime: number, lastStage: number, camera?: number) {
    const next = ctx.state;
    const t = ctx.t;
    const policy = stageCamera(next);
    const baseWidth = VIEW_WIDTH;
    ctx.VW = baseWidth * policy.width;
    ctx.scale = ctx.W / ctx.VW;
    const dt = Math.max(0, t - lastTime);
    const lead = policy.lead;
    if (t < lastTime || next.stage !== lastStage) {
        ctx.cam = ctx.clamp(ctx.player.x - ctx.VW * lead, 0, Math.max(0, ctx.LEN - ctx.VW));
        ctx.wheel = 0;
    }
    if (camera !== undefined) {
        ctx.cam = ctx.clamp(camera, 0, Math.max(0, ctx.LEN - ctx.VW));
    } else if (ctx.mode === 'play' || (policy.followWhenWon && ctx.mode === 'won')) {
        const focusX = ctx.player.x - ctx.VW * lead;
        const targetCamera = ctx.clamp(focusX, 0, Math.max(0, ctx.LEN - ctx.VW));
        ctx.cam += (targetCamera - ctx.cam) * Math.min(1, dt * 7);
        ctx.wheel += ctx.player.vx * dt / 8;
    }
    const baseVertical = Math.max(0, ctx.H / ctx.scale - VIEW_HEIGHT) * .7;
    ctx.vertical = policy.followVertical ? baseVertical + Math.max(0, policy.focusY - ctx.player.y) : baseVertical;
    return baseVertical;
}
