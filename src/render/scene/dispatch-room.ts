import { translate } from '../../i18n';
import { STAGE_TWO } from '../../game/stages/building/data';
import type { RenderCtx } from '../context';
import { worker } from './building-workers';
import { bubble } from './building-bubble';
import { dispatchDoorOpening, doorPanel } from './meeting-doors';

export function dispatchRoom(ctx: RenderCtx) {
    const c = ctx.state.corridor;
    const mx = STAGE_TWO.dispatch.room;
    ctx.rect(mx - 78, 180, 156, 240, '#687f80');
    ctx.rect(mx - 70, 187, 140, 232, '#91a29b');
    const clear = ctx.state.furniture.every(chair => chair.released && chair.x - chair.width / 2 > mx + 78);
    const opening = dispatchDoorOpening(c.dispatchAge, c.dispatchStarted, clear);
    ctx.rect(mx - 70, 147, 140, 25, '#e1d7bb');
    ctx.label(translate('building.meetingSecond', ctx.locale), mx, 164, 13, '#4f6268');
    const pushPhase = c.dispatchStarted && c.dispatchAge < 3.5 ? Math.sin(Math.max(0, c.dispatchAge - .35) * Math.PI / .9) ** 2 : 0;
    if (opening > 0) worker(ctx, mx - 40 + pushPhase * 10, 420, 'facilitator', 1,
        pushPhase > 0 ? [mx - 18 + pushPhase * 9, 344 - pushPhase * 11] : undefined);
    doorPanel(ctx, mx, opening);
    if (c.dispatchStarted && c.dispatchAge < 1.5) bubble(ctx, 'building.dispatchNotice', mx + 40, 103, 310);
}
