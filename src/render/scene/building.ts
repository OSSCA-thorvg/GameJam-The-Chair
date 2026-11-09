import { translate, type Message } from '../../i18n';
import { STAGE_TWO, TYPING_SOUNDS, CHAIR_CHAT_INTERVAL, CHAIR_DEPARTURE, CHAIR_DEPARTURE_LINES, chairChatLine, paperPilePolygon } from '../../game/stage2';
import type { RenderCtx } from '../context';
import type { Vector } from '../types';
import { practiceFloor, checkpointFlag } from './decor';
import { player } from './player';

function bubble(ctx: RenderCtx, text: Message, x: number, y: number, width: number, spiky = false, alpha = 1, tail: boolean | 'right' = true) {
    const fill = ctx.tint(spiky ? '#fff1b2' : '#e2e8df', alpha);
    if (spiky) {
        const points: Vector[] = [];
        for (let i = 0; i < 32; i++) {
            const a = i / 32 * Math.PI * 2, r = i % 2 ? .84 : 1;
            points.push([x + Math.cos(a) * width / 2 * r, y + Math.sin(a) * 32 * r]);
        }
        ctx.polygon(points, fill);
    } else {
        ctx.effectPath([x - width / 2 + 12, y - 22], [
            [x + width / 2, y - 22, x + width / 2, y - 22, x + width / 2, y - 10],
            [x + width / 2, y + 22, x + width / 2, y + 22, x + width / 2 - 12, y + 22],
            [x - width / 2, y + 22, x - width / 2, y + 22, x - width / 2, y + 10],
            [x - width / 2, y - 22, x - width / 2, y - 22, x - width / 2 + 12, y - 22],
        ], ctx.gradientFill(x, y - 22, x, y + 22, [[0, '#ffffff'], [1, '#e2e8df']], alpha));
    }
    if (tail) ctx.polygon([[x - 8, y + 20], [x + 9, y + 20], [x + (tail === 'right' ? 18 : -10), y + 36]], fill);
    ctx.label(translate(text, ctx.locale), x, y + 5, 13, ctx.tint('#344955', alpha));
}
type WorkerRole = 'facilitator' | 'jacket' | 'vest';

type HairStyle = 'parted' | 'bun' | 'bob' | 'crop' | 'wavy';
type OfficeAppearance = {
    hairstyle: HairStyle;
    hair: string;
    shirt: string;
    sleeve: string;
    skin: string;
    glasses: boolean;
};
const HAIRSTYLES = ['parted', 'bun', 'bob', 'crop', 'wavy'] satisfies HairStyle[];
const HAIR_COLORS = ['#343c48', '#654238', '#302f3a', '#9a9c9c', '#624c3c', '#a27754', '#3c414b', '#443731'];
const SKIN_COLORS = ['#e5c8a5', '#ddbd9d', '#d4a581', '#c69c7e', '#b88e73', '#8f654f'];
const SHIRTS = [
    { shirt: '#627fa2', sleeve: '#8aa5c1' },
    { shirt: '#a46b62', sleeve: '#c28b7d' },
    { shirt: '#b39b5c', sleeve: '#d2bd80' },
    { shirt: '#627d6e', sleeve: '#8ca58e' },
    { shirt: '#8c719a', sleeve: '#af92b7' },
    { shirt: '#d1c3a3', sleeve: '#e4d8bd' },
    { shirt: '#9c5364', sleeve: '#bf7c89' },
    { shirt: '#577e8c', sleeve: '#85a7ae' },
];

