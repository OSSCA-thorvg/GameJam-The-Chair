import type { DrawCommand } from './types';

export type LayerInfo = {
    key: string;
    shapes: number;
    area: number;
    effects: string[];
};

export type RenderStats = {
    buildMs: number;
    syncMs: number;
    renderMs: number;
    gpuMs: number[];
    commands: number;
    topShapes: number;
    poolTop: number;
    texts: number;
    layers: number;
    layerSlots: number;
    layerShapes: number;
    parkedShapes: number;
    reorder: boolean;
    gaussianBlurs: number;
    motionBlurs: number;
    blurAmount: number;
    blurArea: number;
    masks: number;
    clips: number;
    layerList: LayerInfo[];
};

export type LayerOverrides = { hidden: Set<string>; flat: Set<string> };

export function createLayerOverrides(): LayerOverrides {
    return { hidden: new Set(), flat: new Set() };
}

export function applyLayerOverrides(
    commands: DrawCommand[],
    overrides: LayerOverrides | undefined,
): DrawCommand[] {
    if (!overrides || (!overrides.hidden.size && !overrides.flat.size)) {
        return commands;
    }
    const out: DrawCommand[] = [];
    for (const cmd of commands) {
        const key = cmd.layer?.key;
        if (key === undefined) {
            out.push(cmd);
        } else if (overrides.hidden.has(key)) {
            continue;
        }
        // Retained geometry needs its Scene transform to stay positioned.
        else if (overrides.flat.has(key) && !cmd.layer?.retained) {
            out.push({ ...cmd, layer: undefined });
        } else {
            out.push(cmd);
        }
    }
    return out;
}

export function effectScaleForArea(
    area: number,
    budget: number,
    minScale = 0.55,
): number {
    if (area <= 0 || budget <= 0 || area <= budget) {
        return 1;
    }
    return Math.max(Math.min(1, minScale), Math.sqrt(budget / area));
}

export function createRenderStats(): RenderStats {
    return {
        buildMs: 0,
        syncMs: 0,
        renderMs: 0,
        gpuMs: [],
        commands: 0,
        topShapes: 0,
        poolTop: 0,
        texts: 0,
        layers: 0,
        layerSlots: 0,
        layerShapes: 0,
        parkedShapes: 0,
        reorder: false,
        gaussianBlurs: 0,
        motionBlurs: 0,
        blurAmount: 0,
        blurArea: 0,
        masks: 0,
        clips: 0,
        layerList: [],
    };
}

export function resetRenderStats(stats: RenderStats): void {
    stats.buildMs = stats.syncMs = stats.renderMs = 0;
    stats.commands =
        stats.topShapes =
        stats.poolTop =
        stats.layers =
        stats.layerSlots =
            0;
    stats.layerShapes = stats.parkedShapes = stats.texts = 0;
    stats.reorder = false;
    stats.gaussianBlurs =
        stats.motionBlurs =
        stats.blurAmount =
        stats.blurArea =
            0;
    stats.masks = stats.clips = 0;
    stats.layerList = [];
    stats.gpuMs = [];
}
