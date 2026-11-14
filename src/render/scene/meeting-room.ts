import { translate, type Message } from '../../i18n';
import { STAGE_TWO } from '../../game/stages/building/data';
import type { RenderCtx } from '../context';
import { bubble } from './building-bubble';
import { head, officeAppearance, worker } from './building-workers';
import { player } from './player';

const COMPLAINTS = ['building.chairStuck', 'building.chairMinutes', 'building.chairOvertime'] satisfies Message[];

export function meetingChairPose(time: number, index: number) {
    const phase = (time + index * 1.1) % 6;
    const sigh = phase > 1 && phase < 3 ? Math.sin((phase - 1) / 2 * Math.PI) : 0;
    return { sink: sigh * 3, lean: sigh * 4, sigh };
}

function occupiedChair(ctx: RenderCtx, x: number, floor: number, index: number) {
    const pose = meetingChairPose(ctx.t, index);
    const seat = floor - 48 + pose.sink;
    const look = officeAppearance(ctx.state.corridor.appearanceSeed, 4, index);
    ctx.ellipse(x, floor + 2, 30, 3, '#35465624');
    ctx.rod(x, seat + 5, x, floor - 12, 5, '#a5b1b7');
    ctx.rod(x - 23, floor - 8, x + 23, floor - 8, 4, '#81959d');
    for (const side of [-1, 1]) ctx.ellipse(x + side * 21, floor - 5, 5, 5, '#3f4650');
    ctx.polygon([[x-29,seat-46],[x-15,seat-44],[x-15-pose.lean,seat],[x-28-pose.lean,seat]], '#6f7687');
    ctx.rect(x - 23, seat, 48, 8, '#6f7687');
    ctx.polygon([[x-10,seat-1],[x+17,seat-1],[x+27,floor-12],[x+16,floor-12],[x+7,seat+11],[x-10,seat+9]], '#485467');
    ctx.polygon([[x+16,floor-15],[x+27,floor-15],[x+35,floor-5],[x+15,floor-5]], '#34404c');
    ctx.polygon([[x-10,seat-40],[x+6,seat-42],[x+16,seat-30],[x+11,seat],[x-12,seat]], look.shirt);
    ctx.rod(x - 1, seat - 46, x + 1, seat - 37, 9, look.skin);
    head(ctx, x, seat - 59, 1, look.hair, look.hairstyle, look.glasses, look.skin);
    ctx.rod(x + 8, seat - 33, x + 20, seat - 20, 8, look.sleeve);
    ctx.rod(x + 20, seat - 20, x + 36, seat - 27, 5, look.skin);
    ctx.ellipse(x + 36, seat - 27, 4, 2, look.skin);
    if (pose.sigh > .15) {
        const alpha = pose.sigh * .55;
        ctx.strokePath([x - 37, seat - 27], [[x-49,seat-29,x-39,seat-37,x-49,seat-40]],
            { width: 2, color: ctx.tint('#e2e8df', alpha) });
    }
}

export function meetingDoor(ctx: RenderCtx) {
    const x = STAGE_TWO.meeting;
    ctx.rect(x - 78, 180, 156, 240, '#687f80');
    ctx.rect(x - 70, 187, 140, 232, '#91a29b');
    occupiedChair(ctx, x + 14, 420, 0);
    ctx.rect(x - 68, 190, 37, 225, '#d8d6bf');
    ctx.rod(x - 40, 294, x - 40, 319, 3, '#687f80');
    ctx.rect(x - 70, 147, 140, 25, '#e1d7bb');
    ctx.label(translate('building.meetingExtended', ctx.locale), x, 164, 13, '#4f6268');
    if (ctx.state.canEnterMeeting) {
        ctx.rect(x - 57, 216, 114, 32, '#263a45e8');
        ctx.label(translate('interact.enter', ctx.locale), x, 238, 16, '#f6eddc');
    }
    const phase = ctx.t % 6;
    if (Math.abs(ctx.p.x - x) < 220 && phase > 1 && phase < 3) {
        bubble(ctx, 'building.chairCreak', x + 12, 275, 145, false, .65);
    }
}

function meetingBoard(ctx: RenderCtx, x: number) {
    ctx.rect(ctx.cam, 60, ctx.VW, 360, '#c3c8bd');
    ctx.rect(x - 220, 100, 470, 145, '#617975');
    ctx.rect(x - 208, 112, 446, 121, '#f0ecd9');
    ctx.label(translate('building.meetingPrompt', ctx.locale), x + 15, 148, 16, '#48605d');
    for (let i = 0; i < 3; i++) ctx.rod(x - 180, 177 + i * 16, x + 65 - i * 32, 177 + i * 16, 3, '#9ba9a0');
    // The end of the meeting moves forward while the agenda stays exactly the same.
    const extensions = Math.floor(ctx.state.corridor.room.kind === 'meeting' ? ctx.state.corridor.room.age / 2 : 0);
    ctx.label(`18:${String(30 + extensions * 5).padStart(2, '0')}`, x + 170, 208, 19, '#a76e56');
}

function meetingSpeech(ctx: RenderCtx, age: number) {
    if (age < 1.2 || age >= 4.6) {
        const line = age < 1.2 ? 'building.meetingFiveMore' : 'building.meetingLoanReturn';
        bubble(ctx, line, STAGE_TWO.meeting - 5, 78, 360, false, .85);
    } else {
        const index = Math.min(2, Math.floor((age - 1.2) / 1.1));
        bubble(ctx, COMPLAINTS[index], STAGE_TWO.meeting + 65 + index * 30, 265, 290, false, .75);
    }
}

export function meetingRoom(ctx: RenderCtx) {
    const scene = ctx.state.corridor.room;
    if (scene.kind !== 'meeting') return;
    const x = STAGE_TWO.meeting;
    meetingBoard(ctx, x);
    for (let i = 0; i < 3; i++) occupiedChair(ctx, x + 30 + i * 90, 420, i);
    ctx.rect(x + 1, 342, 270, 12, '#ab9274');
    ctx.rod(x + 13, 354, x + 13, 420, 8, '#657b7b');
    ctx.rod(x + 255, 354, x + 255, 420, 8, '#657b7b');
    for (let i = 0; i < 3; i++) {
        ctx.rect(x + 38 + i * 90, 338, 26, 4, '#f0ecd9');
        ctx.ellipse(x + 72 + i * 90, 336, 5, 6, '#e2e8df');
    }
    const pushing = Math.max(0, scene.age - 4.6) * 100;
    worker(ctx, x - 156 + pushing, 420, 'facilitator', 1,
        scene.age > 4.6 ? [ctx.p.x - 31, ctx.p.y - 61] : undefined);
    meetingSpeech(ctx, scene.age);
    player(ctx);
}
