import type { RenderCtx } from './context';

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 510;

export function gameplayCamera(ctx: RenderCtx, lastTime: number, lastStage: number, camera?: number) {
    const next = ctx.state;
    const t = ctx.t;
    const baseWidth = VIEW_WIDTH;
    ctx.VW = next.stage === 4 ? baseWidth * 1.12 : baseWidth;
    ctx.scale = ctx.W / ctx.VW;
    const dt = Math.max(0, t - lastTime);
    // Riding the sales graph and the climb that follows keep the chair centred, so the view moves right
    // with it and the rise into the sky stage reads as straight up.
    const centred = (next.stage === 3 && next.firstFlight.kind !== 'course') || (next.stage === 4 && next.sky.phase === 'arrival');
    const lead = centred ? .5 : .35;
    if (t < lastTime || next.stage !== lastStage) {
        ctx.cam = ctx.clamp(ctx.p.x - ctx.VW * lead, 0, Math.max(0, ctx.LEN - ctx.VW));
        ctx.wheel = 0;
    }
    if (camera !== undefined) {
        ctx.cam = ctx.clamp(camera, 0, Math.max(0, ctx.LEN - ctx.VW));
    } else if (ctx.mode === 'play' || (next.stage === 4 && ctx.mode === 'won')) {
        const focusX = ctx.p.x - ctx.VW * lead;
        const targetCamera = ctx.clamp(focusX, 0, Math.max(0, ctx.LEN - ctx.VW));
        ctx.cam += (targetCamera - ctx.cam) * Math.min(1, dt * 7);
        ctx.wheel += ctx.p.vx * dt / 8;
    }
    const baseVertical = Math.max(0, ctx.H / ctx.scale - VIEW_HEIGHT) * .7;
    // Nearing the sales-graph billboard the view tilts up to show the whole sign; riding it eases the
    // chair to the sky stage's framing, which the climb keeps.
    const flight = next.firstFlight;
    const signLook = next.stage === 3 ? 330 + 110 * ctx.clamp((ctx.p.x - 2050) / 300, 0, 1) : 330;
    const focusY = next.stage === 4 || flight.kind === 'flight' ? 265
        : flight.kind === 'ride' ? 440 - 175 * Math.min(1, flight.age / 1.2) : signLook;
    ctx.vertical = next.stage >= 3 ? baseVertical + Math.max(0, focusY - ctx.p.y) : baseVertical;
    return baseVertical;
}
