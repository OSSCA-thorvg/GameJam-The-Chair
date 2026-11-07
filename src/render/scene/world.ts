import { translate } from '../../i18n';
import type { DeepReadonly, Person } from '../../game/types';
import type { RenderCtx } from '../context';
import { plant, desk, binBack, binFront, practiceFloor, checkpointFlag } from './decor';
import { cleaningDraw, person } from './cleaning';
import { monitorDraw } from './monitor';
import { player, debugCollisions } from './player';
import { EFFECT_STYLE } from '../art';
import type { Vector } from '../types';

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
    for (let i = Math.floor(cam / 235) - 1; i < (cam + VW) / 235 + 1; i++) {
        const x = i * 235;
        ctx.rect(x + 17, 80, 197, 193, '#69788c');
        ctx.rect(x + 24, 87, 183, 179, '#202940');
        for (let j = 0; j < 4; j++) {
            const bx = x + 30 + j * 42;
            const h = 60 + (i * 23 + j * 31 + 300) % 80;
            ctx.rect(bx, 260 - h, 32, h, '#425069');
            for (let k = 0; k < 3; k++) {
                const flickers = j === ((i % 4) + 4) % 4 && k === 1;
                const period = 3.4 + ((i % 3 + 3) % 3) * .7;
                const phase = (t + (i * 1.37 % period) + period) % period;
                const color = flickers && phase < .38 ? '#334056' : '#e2cea1';
                ctx.rect(bx + 6, 269 - h + k * 20, 6, 8, color);
            }
        }
        ctx.rod(x + 113, 87, x + 113, 267, 4, '#69788c');
        ctx.rod(x + 24, 179, x + 207, 179, 3, '#69788c');
        ctx.rect(x + 43, 27, 145, 7, '#f1e9cf');
    }
    const rearFloor = F - 62;
    ctx.rect(cam, 287, VW, rearFloor - 287, '#a0a7b1');
    ctx.rect(cam, rearFloor - 5, VW, 6, '#848e9d');
    ctx.rect(cam, rearFloor + 1, VW, F - rearFloor - 1, '#aeb3bb');
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
        plant(ctx, x + (x === 110 ? 295 : 205));
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
    for (const z of papers) {
        ctx.ox = z.x;
        ctx.oy = z.y;
        ctx.rotation = z.a;
        ctx.rect(-10, -6, 20, 12, C.paper);
        ctx.rod(-6, -2, 6, -2, 1, '#9a9e9d');
        ctx.rod(-6, 2, 3, 2, 1, '#b3b3a7');
        ctx.ox = ctx.oy = ctx.rotation = 0;
    }
    monitorDraw(ctx);
    practiceFloor(ctx);
    checkpointFlag(ctx, 1400, F, state.officeCheckpoint);
    for (let x = 1490; x < 1545; x += 18) {
        ctx.polygon([[x, F - 4], [x + 12, F - 4], [x + 24, F - 12], [x + 12, F - 12]], '#e1c38b');
    }

    binBack(ctx);
    ctx.ellipse(p.x, F + 8, 45, 5, '#91959c');
    player(ctx);
    binFront(ctx);
    debugCollisions(ctx);
    for (const z of ctx.specks) {
        ctx.ox = z.x;
        ctx.oy = z.y;
        ctx.rotation = z.a;
        ctx.rect(-3, -2, 7, 4, z.color);
        ctx.ox = ctx.oy = ctx.rotation = 0;
    }
    ctx.rect(GOAL - 35, F - 205, 106, 205, '#677d7e');
    ctx.rect(GOAL - 27, F - 197, 90, 190, '#b5c4bf');
    ctx.rod(GOAL + 40, F - 120, GOAL + 40, F - 81, 4, '#677d7e');
    ctx.rect(GOAL - 31, F - 236, 98, 23, '#718e7b');
    ctx.label(translate('Exit →', ctx.locale), GOAL + 18, F - 218, 12, '#f0eddc');
    if (ctx.glare > 0) {
        ctx.rect(cam, -vertical, VW, H / scale, '#fff7d5' + Math.round(Math.min(.22, ctx.glare * .16) * 255).toString(16).padStart(2, '0'));
    }
    if (copier.flash > 0 && ctx.mode === 'play') {
        const age = EFFECT_STYLE.copierFlashDuration - copier.flash;
        const pop = .9 + .1 * Math.min(1, age / .06);
        const y = F - 205;
        const line = translate('PTUI! PTUI!!', ctx.locale);
        ctx.lg.font = `${18 * ctx.scale}px system-ui,sans-serif`;
        const radiusX = Math.max(82, ctx.lg.measureText(line).width / ctx.scale / 2 + 24);
        const burst: Vector[] = Array.from({ length: 24 }, (_, i) => {
            const angle = i / 24 * ctx.TAU;
            const radius = i % 2 === 0 ? 1 : .76;
            return [x + Math.cos(angle) * radiusX * radius * pop, y + Math.sin(angle) * 37 * radius * pop];
        });
        ctx.polygon([[x - 16, y + 21], [x + 5, F - 151], [x + 16, y + 20]], C.ink);
        ctx.polygon(burst, C.ink);
        ctx.polygon(burst.map(([px, py]) => [x + (px - x) * .94, y + (py - y) * .88]), '#fff0bc');
        ctx.label(line, x, y + 6, 18, C.ink);
    }
}
