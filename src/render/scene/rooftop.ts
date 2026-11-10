import { STAGE_THREE } from '../../game/stage3';
import type { RenderCtx } from '../context';
import { checkpointFlag } from './decor';
import { player } from './player';
import { sprayPlume } from './spray';
import { ascentClouds } from './clouds';
import { rooftopSky, rooftopWalls, rooftopPlatforms } from './rooftop-art';
import { rooftopDuct } from './rooftop-duct';

export function drawRooftop(ctx: RenderCtx) {
    const state = ctx.state;
    const p = ctx.p;

    ctx.commands = [];
    ctx.ox = ctx.oy = ctx.rotation = 0;

    rooftopSky(ctx);
    rooftopWalls(ctx);
    rooftopPlatforms(ctx);
    rooftopDuct(ctx);
    if (state.firstFlight.kind === 'flight') ascentClouds(ctx);

    // Empty entrance recess sits behind the hinged door and the existing player.
    ctx.rect(46, 221, 159, 199, '#71869d');
    ctx.rect(54, 229, 143, 191, '#23384f');
    ctx.gradientPolygon([[61, 236], [190, 236], [190, 420], [61, 420]],
        ctx.gradientFill(0, 236, 0, 420, [[0, '#1c2e45'], [1, '#445e78']]));
    ctx.rod(62, 417, 195, 417, 5, '#b8b9ad');

    // Pictograms introduce the controls where they are useful.
    if (!state.hasExtinguisher) {
        const pickup = STAGE_THREE.pickup;
        ctx.rect(pickup.x - 17, pickup.y - 82, 34, 65, '#566477');
        ctx.rect(pickup.x - 9, pickup.y - 74, 18, 43, '#b75f4a');
        ctx.ellipse(pickup.x, pickup.y - 73, 9, 6, '#c7765c');
        ctx.rect(pickup.x - 7, pickup.y - 60, 14, 12, '#eee5cd');
        ctx.rod(pickup.x, pickup.y - 77, pickup.x, pickup.y - 84, 4, '#394657');
        ctx.rod(pickup.x - 3, pickup.y - 84, pickup.x + 12, pickup.y - 84, 3, '#394657');
    }
    if (p.x < 790) {
        ctx.label('Space', STAGE_THREE.pickup.x, STAGE_THREE.pickup.y - 97, 20, '#f0dfb9');
    }

    // Checkpoint flags.
    for (let i = 1; i < STAGE_THREE.checkpoints.length; i++) {
        const mark = STAGE_THREE.checkpoints[i];
        checkpointFlag(ctx, mark.x, mark.y + 28, state.checkpoint >= i);
    }

    if (p.x > 2100 && state.firstFlight.kind === 'course') {
        ctx.label('Space × 3', 2350, -228, 18, '#ffe2a8');
        for (let i = 0; i < 3; i++) ctx.ellipse(2330 + i * 20, -212, 4, 4,
            i < state.firstFlight.verticalShots ? '#fff2ce' : '#778ba4');
    }

    // Chair shadow and player.
    if (state.ground) ctx.ellipse(p.x, p.y + 28, 45, 5, '#414d6455');
    const behindDoor = state.rooftopEntrance.kind === 'opening' && state.rooftopEntrance.age < STAGE_THREE.entrance.emergeEnd;
    if (!behindDoor) entranceDoor(ctx);
    player(ctx);
    if (behindDoor) entranceDoor(ctx);


    sprayPlume(ctx);
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
