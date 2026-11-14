import { STAGE_TWO, type Corridor } from '../../game/stages/building/data';
import type { RenderCtx } from '../context';

export function entryDoorOpening(room: Readonly<Corridor['room']>) {
    return room.kind === 'entering' ? Math.min(1, room.age / (STAGE_TWO.meetingEntry * .65)) : 0;
}

export function dispatchDoorOpening(age: number, started: boolean, clear: boolean) {
    if (!started) return 0;
    const opening = Math.min(1, age / .5);
    return clear ? Math.min(opening, Math.max(0, 1 - (age - 3.4) / .5)) : opening;
}

export function doorPanel(ctx: RenderCtx, x: number, opening: number) {
    if (opening >= 1) return;
    const width = 140 * (1 - opening);
    const left = x - 70 + opening * 140;
    ctx.rect(left, 187, width, 232, '#d8d6bf');
    if (width > 20) ctx.rod(left + width - 15, 294, left + width - 15, 319, 3, '#687f80');
}
