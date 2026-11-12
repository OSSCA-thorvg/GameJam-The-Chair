import type { RenderCtx } from '../../context';
import { drawWorld } from '../world';
import { drawBubbles } from './bubble';
import { drawClock } from './clock';
import { drawChairMood, drawOfficeLight, drawRageFlash, drawSunbeams } from './mood';
import { OPENING_BEATS, type OpeningFrame } from './timeline';

export { openingFrame, openingState, openingFocusY, OPENING_BEATS, OPENING_DURATION, type OpeningFrame } from './timeline';

/** One cutscene frame: the office (lit for the hour) and/or the clock cover, then the speech bubbles. */
export function drawOpening(ctx: RenderCtx, frame: OpeningFrame) {
    ctx.commands = [];
    if (frame.shot === 'office') {
        drawWorld(ctx);
        drawSunbeams(ctx, frame);
        drawOfficeLight(ctx, frame);
        drawChairMood(ctx, frame);
        drawRageFlash(ctx, frame, OPENING_BEATS.rage);
    }
    if (frame.iris !== null && frame.iris < 1) drawClock(ctx, frame);
    if (frame.shot === 'office') drawBubbles(ctx, frame);
}
