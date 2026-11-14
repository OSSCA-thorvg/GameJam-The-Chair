import { translate } from '../../i18n';
import { STAGE_TWO } from '../../game/stages/building/data';
import type { RenderCtx } from '../context';
import { worker } from './building-workers';
import { bubble } from './building-bubble';

export function dispatchRoom(ctx: RenderCtx) {
    const c = ctx.state.corridor;
    const mx = STAGE_TWO.dispatch.room;
    ctx.rect(mx - 78, 180, 156, 240, '#687f80');
    ctx.rect(mx - 70, 187, 140, 232, '#91a29b');
    const opening = Math.min(1, c.dispatchAge / .5);
    ctx.rect(mx - 64 + opening * 112, 190, 126 * (1 - opening), 225, '#d8d6bf');
    ctx.rect(mx - 70, 147, 140, 25, '#e1d7bb');
    ctx.label(translate('building.meetingExtended', ctx.locale), mx, 164, 13, '#4f6268');
    const pushPhase = c.dispatchStarted && c.dispatchAge < 3.5 ? Math.sin(Math.max(0, c.dispatchAge - .35) * Math.PI / .9) ** 2 : 0;
    worker(ctx, mx - 57 + pushPhase * 10, 420, 'facilitator', 1,
        pushPhase > 0 ? [mx - 18 + pushPhase * 9, 344 - pushPhase * 11] : undefined);
    if (c.dispatchStarted && c.dispatchAge < 1.5) bubble(ctx, 'building.dispatchNotice', mx + 40, 103, 310);
}
