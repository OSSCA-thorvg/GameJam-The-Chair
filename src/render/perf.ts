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

export function applyLayerOverrides(commands: DrawCommand[], overrides: LayerOverrides | undefined): DrawCommand[] {
    if (!overrides || (!overrides.hidden.size && !overrides.flat.size)) return commands;
    const out: DrawCommand[] = [];
    for (const cmd of commands) {
        const key = cmd.layer?.key;
        if (key === undefined) out.push(cmd);
        else if (overrides.hidden.has(key)) continue;
        // Retained geometry needs its Scene transform to stay positioned.
        else if (overrides.flat.has(key) && !cmd.layer?.retained) out.push({ ...cmd, layer: undefined });
        else out.push(cmd);
    }
    return out;
}

export function effectScaleForArea(area: number, budget: number, minScale = .55) {
    if (area <= 0 || budget <= 0 || area <= budget) return 1;
    return Math.max(Math.min(1, minScale), Math.sqrt(budget / area));
}

export function createRenderStats(): RenderStats {
    const stats = {} as RenderStats;
    resetRenderStats(stats);
    return stats;
}

export function resetRenderStats(stats: RenderStats) {
    stats.buildMs = stats.syncMs = stats.renderMs = 0;
    stats.commands = stats.topShapes = stats.poolTop = stats.layers = stats.layerSlots = 0;
    stats.layerShapes = stats.parkedShapes = stats.texts = 0;
    stats.reorder = false;
    stats.gaussianBlurs = stats.motionBlurs = stats.blurAmount = stats.blurArea = 0;
    stats.masks = stats.clips = 0;
    stats.layerList = [];
    stats.gpuMs = [];
}
