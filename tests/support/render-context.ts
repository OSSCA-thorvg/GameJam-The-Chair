import { createRenderCtx as createFrame, createRenderResources } from '../../src/render/context';
import { createGame } from '../../src/game/game';
import { createEffects } from '../../src/render/effects';
export function createRenderCtx(bg: CanvasRenderingContext2D) {
    return createFrame(createRenderResources(bg), createGame().getSnapshot(), createEffects().snapshot());
}
