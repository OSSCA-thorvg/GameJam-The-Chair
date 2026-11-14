import { translate } from '../../i18n';
import type { DeepReadonly, Person } from '../../game/types';
import type { RenderCtx } from '../context';
import { SIGN_FONT } from '../fonts';
import { plant, desk, binBack, binFront, practiceFloor, checkpointFlag, chairPictogram } from './decor';
import { cleaningDraw, person } from './cleaning';
import { monitorDraw } from './monitor';
import { player, debugCollisions } from './player';
import { EFFECT_STYLE } from '../art';
import type { Vector } from '../types';
import { LEVEL } from '../../game/level';
import { geyserPhase } from '../../game/stages/office/geyser/decide';
import { URGENT_VOLLEY_ID } from '../../game/stages/office/copier/decide';
import { urgentCopierDraw, urgentPapersDraw } from './urgent-copier';
import { ceilingCctvs } from './ceiling-cctv';
import { windowView } from './window-view';
import { officeControlHints } from './control-hints';

/** The exit door's span on the back wall, around the goal; no window is drawn behind it. */
const EXIT = { left: LEVEL.goal - 45, right: LEVEL.goal + 81 };

/** The exit: a door standing against the back wall (its foot on the wall line) under the chair-only exit sign. */
function exitDoor(ctx: RenderCtx, goal: number, wallFoot: number) {
    const top = wallFoot - 205;
    ctx.rect(goal - 35, top, 106, 205, '#677d7e');
    ctx.rect(goal - 27, top + 8, 90, 190, '#b5c4bf');
    ctx.rod(goal + 40, top + 85, goal + 40, top + 124, 4, '#677d7e');
    chairPictogram(ctx, goal + 18, 'exit', top - 70);
}

