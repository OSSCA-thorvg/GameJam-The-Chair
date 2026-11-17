import { createGame } from '../../src/game/game';
import {
    createRenderCtx as createFrame,
    createRenderResources,
} from '../../src/render/context';
import { createEffects } from '../../src/render/effects';
export function createRenderCtx(
    bg: CanvasRenderingContext2D,
): ReturnType<typeof createFrame> {
    return createFrame(
        createRenderResources(bg),
        createGame().getSnapshot(),
        createEffects().snapshot(),
    );
}
