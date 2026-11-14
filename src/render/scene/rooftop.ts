import { STAGE_THREE } from '../../game/stages/rooftop/data';
import type { RenderCtx } from '../context';
import { checkpointFlag } from './decor';
import { player } from './player';
import { sprayPlume } from './spray';
import { ascentClouds } from './clouds';
import { rooftopCeilingLight, rooftopSky, rooftopWalls, rooftopPlatforms } from './rooftop-art';
import { rooftopDuct, rooftopVents } from './rooftop-duct';
import { rooftopGraphSign } from './rooftop-graph';
import { employeeBoard } from './employee-board';
import { personalBox } from './personal-box';
import { rooftopSprayHint } from './control-hints';

export function drawRooftop(ctx: RenderCtx) {
    const state = ctx.state;
    const p = ctx.p;

    ctx.commands = [];
    ctx.ox = ctx.oy = ctx.rotation = 0;

    rooftopSky(ctx);
    ctx.retainedGroup('rooftop-walls', { left: -400, top: -650, right: 1807, bottom: 420 }, () => rooftopWalls(ctx));
    if (ctx.visible({ left: 35, top: 45, right: 230, bottom: 220 }, 40)) employeeBoard(ctx);
    if (ctx.visible({ left: 1200, top: 300, right: 1370, bottom: 430 }, 80)) personalBox(ctx);
    rooftopPlatforms(ctx);
    if (ctx.visible({ left: 1040, top: -720, right: 2050, bottom: 500 }, 100)) {
        rooftopDuct(ctx);
        rooftopVents(ctx);
    }
    if (ctx.visible({ left: 2260, top: -1060, right: 3050, bottom: 50 }, 120)) rooftopGraphSign(ctx);
    if (state.firstFlight.kind === 'flight') ascentClouds(ctx);

    // Empty entrance recess sits behind the hinged door and the existing player.
    const entranceVisible = ctx.visible({ left: 35, top: 200, right: 215, bottom: 430 }, 60);
    if (entranceVisible) {
        ctx.rect(46, 221, 159, 199, '#71869d');
        ctx.rect(54, 229, 143, 191, '#23384f');
        ctx.gradientPolygon([[61, 236], [190, 236], [190, 420], [61, 420]],
            ctx.gradientFill(0, 236, 0, 420, [[0, '#1c2e45'], [1, '#445e78']]));
        ctx.rod(62, 417, 195, 417, 5, '#b8b9ad');
    }

    // Pictograms introduce the controls where they are useful.
    if (!state.hasExtinguisher && ctx.visible({ left: 560, top: 270, right: 640, bottom: 390 }, 40)) {
        const pickup = STAGE_THREE.pickup;
        ctx.rect(pickup.x - 17, pickup.y - 82, 34, 65, '#566477');
        ctx.rect(pickup.x - 9, pickup.y - 74, 18, 43, '#b75f4a');
        ctx.ellipse(pickup.x, pickup.y - 73, 9, 6, '#c7765c');
        ctx.rect(pickup.x - 7, pickup.y - 60, 14, 12, '#eee5cd');
        ctx.rod(pickup.x, pickup.y - 77, pickup.x, pickup.y - 84, 4, '#394657');
        ctx.rod(pickup.x - 3, pickup.y - 84, pickup.x + 12, pickup.y - 84, 3, '#394657');
    }

    for (let i = 1; i < STAGE_THREE.checkpoints.length; i++) {
        const mark = STAGE_THREE.checkpoints[i];
        if (ctx.visible({ left: mark.x - 35, top: mark.y - 80, right: mark.x + 35, bottom: mark.y + 40 }, 30)) {
            checkpointFlag(ctx, mark.x, mark.y + 28, state.checkpoint >= i);
        }
    }

    if (state.ground) ctx.ellipse(p.x, p.y + 28, 45, 5, '#414d6455');
    const behindDoor = state.rooftopEntrance.kind === 'opening' && state.rooftopEntrance.age < STAGE_THREE.entrance.emergeEnd;
    if (!behindDoor && entranceVisible) entranceDoor(ctx);
    player(ctx);
    if (behindDoor && entranceVisible) entranceDoor(ctx);
    if (entranceVisible) rooftopCeilingLight(ctx);

    sprayPlume(ctx);
    airSprayGauge(ctx);
    rooftopSprayHint(ctx);
}

// Three charges above the chair: one goes dark per burst in the air, all refill on touching down.
function airSprayGauge(ctx: RenderCtx) {
    const state = ctx.state;
    if (!state.hasExtinguisher || state.firstFlight.kind !== 'course' || (state.ground && state.airSprays === 0)) return;
    const left = STAGE_THREE.airSprayLimit - state.airSprays;
    const x = ctx.p.x, y = ctx.p.y - 112;
    ctx.rect(x - 24, y - 7, 48, 14, '#1d2c3fa8');
    for (let i = 0; i < STAGE_THREE.airSprayLimit; i++) {
        const cx = x - 14 + i * 14;
        ctx.ellipse(cx, y, 4.6, 4.6, i < left ? '#fff2ce' : '#5d6d82');
        if (i < left) ctx.ellipse(cx - 1.3, y - 1.4, 1.6, 1.4, '#ffffff');
    }
}


function entranceDoor(ctx: RenderCtx) {
    const entrance = ctx.state.rooftopEntrance;
    const timing = STAGE_THREE.entrance;
    const age = entrance.kind === 'opening' ? entrance.age : timing.duration;
    const closing = Math.max(0, Math.min(1, (age - timing.closeAt) / timing.closeDuration));
    const progress = Math.min(1, age / timing.openDuration) * (1 - closing);
    const eased = progress * progress * (3 - 2 * progress);
    const angle = eased * Math.PI * .46;
    const hingeX = 54, top = 229, bottom = 420;
    const width = Math.cos(angle) * 143;
    const depth = Math.sin(angle) * 32;
    const edge = hingeX + width;
    // The projecting edge follows the same hinge as the door face.
    ctx.polygon([[hingeX, top], [edge, top + depth], [edge, bottom + depth], [hingeX, bottom]], '#aab2ba');
    ctx.polygon([[edge, top + depth], [edge + 5, top + depth - 2], [edge + 5, bottom + depth - 2], [edge, bottom + depth]], '#626f80');
    const panelX = hingeX + width * .12;
    const panelRight = hingeX + width * .88;
    ctx.polygon([[panelX, top + 18 + depth * .12], [panelRight, top + 18 + depth * .88],
        [panelRight, bottom - 18 + depth * .88], [panelX, bottom - 18 + depth * .12]], '#8c99a9');
    for (const y of [top + 27, bottom - 29]) ctx.rod(hingeX, y, hingeX, y + 15, 5, '#d1d1c6');
    const handleX = hingeX + width * .8;
    const handleY = top + 104 + depth * .8;
    ctx.ellipse(handleX, handleY, 3, 4, '#4a576a');
    ctx.rod(handleX, handleY, handleX - Math.max(4, width * .1), handleY, 3, '#e3d4ae');
}
