import { translate } from '../../i18n';
import type { RenderCtx } from '../context';
import { STAGE_THREE } from '../../game/stages/rooftop/data';

// The closing door jolts only Jin's portrait loose from the otherwise tidy row.
export function employeeBoard(ctx: RenderCtx) {
    ctx.rect(51, 86, 172, 132, '#26334455');
    ctx.rect(47, 82, 172, 132, '#263c53');
    ctx.gradientPolygon([[51, 86], [215, 86], [215, 210], [51, 210]],
        ctx.gradientFill(51, 86, 215, 210, [[0, '#73899b'], [1, '#455e76']]));
    ctx.rod(51, 86, 215, 86, 2, '#a9bac6');
    for (const x of [55, 211]) for (const y of [89, 207]) ctx.ellipse(x, y, 1.5, 1.5, '#bac4cb');
    ctx.rect(56, 90, 154, 20, '#314b61');
    ctx.label(translate('world.employeeBoard', ctx.locale), 133, 104, 10, '#fff0c6');
    employeePortrait(ctx, 62, 118, false, '#526d86');
    employeePortrait(ctx, 111, 118, false, '#747d60');
    // The clean patch and abandoned pin make the empty place in the row visible.
    ctx.rect(160, 118, 40, 49, '#b9c9d244');
    ctx.ellipse(180, 119, 2, 2, '#293f54');
    ctx.rod(180, 122, 181, 149, 1, '#293f5470');
    playerPortrait(ctx);
    boardLight(ctx);
}

function playerPortrait(ctx: RenderCtx) {
    const { ox, oy, rotation } = ctx;
    const entrance = ctx.state.rooftopEntrance;
    const time = entrance.kind === 'opening' ? entrance.age : ctx.state.time;
    const age = ctx.state.checkpoint > 0 ? 2 : Math.max(0, time - STAGE_THREE.entrance.duration);
    const pose = portraitSlip(ctx, age);
    ctx.ox = 180 + pose.jolt;
    ctx.oy = 119 + pose.drop;
    ctx.rotation = pose.angle * Math.PI / 180;
    employeePortrait(ctx, -20, -1, true, '#597184');
    ctx.ox = ox;
    ctx.oy = oy;
    ctx.rotation = rotation;
}

function portraitSlip(ctx: RenderCtx, age: number) {
    const jolt = Math.sin(age * 100) * Math.max(0, 1 - age / .12);
    const fall = ctx.clamp((age - .12) / .24, 0, 1);
    const caught = Math.max(0, age - .36);
    const drop = 35 * fall * fall + 3 * Math.exp(-caught * 8) * Math.sin(caught * 20);
    const turn = ctx.clamp((age - .12) / 1.4, 0, 1);
    const eased = turn * turn * (3 - 2 * turn);
    const swing = 12 * Math.sin(turn * Math.PI * 3) * Math.sin(turn * Math.PI);
    return { jolt: jolt * 2, drop, angle: 40 * eased + swing + jolt * 3 };
}

function boardLight(ctx: RenderCtx) {
    ctx.rod(111, 53, 111, 65, 3, '#91a3b1');
    ctx.rod(155, 53, 155, 65, 3, '#91a3b1');
    ctx.rect(94, 63, 78, 11, '#23394f');
    ctx.rect(96, 63, 74, 2, '#8b9eaf');
    ctx.rect(100, 71, 66, 3, '#fff0c7');
    ctx.beginLayer({ key: 'employee-board-light', blend: 'screen', opacity: .65 });
    ctx.gradientPolygon([[100, 75], [166, 75], [222, 214], [44, 214]],
        ctx.gradientFill(0, 75, 0, 214, [[0, '#fff0c678'], [.45, '#ffe4b33b'], [1, '#ffe4b300']]));
    ctx.endLayer();
    ctx.beginLayer({ key: 'employee-board-lamp-glow', blend: 'add', blur: 3, opacity: .5,
        effectBudget: { area: 24_000, minScale: .7 } });
    ctx.rect(100, 71, 66, 3, '#ffe5af');
    ctx.endLayer();
}

function employeePortrait(ctx: RenderCtx, x: number, y: number, jin: boolean, shirt: string) {
    ctx.rect(x + 2, y + 2, 40, 49, '#493c3455');
    ctx.rect(x, y, 40, 49, '#f4ecd7');
    ctx.gradientPolygon([[x + 3, y + 3], [x + 37, y + 3], [x + 37, y + 36], [x + 3, y + 36]],
        ctx.gradientFill(x, y, x, y + 36, [[0, '#a7b8bd'], [1, '#dce0ce']]));
    ctx.polygon([[x + 7, y + 35], [x + 11, y + 24], [x + 29, y + 24], [x + 33, y + 35]], jin ? ctx.C.shirt : shirt);
    ctx.ellipse(x + 20, y + 17, 8, 10, ctx.C.skin);
    ctx.polygon([[x + 12, y + 17], [x + 11, y + 9], [x + 16, y + 5], [x + 26, y + 7],
        [x + 29, y + 14], [x + 20, y + 11], [x + 15, y + 14]], '#3c424f');
    if (jin) {
        ctx.rect(x + 12, y + 15, 7, 5, '#50606a');
        ctx.rect(x + 21, y + 15, 7, 5, '#50606a');
        ctx.rod(x + 19, y + 17, x + 21, y + 17, 1, '#50606a');
        ctx.rect(x + 13, y + 16, 5, 2, '#83c8e4');
        ctx.rect(x + 22, y + 16, 5, 2, '#83c8e4');
        ctx.polygon([[x + 18, y + 26], [x + 22, y + 26], [x + 23, y + 34], [x + 20, y + 36], [x + 17, y + 34]], '#a65e44');
    } else {
        ctx.ellipse(x + 17, y + 17, 1, 1, '#3c424f');
        ctx.ellipse(x + 24, y + 17, 1, 1, '#3c424f');
        ctx.rod(x + 12, y + 42, x + 28, y + 42, 1.5, '#879080');
        ctx.polygon([[x + 30, y + 29], [x + 27, y + 39], [x + 32, y + 37], [x + 36, y + 40], [x + 35, y + 29]], '#ba7447');
        ctx.ellipse(x + 33, y + 29, 5, 5, '#e9bc62');
        ctx.ellipse(x + 33, y + 29, 2.5, 2.5, '#fff0ba');
    }
    ctx.ellipse(x + 20, y + 1, 2.5, 2.5, '#af5745');
    ctx.ellipse(x + 19.3, y + .3, .8, .8, '#efb18b');
}