function officeAppearance(seed: number, officeIndex: number, seatIndex: number): OfficeAppearance {
    const worker = officeIndex * 2 + seatIndex + 1;
    const roll = (trait: number) => {
        let value = seed ^ Math.imul(worker, 0x9e3779b1) ^ trait;
        value = Math.imul(value ^ value >>> 16, 0x85ebca6b);
        value = Math.imul(value ^ value >>> 13, 0xc2b2ae35);
        return (value ^ value >>> 16) >>> 0;
    };
    return {
        hairstyle: HAIRSTYLES[roll(1) % HAIRSTYLES.length],
        hair: HAIR_COLORS[roll(2) % HAIR_COLORS.length],
        ...SHIRTS[roll(3) % SHIRTS.length],
        skin: SKIN_COLORS[roll(4) % SKIN_COLORS.length],
        glasses: roll(5) % 2 === 0,
    };
}
const HAIR_SHAPES: Record<HairStyle, Vector[]> = {
    parted: [[-15,-4],[-16,-11],[-10,-19],[1,-22],[12,-16],[16,-9],[5,-13],[-7,-5],[-10,4],[-14,1]],
    bun: [[-15,-4],[-16,-11],[-10,-19],[1,-22],[12,-16],[16,-9],[5,-13],[-7,-5],[-10,4],[-14,1]],
    bob: [[-16,15],[-18,-6],[-13,-19],[0,-22],[12,-17],[17,-7],[8,-10],[-3,-12],[-6,4],[-6,17]],
    crop: [[-14,1],[-15,-10],[-9,-17],[5,-18],[12,-13],[14,-8],[4,-9],[-8,-7],[-10,3]],
    wavy: [[-16,1],[-18,-9],[-13,-18],[-6,-16],[0,-23],[6,-18],[13,-19],[17,-9],[7,-12],[3,-8],[-3,-12],[-8,-3],[-10,5]],
};

function head(ctx: RenderCtx, x: number, y: number, facing: number, hair: string, hairstyle: HairStyle = 'parted', glasses = false, skin = '#ddbd9d') {
    const shape = (points: Vector[], color: string) =>
        ctx.polygon(points.map(([px, py]) => [x + facing * px, y + py]), color);
    if (hairstyle === 'bun') ctx.ellipse(x - facing * 13, y + 6, 8, 9, hair);
    if (hairstyle === 'bob') shape([[-17,-10],[-8,-13],[-4,16],[-16,17]], hair);
    shape([[-11, -13], [6, -16], [12, -8], [14, -1], [17, 1], [13, 3],
        [11, 11], [0, 15], [-10, 10], [-13, 1]], skin);
    shape(HAIR_SHAPES[hairstyle], hair);
    shape([[7, -2], [11, -2], [11, 0], [7, 0]], '#4c4951');
    if (glasses) {
        shape([[3,-6],[14,-5],[14,3],[3,3]], '#bfd9da70');
        for (const [ax, ay, bx, by] of [[-8,-5,3,-4],[3,-6,14,-5],[14,-5,14,3],[14,3,3,3],[3,3,3,-6]]) {
            ctx.rod(x + facing * ax, y + ay, x + facing * bx, y + by, 1.7, '#374958');
        }
    }
}

