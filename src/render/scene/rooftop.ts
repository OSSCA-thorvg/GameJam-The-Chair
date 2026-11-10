import { translate } from '../../i18n';
import { STAGE_THREE } from '../../game/stage3';
import type { RenderCtx } from '../context';
import { checkpointFlag } from './decor';
import { player } from './player';

export function drawRooftop(ctx: RenderCtx) {
    const C = ctx.C;
    const VW = ctx.VW;
    const H = ctx.H;
    const scale = ctx.scale;
    const cam = ctx.cam;
    const vertical = ctx.vertical;
    const state = ctx.state;
    const solids = ctx.solids;
    const p = ctx.p;
    const GOAL = ctx.GOAL;
    const t = ctx.t;

    ctx.commands = [];
    ctx.ox = ctx.oy = ctx.rotation = 0;

    // Sky as a vertical ThorVG gradient fading into warm horizon haze.
    const skyTop = -vertical;
    const skyBottom = H / scale;
    ctx.gradientPolygon(
        [[cam, skyTop], [cam + VW, skyTop], [cam + VW, skyBottom], [cam, skyBottom]],
        ctx.gradientFill(0, skyTop, 0, 300, [
            [0, '#4f7aa2'],
            [.55, '#8aa6bf'],
            [.85, '#d4bc96'],
            [1, '#b8a789'],
        ])
    );

    // Horizon haze band with its own gradient to blend distant skyline.
    ctx.gradientPolygon(
        [[cam, 120], [cam + VW, 120], [cam + VW, 300], [cam, 300]],
        ctx.gradientFill(0, 120, 0, 300, [
            [0, '#a2b8c7cc'],
            [1, '#c7b89900'],
        ])
    );
    for (let x = Math.floor(cam / 220) * 220; x < cam + VW + 220; x += 220) {
        ctx.rect(x + 40, 110, 50, 170, '#6b7e8e');
        ctx.rect(x + 100, 140, 70, 140, '#7b8e9e');
        ctx.rect(x + 180, 90, 36, 190, '#5e707f');
    }

    // Floor polygons.
    for (const ob of solids) ctx.polygon(ob.p.map(v => [v.x, v.y]), C.floor);

    // Mechanical room sign (English primary, Korean secondary).
    ctx.rect(300, 326, 180, 36, '#5e6b7d');
    ctx.rect(304, 330, 172, 28, '#48525f');
    ctx.label(translate('world.mechanical', ctx.locale), 390, 343, 12, '#f0eddc');

    // Gap edge markers between first and second ground segment.
    ctx.rod(900, 410, 900, 440, 5, '#c3b375');
    ctx.rod(1020, 410, 1020, 440, 5, '#c3b375');

    // Vertical shaft wall decoration.
    ctx.rect(1500, 280, 400, 10, '#5a6471');
    for (let x = 1510; x < 1890; x += 40) ctx.rect(x, 285, 8, 8, '#747d8b');

    // Checkpoint flags.
    for (let i = 1; i < STAGE_THREE.checkpoints.length; i++) {
        const mark = STAGE_THREE.checkpoints[i];
        checkpointFlag(ctx, mark.x, mark.y + 28, state.checkpoint >= i);
    }

    // Goal: sky-door at rooftop.
    ctx.rect(GOAL - 35, 55, 106, 130, '#4b586b');
    // Door face with a vertical gradient (brighter top, cooler base).
    ctx.gradientPolygon(
        [[GOAL - 27, 63], [GOAL + 63, 63], [GOAL + 63, 178], [GOAL - 27, 178]],
        ctx.gradientFill(0, 63, 0, 178, [
            [0, '#e4edee'],
            [.5, '#c4d2d6'],
            [1, '#92a3ab'],
        ])
    );
    ctx.rect(GOAL - 31, 28, 98, 32, '#718e7b');
    ctx.label(translate('world.rooftop', ctx.locale), GOAL + 18, 42, 12, '#f0eddc');

    // Chair shadow and player.
    ctx.ellipse(p.x, p.y + 35, 45, 5, '#91959c');
    player(ctx);

    // Spray plume: cubic-bezier cone with gradient fade along the direction.
    const spray = state.spray;
    if (spray.burst > 0) {
        const dx = spray.dir.x;
        const dy = spray.dir.y;
        const age = spray.burst / .32;
        const length = 95 * age;
        const spread = 34 * age;
        const nx = -dy;
        const ny = dx;
        const px = p.x;
        const py = p.y - 10;
        const tipX = px + dx * length;
        const tipY = py + dy * length;
        const rX = tipX + nx * spread;
        const rY = tipY + ny * spread;
        const lX = tipX - nx * spread;
        const lY = tipY - ny * spread;
        ctx.effectPath(
            [px, py],
            [
                // Outer right side: fan out from tip to far-right.
                [px + dx * length * .35 + nx * spread * .25,
                 py + dy * length * .35 + ny * spread * .25,
                 px + dx * length * .85 + nx * spread * .95,
                 py + dy * length * .85 + ny * spread * .95,
                 rX, rY],
                // Far end arc across the plume.
                [tipX + dx * 10, tipY + dy * 10,
                 tipX + dx * 10, tipY + dy * 10,
                 lX, lY],
                // Outer left side back to origin.
                [px + dx * length * .85 - nx * spread * .95,
                 py + dy * length * .85 - ny * spread * .95,
                 px + dx * length * .35 - nx * spread * .25,
                 py + dy * length * .35 - ny * spread * .25,
                 px, py],
            ],
            ctx.gradientFill(px, py, tipX, tipY, [
                [0, '#fffbe8f0'],
                [.5, '#f1ecd4a0'],
                [1, '#e3dcc000'],
            ], .4 + age * .6)
        );
        // Swirling droplet streak inside the plume for extra flow detail.
        const swirl = Math.sin(t * 20) * spread * .4;
        ctx.effectPath(
            [px + dx * 8, py + dy * 8],
            [[px + dx * length * .4 + nx * swirl,
              py + dy * length * .4 + ny * swirl,
              px + dx * length * .7 - nx * swirl,
              py + dy * length * .7 - ny * swirl,
              tipX - dx * 4, tipY - dy * 4]],
            ctx.gradientFill(px, py, tipX, tipY, [
                [0, '#ffffffe0'],
                [1, '#ffffff00'],
            ], .7 * age)
        );
    }
}
