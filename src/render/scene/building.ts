import { ceilingCctvs } from './ceiling-cctv';
import type { Message } from '../../i18n';
import { STAGE_TWO, TYPING_SOUNDS, CHAIR_CHAT_INTERVAL, CHAIR_DEPARTURE, CHAIR_DEPARTURE_LINES, chairChatLine } from '../../game/stages/building/data';
import type { RenderCtx } from '../context';
import type { Vector } from '../types';
import { chairLift, expressFloor } from './express';
import { practiceFloor, checkpointFlag } from './decor';
import { player } from './player';
import { bubble } from './building-bubble';
import { officeAppearance, typingWorker } from './building-workers';
import { meetingDoor, meetingRoom } from './meeting-room';
import { dispatchRoom } from './dispatch-room';

// Typing bubbles stay in the band above the chair chatter (y >= 193) so the two never overlap.
const OFFICE_BUBBLE_TOP = 70;
function chair(ctx: RenderCtx, x: number, y: number) {
    const shadowStart = ctx.commands.length;
    ctx.ellipse(x, y + 3, 37, 5, '#35465622');
    ctx.rod(x - 18, y - 37, x - 22, y - 90, 6, '#515665');
    ctx.rect(x - 30, y - 90, 18, 48, '#6f7687');
    ctx.rect(x - 24, y - 40, 48, 8, '#6f7687');
    ctx.rod(x, y - 32, x, y - 10, 5, '#a5b1b7');
    ctx.rod(x - 22, y - 8, x + 22, y - 8, 4, '#81959d');
    for (const side of [-1, 1]) {
        ctx.ellipse(x + side * 17, y - 5, 5, 5, '#3f4650');
        ctx.rod(x + side * 17, y - 5, x + side * 17 + Math.cos(ctx.t * 9) * 3, y - 5 + Math.sin(ctx.t * 9) * 3, 1, '#b6c5c7');
    }
    if (ctx.state.corridor.departure.kind === 'descending') cabinActors(ctx, shadowStart);
}
function cabinActors(ctx: RenderCtx, start: number) {
    const departure = ctx.state.corridor.departure;
    if (departure.kind !== 'descending') return;
    const age = departure.age;
    const aperture = 1 - ctx.clamp((age - 1.3) / .7, 0, 1);
    const [left, top] = ctx.screenPoint(STAGE_TWO.lift - 1 - aperture * 99, 190);
    const [right, bottom] = ctx.screenPoint(STAGE_TWO.lift + aperture * 99, 420);
    const visible = ctx.commands.splice(start).flatMap(command => {
        let points = command.v;
        for (const [axis, edge, direction] of [[0, left, 1], [0, right, -1], [1, top, 1], [1, bottom, -1]] satisfies [0 | 1, number, number][]) {
            const clipped: Vector[] = [];
            for (let i = 0; i < points.length; i++) {
                const a = points[i], b = points[(i + 1) % points.length];
                const insideA = (a[axis] - edge) * direction >= 0;
                const insideB = (b[axis] - edge) * direction >= 0;
                if (insideA) clipped.push(a);
                if (insideA !== insideB) {
                    const t = (edge - a[axis]) / (b[axis] - a[axis]);
                    clipped.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
                }
            }
            points = clipped;
        }
        if (points.length < 3 || aperture === 0) return [];
        return [{ ...command, v: points }];
    });
    ctx.commands.push(...visible);
}