export function drawWorld(ctx: RenderCtx) {
    const F = ctx.F;
    const C = ctx.C;
    const VW = ctx.VW;
    const H = ctx.H;
    const scale = ctx.scale;
    const cam = ctx.cam;
    const vertical = ctx.vertical;
    const state = ctx.state;
    const solids = ctx.solids;
    const people = ctx.people;
    const cleaning = ctx.cleaning;
    const bin = ctx.bin;
    const copier = ctx.copier;
    const papers = ctx.papers;
    const p = ctx.p;
    const t = ctx.t;
    const GOAL = ctx.GOAL;

    ctx.commands = [];
    ctx.ox = ctx.oy = ctx.rotation = 0;
    const left = cam - 100;
    const right = cam + VW + 100;
    ctx.rect(cam, -vertical, VW, H / scale, '#a9afbc');
    ctx.rect(cam, -vertical, VW, 57 + vertical, '#747d91');
    ctx.rod(cam, 57, cam + VW, 57, 4, '#d1d1c6');
    const view = windowView(ctx.windowDusk);
    for (let i = Math.floor(cam / 235) - 1; i < (cam + VW) / 235 + 1; i++) {
        const x = i * 235;
        // No window behind the exit door: the wall stays solid where the door stands against it.
        if (x + 214 <= EXIT.left || x + 17 >= EXIT.right) {
            ctx.rect(x + 17, 80, 197, 193, view.frame);
            if (view.skyTop === view.skyBottom) ctx.rect(x + 24, 87, 183, 179, view.skyTop);
            else ctx.gradientPolygon([[x + 24, 87], [x + 207, 87], [x + 207, 266], [x + 24, 266]], ctx.gradientFill(0, 87, 0, 266, [[0, view.skyTop], [1, view.skyBottom]]));
            for (let j = 0; j < 4; j++) {
                const bx = x + 30 + j * 42;
                const mixed = Math.imul(state.skylineSeed ^ i, 0x45d9f3b) ^ Math.imul(j + 1, 0x119de1f3);
                const h = 55 + ((mixed ^ (mixed >>> 16)) >>> 0) % 101;
                ctx.rect(bx, 260 - h, 32, h, view.building);
                for (let k = 0; k < 3; k++) {
                    const flickers = j === ((i % 4) + 4) % 4 && k === 1;
                    const period = 3.4 + ((i % 3 + 3) % 3) * .7;
                    const phase = (t + (i * 1.37 % period) + period) % period;
                    const color = flickers && phase < .38 ? view.unlit : view.lit;
                    ctx.rect(bx + 6, 269 - h + k * 20, 6, 8, color);
                }
            }
            ctx.rod(x + 113, 87, x + 113, 267, 4, view.frame);
            ctx.rod(x + 24, 179, x + 207, 179, 3, view.frame);
        }
        ctx.rect(x + 43, 27, 145, 7, '#f1e9cf');
    }
    ceilingCctvs(ctx, 940);
    const rearFloor = F - 62;
    ctx.rect(cam, 287, VW, rearFloor - 287, '#a0a7b1');
    ctx.rect(cam, rearFloor - 5, VW, 6, '#848e9d');
    ctx.rect(cam, rearFloor + 1, VW, F - rearFloor - 1, '#aeb3bb');
    exitDoor(ctx, GOAL, rearFloor);
    for (const ob of solids) {
        ctx.polygon(ob.p.map(v => [v.x, v.y]), C.floor);
        const [topLeft, topRight] = ob.p;
        ctx.rod(topLeft.x, topLeft.y, topRight.x, topRight.y, 1.2, '#a5abb5');
    }
    ctx.rod(cam, rearFloor + 28, cam + VW, rearFloor + 28, .9, '#9da5b1');
    for (let x = Math.floor(left / 110) * 110; x < right; x += 110) {
        ctx.rod(x + 15, rearFloor + 1, x, F, 1, '#9ca5b1');
        if (x <= bin.a - 30 || x >= bin.b + 35) {
            ctx.rod(x, F, x - 35, F + 150, 1.15, '#a7adb6');
        }
    }
    for (let x = 110; x < GOAL; x += 420) {
        if (x < left - 200 || x > right) continue;
        desk(ctx, x);
        const plantX = x + (x === 110 ? 295 : 205);
        plant(ctx, Math.abs(plantX - cleaning.x - 55) < 70 ? plantX + 90 : plantX);
    }
    let cleaner: DeepReadonly<Person> | undefined;
    for (const n of people) {
        if (n.x > left && n.x < right) {
            if (n.id === 'cleaner') {
                cleaner = n;
            } else {
                person(ctx, n);
            }
        }
    }
    cleaningDraw(ctx, cleaner);
    const x = copier.x;
    ctx.ellipse(x + 3, F - 20, 61, 4.2, '#515c6d56');
    ctx.rect(x - 56, F - 108, 112, 88, '#c6c9bf');
    ctx.rect(x - 48, F - 96, 40, 61, '#aeb7b5');
    ctx.rect(x - 1, F - 96, 47, 22, '#717f88');
    const charging = copier.burst > 0;
    ctx.rect(x + 6, F - 91, 21, 9, charging ? '#edc883' : '#9fbdad');
    if (charging) {
        for (const dx of [-34, -10, 14, 38]) {
            ctx.ellipse(x + dx, F - 103, 7, 4, '#6a7880');
            ctx.rod(x + dx, F - 106, x + dx + Math.sin(t * 22) * 4, F - 100, 2, '#e4d8b6');
        }
        ctx.polygon([[x - 71, F - 125], [x - 61, F - 139], [x - 51, F - 125]], '#edd0a1');
    }

    ctx.rect(x - 56, F - 120, 112, 12, '#dcdccc');
    ctx.polygon([[x - 45, F - 121], [x + 35, F - 132], [x + 48, F - 151], [x - 35, F - 143]], '#e7e4d6');
    ctx.rect(x - 65, F - 91, 22, 7, '#333d49');
    ctx.rect(x + 42, F - 91, 23, 7, '#333d49');
    for (let j = 0; j < 3; j++) {
        ctx.rect(x - 37, F - 70 + j * 11, 22, 3, '#737f87');
    }
    urgentCopierDraw(ctx);
    for (const z of papers) {
        if (z.volley >= URGENT_VOLLEY_ID) continue;
        ctx.ox = z.x;
        ctx.oy = z.y;
        ctx.rotation = z.a;
        ctx.rect(-10, -6, 20, 12, C.paper);
        ctx.rod(-6, -2, 6, -2, 1, '#9a9e9d');
        ctx.rod(-6, 2, 3, 2, 1, '#b3b3a7');
        ctx.ox = ctx.oy = ctx.rotation = 0;
    }
    urgentPapersDraw(ctx, papers);
    monitorDraw(ctx);
    for (const g of LEVEL.geysers) {
        if (g.x < left - 80 || g.x > right + 80) continue;
        const phase = geyserPhase(g, t);
        ctx.rect(g.x - 32, F - 2, 64, 6, '#3a414c');
        for (let i = 0; i < 5; i++) ctx.rect(g.x - 28 + i * 12, F + 1, 8, 2, '#1e232c');
        ctx.rect(g.x - 34, F - 6, 68, 5, '#5a6372');
        if (phase.kind === 'warning') {
            const charge = 1 - phase.remaining / .8;
            const shake = Math.sin(t * 42) * charge * 2;
            ctx.rect(g.x - 30 + shake, F - 12, 60, 6, ctx.tint('#f1d36a', .4 + charge * .5));
            for (let i = 0; i < 4; i++) {
                ctx.rect(g.x - 22 + i * 12 + shake, F - 10 - charge * 6, 8, 3 + charge * 4, ctx.tint('#fbe59a', .3 + charge * .6));
            }
            ctx.ellipse(g.x, F + 10, 42 + charge * 18, 4, ctx.tint('#f1d36a', charge * .5));
        } else if (phase.kind === 'burst') {
            const u = phase.age / .4;
            const envelope = Math.min(1, phase.age / .08, phase.remaining / .12);
            const topY = F - 40 - Math.min(u, 1) * 150;
            for (let i = 0; i < 9; i++) {
                const sway = Math.sin(t * 9 + i * 1.3) * 10;
                const stripX = g.x - 24 + i * 6 + sway;
                const stripTop = topY + i * 4 - (i % 2) * 8;
                ctx.rect(stripX, stripTop, 4, F - stripTop - 2, ctx.tint('#f5f3e8', envelope));
                ctx.rect(stripX, stripTop, 4, 3, ctx.tint('#c9c4b1', envelope));
            }
            for (let i = 0; i < 6; i++) {
                const spin = t * 6 + i * 1.7;
                const ox = Math.sin(spin) * 32;
                const oy = topY - 12 - (i * 11) % 36;
                ctx.polygon([[g.x + ox - 8, oy], [g.x + ox + 8, oy - 3], [g.x + ox + 7, oy + 7], [g.x + ox - 7, oy + 8]], ctx.tint('#efeadb', envelope * .9));
            }
            ctx.rect(g.x - 36, F - 10, 72, 10, ctx.tint('#e5deca', envelope * .5));
        }
    }
    practiceFloor(ctx);
    checkpointFlag(ctx, 1400, F, state.officeCheckpoint);
    for (let x = 1490; x < 1545; x += 18) {
        ctx.polygon([[x, F - 4], [x + 12, F - 4], [x + 24, F - 12], [x + 12, F - 12]], '#e1c38b');
    }

    binBack(ctx);
    ctx.ellipse(p.x, F + 8, 45, 5, '#91959c');
    player(ctx);
    binFront(ctx);
    officeControlHints(ctx);
    debugCollisions(ctx);
    for (const z of ctx.specks) {
        ctx.ox = z.x;
        ctx.oy = z.y;
        ctx.rotation = z.a;
        ctx.rect(-3, -2, 7, 4, z.color);
        ctx.ox = ctx.oy = ctx.rotation = 0;
    }
    if (ctx.glare > 0) {
        ctx.rect(cam, -vertical, VW, H / scale, '#fff7d5' + Math.round(Math.min(.22, ctx.glare * .16) * 255).toString(16).padStart(2, '0'));
    }
    if (copier.flash > 0 && ctx.mode === 'play') {
        const age = EFFECT_STYLE.copierFlashDuration - copier.flash;
        const pop = .9 + .1 * Math.min(1, age / .06);
        const y = F - 205;
        const line = translate('copier.printer', ctx.locale);
        const radiusX = Math.max(82, ctx.measureText(line, 18, SIGN_FONT) / 2 + 24);
        const burst: Vector[] = Array.from({ length: 24 }, (_, i) => {
            const angle = i / 24 * ctx.TAU;
            const radius = i % 2 === 0 ? 1 : .76;
            return [x + Math.cos(angle) * radiusX * radius * pop, y + Math.sin(angle) * 37 * radius * pop];
        });
        ctx.polygon([[x - 16, y + 21], [x + 5, F - 151], [x + 16, y + 20]], C.ink);
        ctx.polygon(burst, C.ink);
        ctx.polygon(burst.map(([px, py]) => [x + (px - x) * .94, y + (py - y) * .88]), '#fff0bc');
        ctx.label(line, x, y + 6, 18, C.ink, SIGN_FONT);
    }
}
