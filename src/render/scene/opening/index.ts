import { drawBubbles } from './bubble';
import { drawClock } from './clock';
import {
    drawChairMood,
    drawOfficeLight,
    drawRageFlash,
    drawSunbeams,
} from './mood';
import { OPENING_BEATS } from './timeline';
import { drawWorld } from '../office/world';

import type { OpeningFrame } from './timeline';
import type { RenderCtx } from '../../context';

export {
    openingFrame,
    openingState,
    openingFocusY,
    OPENING_BEATS,
    OPENING_DURATION,
    type OpeningFrame,
} from './timeline';

export function drawOpening(ctx: RenderCtx, frame: OpeningFrame): void {
    ctx.commands = [];
    if (frame.shot === 'office') {
        ctx.chairPose = {
            backrest: frame.chair.backrest,
            riderPop: frame.chair.riderPop,
            shiver: frame.chair.shiver,
        };
        ctx.cutscene = true;
        ctx.windowDusk = frame.dusk;
        drawWorld(ctx);
        ctx.cutscene = false;
        ctx.windowDusk = 1;
        ctx.chairPose = { backrest: 0, riderPop: 0, shiver: 0 };
        drawSunbeams(ctx, frame);
        drawOfficeLight(ctx, frame);
        drawChairMood(ctx, frame);
        drawRageFlash(ctx, frame, OPENING_BEATS.rage);
    }
    if (frame.iris !== null && frame.iris < 1) {
        drawClock(ctx, frame);
    }
    if (frame.shot === 'office') {
        drawBubbles(ctx, frame);
    }
}