function worker(ctx: RenderCtx, x: number, y: number, role: WorkerRole, facing = 1, palm?: Vector) {
    const facilitator = role === 'facilitator';
    const vest = role === 'vest';
    const fabric = facilitator ? '#715c75' : vest ? '#877b70' : '#5b6b83';
    const light = facilitator ? '#88718a' : vest ? '#9b8c7d' : '#72829a';
    const hair = facilitator ? '#4f414d' : vest ? '#494755' : '#424b5a';
    const stride = palm ? 5 : 0;
    const shape = (points: Vector[], color: string) =>
        ctx.polygon(points.map(([px, py]) => [x + facing * px, y + py]), color);

    ctx.ellipse(x, y + 1, 25, 3, '#35465624');
    shape([[-13,-45],[12,-45],[16+stride,-4],[6+stride,-4],[0,-35],[-6,-4],[-16-stride,-4]], '#485467');
    shape([[-16-stride,-7],[-6,-7],[-4,0],[-22-stride,0],[-22-stride,-3]], '#34404c');
    shape([[6+stride,-7],[16+stride,-7],[23+stride,-2],[23+stride,0],[6+stride,0]], '#34404c');
    const hem = facilitator ? -35 : -43;
    shape([[-17,-84],[-8,-90],[10,-90],[20,-83],[16,-67],[19,hem],[-17,hem],[-15,-63],[-23,-68]], fabric);
    shape([[-17,-84],[-8,-90],[-5,hem],[-17,hem],[-15,-63],[-23,-68]], light);
    shape([[-9,-89],[11,-89],[2,-67]], '#e8e3d3');
    shape([[-6,-98],[7,-98],[9,-89],[1,-84],[-6,-90]], '#b99a80');
    head(ctx, x, y - 105, facing, hair, facilitator ? 'bun' : 'parted');

    if (facilitator) {
        shape([[-13,-63],[12,-65],[16,-42],[-9,-39]], '#b1a17d');
        shape([[-9,-59],[9,-61],[12,-45],[-7,-43]], '#e0d4bb');
        shape([[-4,-62],[5,-63],[6,-59],[-3,-58]], '#8c9296');
        shape([[-18,-73],[-14,-62],[-7,-56],[-9,-51],[-16,-55],[-23,-68]], light);
        shape([[-11,-57],[-5,-55],[-6,-50],[-13,-52]], '#d7b493');
        if (palm) {
            const elbowX = x + (palm[0] - x) * .56;
            const elbowY = y - 72;
            ctx.rod(x + facing * 13, y - 79, elbowX, elbowY, 9, fabric);
            ctx.rod(elbowX, elbowY, palm[0], palm[1], 7, light);
            ctx.ellipse(palm[0], palm[1], 4, 3.2, '#ddbd9d');
        } else {
            shape([[14,-80],[21,-74],[29,-69],[36,-72],[38,-68],[29,-63],[19,-66],[12,-72]], fabric);
            shape([[34,-71],[40,-75],[44,-73],[40,-67],[36,-67]], '#ddbd9d');
        }
    } else if (vest) {
        shape([[0,-85],[4,-84],[3,-75],[0,-74],[-2,-78]], '#a76e56');
        shape([[-17,-77],[-23,-61],[-13,-54],[6,-58],[4,-64],[-11,-62],[-8,-74]], '#e9e3d6');
        shape([[13,-79],[20,-70],[15,-59],[8,-60],[10,-69],[7,-77]], '#e9e3d6');
        shape([[9,-69],[6,-77],[8,-86],[13,-85],[13,-77],[15,-70]], '#ddbd9d');
    } else {
        shape([[-16,-78],[-22,-60],[-13,-54],[2,-56],[0,-63],[-10,-62],[-8,-75]], light);
        shape([[15,-79],[21,-64],[16,-55],[-5,-55],[-6,-62],[11,-63],[8,-75]], fabric);
        shape([[-8,-64],[-1,-62],[-1,-57],[-9,-58]], '#ddbd9d');
        shape([[5,-62],[12,-63],[14,-58],[7,-57]], '#ddbd9d');
    }
}

function typingWorker(ctx: RenderCtx, x: number, y: number, look: OfficeAppearance) {
    const { shirt, sleeve, skin } = look;
    const tap = Math.sin(ctx.t * 16 + x * .07) * 1.4;
    ctx.rect(x - 21, y - 39, 11, 37, '#556673');
    ctx.polygon([[x-13,y-42],[x+3,y-44],[x+10,y-30],[x+7,y-1],[x-13,y-1]], shirt);
    ctx.polygon([[x-12,y-39],[x-5,y-40],[x-3,y-1],[x-13,y-1]], sleeve);
    ctx.polygon([[x-5,y-51],[x+6,y-51],[x+8,y-42],[x+1,y-38],[x-5,y-43]], skin);
    head(ctx, x, y - 58, 1, look.hair, look.hairstyle, look.glasses, skin);
    ctx.rect(x - 29, y, 74, 7, '#a7a18e');
    ctx.rod(x-3,y-34,x+6,y-14,8,sleeve);
    ctx.rod(x+6,y-14,x+24,y-5+tap,5,skin);
    ctx.ellipse(x+26,y-4+tap,4,2.5,skin);
    ctx.rect(x + 17, y - 3, 17, 3, '#455665');
    ctx.polygon([[x+30,y-35],[x+46,y-36],[x+44,y-14],[x+28,y-13]], '#526674');
    ctx.rod(x+36,y-14,x+36,y-3,3,'#526674');
    ctx.rect(x + 31, y - 3, 12, 3, '#526674');
}