function liftDoors(ctx: RenderCtx, x: number, aperture: number) {
    for (const side of [-1, 1]) {
        const left = side < 0 ? x - 100 : x + aperture * 99;
        ctx.gradientPolygon([[left, 190], [left + (1 - aperture) * 99, 190], [left + (1 - aperture) * 99, 419], [left, 419]],
            ctx.gradientFill(left, 0, left + 99, 0, [[0, '#9eb1b2'], [.5, '#c2ceca'], [1, '#879da3']]));
    }
}
function pictogram(ctx: RenderCtx, x: number, kind: 'exit' | 'lift') {
    ctx.rect(x - 36, 120, 72, 43, '#557f78');
    ctx.rect(x - 23, 127, 19, 29, '#d5e6da');
    ctx.rect(x - 19, 132, 11, 24, '#557f78');
    ctx.rect(x - 18, 134, 3, 11, '#e2eee0');
    ctx.rect(x - 18, 143, 10, 3, '#e2eee0');
    ctx.rod(x - 13, 146, x - 13, 150, 2, '#e2eee0');
    ctx.rod(x - 17, 150, x - 9, 150, 2, '#e2eee0');
    ctx.ellipse(x - 16, 153, 1.5, 1.5, '#e2eee0');
    ctx.ellipse(x - 10, 153, 1.5, 1.5, '#e2eee0');
    if (kind === 'exit') {
        ctx.rod(x + 3, 141, x + 26, 141, 4, '#e2eee0');
        ctx.polygon([[x + 18, 132], [x + 29, 141], [x + 18, 150]], '#e2eee0');
    } else {
        ctx.polygon([[x + 5, 137], [x + 13, 127], [x + 21, 137]], '#e2eee0');
        ctx.polygon([[x + 5, 146], [x + 13, 156], [x + 21, 146]], '#e2eee0');
    }
}
function buildingBackdrop(ctx: RenderCtx) {
    const { cam, VW } = ctx;
    ctx.commands = [];
    ctx.ox = ctx.oy = ctx.rotation = 0;
    ctx.localScale = 1;
    ctx.gradientPolygon([[cam, -ctx.vertical], [cam + VW, -ctx.vertical], [cam + VW, 420], [cam, 420]],
        ctx.gradientFill(cam, 0, cam, 420, [[0, '#a3b3b8'], [.55, '#d2d7ce'], [1, '#b1bfbc']]));
    ctx.rect(cam, -ctx.vertical, VW, 57 + ctx.vertical, '#586e79');
    for (let x = Math.floor(cam / 240) * 240; x < cam + VW + 240; x += 240) {
        ctx.rect(x + 30, 29, 150, 7, '#f7efd6');
        ctx.gradientPolygon([[x + 30, 37], [x + 180, 37], [x + 240, 420], [x - 30, 420]],
            ctx.gradientFill(x, 37, x, 420, [[0, '#ffefc9'], [1, '#ffefc9']], .09));
        ctx.rod(x, 60, x, 420, 1, '#91a4a7');
    }
    ceilingCctvs(ctx, 960);
    ctx.rect(cam, 420, VW, ctx.H / ctx.scale, '#929f9d');
    ctx.rod(cam, 422, cam + VW, 422, 4, '#586f75');
    for (let x = Math.floor(cam / 120) * 120; x < cam + VW; x += 120) ctx.rod(x, 428, x + 100, 520, 1, '#a7b2aa');
}

function officeWindows(ctx: RenderCtx) {
    const c = ctx.state.corridor;
    for (const [officeIndex, office] of c.offices.entries()) {
        const x = office.x;
        ctx.rect(x - 110, 174, 220, 181, '#617983');
        ctx.rect(x - 105, 180, 210, 170, '#839895');
        typingWorker(ctx, x - 65, 340, officeAppearance(c.appearanceSeed, officeIndex, 0));
        typingWorker(ctx, x + 32, 340, officeAppearance(c.appearanceSeed, officeIndex, 1));
        ctx.rect(x - 105, 180, 210, 170, '#6d8b9970');
        ctx.rod(x, 175, x, 355, 5, '#849a9e');
        ctx.polygon([[x - 98, 184], [x - 75, 184], [x + 55, 347], [x + 32, 347]], '#edf4e719');
        if ((c.departure.kind === 'none' || c.departure.kind === 'gone') && office.life > 0) bubble(ctx, TYPING_SOUNDS[office.phrase], x + office.offset.x, OFFICE_BUBBLE_TOP + office.offset.y * .55, 156, false, Math.min(.78, office.life * 2), false);
    }
}

function liftShaft(ctx: RenderCtx) {
    const c = ctx.state.corridor;
    const departure = c.departure;
    const lx = STAGE_TWO.lift;
    const drop = departure.kind === 'descending' ? Math.min(1, departure.age / CHAIR_DEPARTURE.descending) * 165 : 0;
    ctx.rect(lx - 115, 175, 230, 245, '#536b77');
    ctx.rect(lx - 105, 185, 210, 235, '#263b48');
    ctx.rect(lx - 100, 185 + drop, 200, 235 - drop, '#354d5b');
    if (departure.kind !== 'descending') liftDoors(ctx, lx, c.lift.kind === 'open' ? Math.min(1, c.lift.age * 3) : 0);
    pictogram(ctx, lx, 'lift');
    if (c.lift.kind === 'arriving') {
        ctx.ellipse(lx + 138, 277, 7, 7, Math.sin(ctx.t * 8) > 0 ? '#f2d191' : '#aa9475');
        ctx.polygon([[lx - 130, 437], [lx - 105, 428], [lx - 105, 446]], '#eed39a');
    }
}

function corridorExit(ctx: RenderCtx) {
    const { state } = ctx;
    for (let i = 1; i < STAGE_TWO.checkpoints.length; i++) {
        const mark = STAGE_TWO.checkpoints[i];
        checkpointFlag(ctx, mark.x, 420, state.checkpoint >= i);
    }
    ctx.rect(ctx.GOAL - 48, 190, 105, 230, '#587878');
    ctx.rect(ctx.GOAL - 40, 198, 89, 220, '#a6bcb1');
    ctx.rod(ctx.GOAL + 29, 299, ctx.GOAL + 29, 330, 4, '#5f797b');
    pictogram(ctx, ctx.GOAL, 'exit');
    practiceFloor(ctx);
}

