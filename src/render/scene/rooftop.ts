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

    // Sky backdrop fading into a rooftop horizon.
    ctx.rect(cam, -vertical, VW, H / scale, '#8ba6bd');
    ctx.rect(cam, 120, VW, 180, '#a2b8c7');
    for (let x = Math.floor(cam / 220) * 220; x < cam + VW + 220; x += 220) {
        ctx.rect(x + 40, 110, 50, 170, '#6b7e8e');
        ctx.rect(x + 100, 140, 70, 140, '#7b8e9e');
        ctx.rect(x + 180, 90, 36, 190, '#5e707f');
    }

    // Floor polygons.
    for (const ob of solids) ctx.polygon(ob.p.map(v => [v.x, v.y]), C.floor);

    // Mechanical room sign on the first segment.
    ctx.rect(300, 330, 180, 24, '#5e6b7d');
    ctx.label('기계실', 390, 348, 13, '#f0eddc');

    // Gap edge markers between first and second ground segment.
    ctx.rod(900, 410, 900, 440, 5, '#c3b375');
    ctx.rod(1020, 410, 1020, 440, 5, '#c3b375');

    // Vertical shaft wall decoration.
    ctx.rect(1500, 280, 400, 10, '#5a6471');
    for (let x = 1510; x < 1890; x += 40) ctx.rect(x, 285, 8, 8, '#747d8b');

    // Fan housings and animated blades.
    for (const fan of STAGE_THREE.fans) {
        const sine = Math.sin(t * Math.PI * 2 / fan.period + fan.phase);
        const active = sine > .1;
        const power = Math.max(0, sine);
        const vents = fan.y;
        // Housing on floor.
        ctx.rect(fan.x - fan.width / 2, vents - 8, fan.width, 14, '#525a69');
        ctx.rect(fan.x - fan.width / 2 + 4, vents - 5, fan.width - 8, 8, '#747d8b');
        // Blades.
        const angle = t * (active ? 18 : 4);
        for (let i = 0; i < 3; i++) {
            const a = angle + i * Math.PI * 2 / 3;
            ctx.rod(fan.x - Math.cos(a) * 24, vents - 1 - Math.sin(a) * 8, fan.x + Math.cos(a) * 24, vents - 1 + Math.sin(a) * 8, 5, '#d4d0bc');
        }
        ctx.ellipse(fan.x, vents - 1, 6, 6, '#333845');
        // Wind column above fan.
        if (power > .05) {
            const h = fan.height * power;
            for (let i = 0; i < 5; i++) {
                const yOff = ((t * 200 + i * 70) % h);
                const w = fan.width * .22 * (.6 + power * .4);
                ctx.ellipse(fan.x + (i % 2 ? 10 : -10), vents - 10 - yOff, w, 5, '#dee6ed' + Math.round(80 + power * 100).toString(16));
            }
            ctx.rod(fan.x - fan.width / 2 + 10, vents - 14, fan.x + fan.width / 2 - 10, vents - 14, 2, '#eef3f5');
        }
    }

    // Checkpoint flags.
    for (let i = 1; i < STAGE_THREE.checkpoints.length; i++) {
        const mark = STAGE_THREE.checkpoints[i];
        checkpointFlag(ctx, mark.x, mark.y + 28, state.checkpoint >= i);
    }

    // Goal: sky-door at rooftop.
    ctx.rect(GOAL - 35, 55, 106, 130, '#4b586b');
    ctx.rect(GOAL - 27, 63, 90, 115, '#c4d2d6');
    ctx.rect(GOAL - 31, 32, 98, 23, '#718e7b');
    ctx.label('옥상 →', GOAL + 18, 49, 13, '#f0eddc');

    // Chair shadow and player.
    ctx.ellipse(p.x, p.y + 35, 45, 5, '#91959c');
    player(ctx);

    // Spray plume in player direction (short burst after press).
    const spray = state.spray;
    if (spray.burst > 0) {
        const dx = spray.dir.x;
        const dy = spray.dir.y;
        for (let i = 0; i < 6; i++) {
            const age = spray.burst / .32;
            const r = (1 - i / 7) * 16 * age;
            const dist = (i + 1) * 9 * age;
            ctx.ellipse(p.x + dx * dist, p.y + dy * dist - 10, r, r * .9, '#f7f2e3' + Math.round(80 + age * 140).toString(16).padStart(2, '0'));
        }
    }
}