function chair(ctx: RenderCtx, x: number, y: number) {
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
function room(ctx: RenderCtx) {
    const scene = ctx.state.corridor.room;
    if (scene.kind !== 'meeting') return;
    const x = STAGE_TWO.meeting;
    ctx.rect(ctx.cam, 60, ctx.VW, 360, '#c3c8bd');
    ctx.rect(x - 220, 100, 420, 145, '#617975');
    ctx.rect(x - 208, 112, 396, 121, '#f0ecd9');
    ctx.label(translate('Meeting: when should this meeting end?', ctx.locale), x - 10, 148, 16, '#48605d');
    for (let i = 0; i < 3; i++) {
        ctx.rod(x - 180, 177 + i * 16, x + 65 - i * 32, 177 + i * 16, 3, '#9ba9a0');
    }
    worker(ctx, x - 10, 397, 'jacket', -1);
    worker(ctx, x + 119, 397, 'vest', -1);
    ctx.rect(x - 190, 330, 370, 15, '#ab9274');
    ctx.rod(x - 170, 345, x - 170, 420, 8, '#657b7b');
    ctx.rod(x + 160, 345, x + 160, 420, 8, '#657b7b');
    for (const dx of [-110, 0, 110]) {
        ctx.ripple(x + dx, 404, 28, 10, 2, '#f0e8c0');
        ctx.label('···', x + dx, 405, 18, '#7c8d85');
    }
    const pushing = Math.max(0, scene.age - 4.6) * 100;
    worker(ctx, x - 156 + pushing, 420, 'facilitator', 1,
        scene.age > 4.6 ? [ctx.p.x - 31, ctx.p.y - 61] : undefined);
    const line: Message = scene.age < 2.4 ? 'The chairs have gone home.' : scene.age < 3.5 ? 'People, please stay for the next agenda.' : 'Oh, one more chair! You may leave!';
    bubble(ctx, line, x, 75, 440);
    player(ctx);
}
export function drawBuilding(ctx: RenderCtx) {
    const { state, cam, VW } = ctx;
    const c = state.corridor;
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
    ctx.rect(cam, 420, VW, ctx.H / ctx.scale, '#929f9d');
    ctx.rod(cam, 422, cam + VW, 422, 4, '#586f75');
    for (let x = Math.floor(cam / 120) * 120; x < cam + VW; x += 120) ctx.rod(x, 428, x + 100, 520, 1, '#a7b2aa');
    if (c.room.kind === 'meeting') { room(ctx); return; }
    for (const pile of c.paperPiles) {
        if (pile.x + pile.halfWidth < cam || pile.x - pile.halfWidth > cam + VW) continue;
        const shape = paperPilePolygon(pile).map(point => [point.x, point.y] as Vector);
        ctx.gradientPolygon(shape, ctx.gradientFill(pile.x, 420 - pile.height, pile.x, 420,
            [[0, '#faf5e7'], [1, '#c8bda9']]));
        ctx.rod(pile.x - pile.halfWidth * .39, 420 - pile.height + 1,
            pile.x + pile.halfWidth * .39, 420 - pile.height + 1, 1, '#9e9a8e');
        ctx.rod(pile.x - pile.halfWidth * .68, 419 - pile.height * .53,
            pile.x + pile.halfWidth * .57, 419 - pile.height * .53, 1, '#e7dfce');
        ctx.rod(pile.x - pile.halfWidth * .18, 422 - pile.height,
            pile.x + pile.halfWidth * .19, 422 - pile.height, 1, '#b0afa1');
    }
    for (const [officeIndex, office] of c.offices.entries()) {
        const x = office.x;
        ctx.rect(x - 110, 174, 220, 181, '#617983');
        ctx.rect(x - 105, 180, 210, 170, '#839895');
        typingWorker(ctx, x - 65, 340, officeAppearance(c.appearanceSeed, officeIndex, 0));
        typingWorker(ctx, x + 32, 340, officeAppearance(c.appearanceSeed, officeIndex, 1));
        ctx.rect(x - 105, 180, 210, 170, '#6d8b9970');
        ctx.rod(x, 175, x, 355, 5, '#849a9e');
        ctx.polygon([[x - 98, 184], [x - 75, 184], [x + 55, 347], [x + 32, 347]], '#edf4e719');
        if ((c.departure.kind === 'none' || c.departure.kind === 'gone') && office.life > 0) bubble(ctx, TYPING_SOUNDS[office.phrase], x + office.offset.x, 174 + office.offset.y, 156, false, Math.min(.78, office.life * 2), false);
    }
    const mx = STAGE_TWO.meeting;
    ctx.rect(mx - 78, 180, 156, 240, '#687f80');
    ctx.rect(mx - 70, 187, 140, 232, '#91a29b');
    const opening = Math.min(1, c.dispatchAge / .5);
    ctx.rect(mx - 64 + opening * 112, 190, 126 * (1 - opening), 225, '#d8d6bf');
    ctx.rect(mx - 70, 147, 140, 25, '#e1d7bb');
    ctx.label(translate('Meeting extended', ctx.locale), mx, 164, 13, '#4f6268');
    const pushPhase = c.dispatchStarted && c.dispatchAge < 3.5 ? Math.sin(Math.max(0, c.dispatchAge - .35) * Math.PI / .9) ** 2 : 0;
    worker(ctx, mx - 57 + pushPhase * 10, 420, 'facilitator', 1,
        pushPhase > 0 ? [mx - 18 + pushPhase * 9, 344 - pushPhase * 11] : undefined);
    if (c.dispatchStarted && c.dispatchAge < 1.5) bubble(ctx, 'Meeting extended. Chairs may leave.', mx + 40, 103, 310);
    if (state.canEnterMeeting) {
        ctx.rect(mx - 57, 216, 114, 32, '#263a45e8');
        ctx.label(translate('↓ Enter', ctx.locale), mx, 238, 16, '#f6eddc');
    }
    const lx = STAGE_TWO.lift;
    const departure = c.departure;
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
    if (c.cart) {
        const x = c.cart.x;
        const y = c.cart.y;
        ctx.rod(x - 50, y - 8, x + 50, y - 8, 5, '#546a77');
        ctx.rod(x + 46, y - 8, x + 46, y - 66, 5, '#546a77');
        for (let i = 0; i < 9; i++) ctx.rect(x - 39 + Math.sin(i * 3) * 3, y - 17 - i * 5, 70, 4, i % 2 ? '#e7e0ca' : '#f8f4e4');
        for (const dx of [-33, 33]) ctx.ellipse(x + dx, y - 4, 6, 6, '#384c59');
        if (departure.kind === 'none' && c.lift.kind === 'open' && c.lift.age < 2) bubble(ctx, 'Overtime arriving first.', lx - 35, 219, 230);
        if (departure.kind === 'none' && c.cart.hit) bubble(ctx, 'Urgent delivery!', x, 304, 170, true);
    }
    for (let i = 1; i < STAGE_TWO.checkpoints.length; i++) {
        const mark = STAGE_TWO.checkpoints[i];
        checkpointFlag(ctx, mark.x, 420, state.checkpoint >= i);
    }
    ctx.rect(ctx.GOAL - 48, 190, 105, 230, '#587878');
    ctx.rect(ctx.GOAL - 40, 198, 89, 220, '#a6bcb1');
    ctx.rod(ctx.GOAL + 29, 299, ctx.GOAL + 29, 330, 4, '#5f797b');
    pictogram(ctx, ctx.GOAL, 'exit');
    practiceFloor(ctx);
    ctx.ellipse(ctx.p.x, 425, 45, 5, '#61747544');
    state.furniture.forEach((item, i) => {
        if (!item.released || departure.kind === 'gone') return;
        const reacting = c.chat.kind === 'wary' || c.chat.kind === 'realizing' || c.chat.kind === 'welcoming';
        const bob = departure.kind === 'boarding' ? Math.sin(departure.age * 9 + i) * 2 : reacting ? Math.sin(c.chat.age * 7 + i) * 2 : Math.sin(ctx.t * 5 + i) * .7;
        chair(ctx, item.x, item.y + drop + bob);
        if (departure.kind === 'none' && item.cheer > 0 && c.chat.kind === 'waiting') bubble(ctx, (['Woohoo! Freedom!', 'Clocking out!', 'Bye-bye, overtime!'] satisfies Message[])[i], item.x, 285 - (i % 2) * 60, 185, true, Math.min(1, item.cheer * 2));
    });
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
    player(ctx);
    if (departure.kind === 'boarding' || departure.kind === 'descending') {
        const index = departure.kind === 'descending' ? 3 : Math.min(2, Math.floor(departure.age / 2));
        const line = CHAIR_DEPARTURE_LINES[departure.reason][index];
        const speaker = state.furniture[line.speaker];
        const localAge = departure.kind === 'descending' ? departure.age : departure.age - index * 2;
        const x = Math.max(ctx.cam + 180, Math.min(ctx.cam + ctx.VW - 180, speaker.x));
        const fade = departure.kind === 'descending' ? Math.min(1, (CHAIR_DEPARTURE.descending - departure.age) * 4) : 1;
        if (departure.reason === 'initiation' || (speaker.x > ctx.cam - 60 && speaker.x < ctx.cam + ctx.VW + 60)) {
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
                bubble(ctx, line.text, x, 242, 350, c.chat.kind === 'wary', Math.min(1, localAge * 6, (interval - .35 - localAge) * 5));
            }
        }
    }
}