function liftForeground(ctx: RenderCtx) {
    const departure = ctx.state.corridor.departure;
    const lx = STAGE_TWO.lift;
    if (departure.kind === 'descending') {
        ctx.rect(lx - 105, 420, 210, ctx.H / ctx.scale, '#929f9d');
        ctx.rod(lx - 105, 422, lx + 105, 422, 4, '#586f75');
        for (let x = Math.floor((lx - 205) / 120) * 120; x < lx + 105; x += 120) {
            const a = Math.max(x, lx - 105), b = Math.min(x + 100, lx + 105);
            if (a < b) ctx.rod(a, 428 + (a - x) * .92, b, 428 + (b - x) * .92, 1, '#a7b2aa');
        }
        liftDoors(ctx, lx, 1 - Math.max(0, Math.min(1, (departure.age - 1.3) / .7)));
        const y = 268 + departure.age / CHAIR_DEPARTURE.descending * 25;
        ctx.rod(lx + 138, y - 18, lx + 138, y, 4, '#d5e6b3');
        ctx.polygon([[lx + 128, y - 4], [lx + 148, y - 4], [lx + 138, y + 7]], '#d5e6b3');
    }
}

function chairSpeech(ctx: RenderCtx) {
    const { state } = ctx;
    const c = state.corridor;
    const departure = c.departure;
    const drop = departure.kind === 'descending' ? Math.min(1, departure.age / CHAIR_DEPARTURE.descending) * 165 : 0;
    if (departure.kind === 'boarding' || departure.kind === 'descending') {
        const index = departure.kind === 'descending' ? 3 : Math.min(2, Math.floor(departure.age / 2));
        const line = CHAIR_DEPARTURE_LINES[departure.reason][index];
        const speaker = state.furniture[line.speaker];
        const localAge = departure.kind === 'descending' ? departure.age : departure.age - index * 2;
        const x = Math.max(ctx.cam + 180, Math.min(ctx.cam + ctx.VW - 180, speaker.x));
        const fade = departure.kind === 'descending' ? Math.min(1, (CHAIR_DEPARTURE.descending - departure.age) * 4) : 1;
        if (speaker.x > ctx.cam - 60 && speaker.x < ctx.cam + ctx.VW + 60) {
            bubble(ctx, line.text, x, 242 + Math.min(drop, 38), 350, false, Math.min(1, localAge * 6) * fade, 'right');
        }
    } else if (departure.kind === 'none' && c.chat.kind !== 'waiting') {
        const interval = CHAIR_CHAT_INTERVAL[c.chat.kind];
        const line = chairChatLine(c.chat, c.appearanceSeed);
        const speaker = state.furniture[line.speaker];
        const localAge = c.chat.age % interval;
        if (localAge < interval - .35) {
            const left = ctx.cam + 180, right = ctx.cam + ctx.VW - 180;
            const x = Math.max(left, Math.min(right, speaker.x));
            if (c.chat.kind === 'dismissed' || (speaker.x > ctx.cam - 60 && speaker.x < ctx.cam + ctx.VW + 60)) {
                bubble(ctx, line.text, x, 242, 350, c.chat.kind === 'wary' || c.chat.kind === 'rush', Math.min(1, localAge * 6, (interval - .35 - localAge) * 5));
            }
        }
    }
}

function chairActors(ctx: RenderCtx) {
    const { state } = ctx;
    const c = state.corridor;
    const departure = c.departure;
    const drop = departure.kind === 'descending' ? Math.min(1, departure.age / CHAIR_DEPARTURE.descending) * 165 : 0;
    state.furniture.forEach((item, i) => {
        if (!item.released) return;
        if (departure.kind === 'none' && item.cheer > 0 && c.chat.kind === 'waiting') bubble(ctx, (['cheer.freedom', 'cheer.clockingOut', 'cheer.overtime'] satisfies Message[])[i], item.x, 285 - (i % 2) * 60, 185, true, Math.min(1, item.cheer * 2));
    });
    state.furniture.forEach((item, i) => {
        if (!item.released || departure.kind === 'gone' || departure.kind === 'lost') return;
        const reacting = c.chat.kind === 'wary' || c.chat.kind === 'realizing' || c.chat.kind === 'welcoming';
        const bob = departure.kind === 'boarding' ? Math.sin(departure.age * 9 + i) * 2 : reacting ? Math.sin(c.chat.age * 7 + i) * 2 : Math.sin(ctx.t * 5 + i) * .7;
        chair(ctx, item.x, item.y + drop + bob - chairLift(item.x));
    });
    if (departure.kind !== 'lost') {
        const actorStart = ctx.commands.length;
        player(ctx);
        if (departure.kind === 'descending' && departure.reason === 'abduction') cabinActors(ctx, actorStart);
    }}

export function drawBuilding(ctx: RenderCtx) {
    const departure = ctx.state.corridor.departure;
    buildingBackdrop(ctx);
    if (ctx.state.corridor.room.kind === 'meeting') { meetingRoom(ctx); return; }
    expressFloor(ctx);
    officeWindows(ctx);
    meetingDoor(ctx);
    dispatchRoom(ctx);
    liftShaft(ctx);
    corridorExit(ctx);
    if (departure.kind !== 'lost' && !(departure.kind === 'descending' && departure.reason === 'abduction')) {
        ctx.ellipse(ctx.p.x, 425, 45, 5, '#61747544');
    }
    liftForeground(ctx);
    chairSpeech(ctx);
    chairActors(ctx);
}
