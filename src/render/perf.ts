import type { DrawCommand } from './types';

/** One layer scene drawn this frame. 이번 프레임에 그린 layer 하나. */
export type LayerInfo = {
    /** `LayerSpec.key`; a key used twice in one frame appears twice. */
    key: string;
    /** Children drawn this frame (off-canvas commands excluded). */
    shapes: number;
    /** On-canvas bounding-box area of the children, CSS px². */
    area: number;
    /** Short effect tags: opacity, blend, blur, motion blur, clip, mask. */
    effects: string[];
};

/**
 * Per-frame render counters for the developer performance overlay. Only filled while the overlay is on;
 * the game core never sees them. Times are milliseconds from `performance.now()`.
 * 개발자 성능 오버레이용 프레임별 렌더 카운터. 오버레이가 켜졌을 때만 채운다.
 */
export type RenderStats = {
    /** Scene functions turning the snapshot into `DrawCommand[]`. 장면 함수 시간. */
    buildMs: number;
    /** Copying commands onto pooled ThorVG shapes and scenes (JS → WASM calls). 풀 객체 동기화 시간. */
    syncMs: number;
    /** `Canvas.update().render()` (or the Canvas2D fallback paint). 래스터화 시간. */
    renderMs: number;
    /** System-font label canvas. 라벨 캔버스 시간. */
    labelsMs: number;
    /**
     * GPU time (WebGL2 timer queries) of earlier frames whose results arrived this frame, oldest first.
     * Empty with the software renderer or without timer-query support. 이번 프레임에 도착한 GPU 시간.
     */
    gpuMs: number[];
    commands: number;
    /** Plain shapes drawn this frame / pooled in total. 이번 프레임 사용 / 풀 전체. */
    topShapes: number;
    poolTop: number;
    /** Layer scenes drawn this frame / pooled in total. */
    layers: number;
    layerSlots: number;
    /** Shapes inside the drawn layers, including parked spares. */
    layerShapes: number;
    parkedShapes: number;
    /** Whether the canvas paint order was rebuilt (`tvg.remove()` + `tvg.add()`) this frame. */
    reorder: boolean;
    gaussianBlurs: number;
    motionBlurs: number;
    /** Sum of gaussian sigma and motion-blur distance. */
    blurAmount: number;
    /** On-canvas area (CSS px²) of blurred layers; the SW engine's blur cost follows it. */
    blurArea: number;
    masks: number;
    clips: number;
    /** Every layer drawn this frame, in paint order. */
    layerList: LayerInfo[];
};

/**
 * Debug-only layer switches, by `LayerSpec.key`: `hidden` layers are not drawn, `flat` layers draw their
 * commands as plain shapes (no scene, so no opacity, blend, blur, clip or mask). Comparing frame times
 * with a layer on, flattened and hidden shows what that layer costs.
 * 디버그 전용 layer 스위치. hidden은 그리지 않고, flat은 scene 없이 일반 shape로 그린다.
 */
export type LayerOverrides = { hidden: Set<string>; flat: Set<string> };

export function createLayerOverrides(): LayerOverrides {
    return { hidden: new Set(), flat: new Set() };
}

/** The commands with layer overrides applied; the same array when nothing is overridden. */
export function applyLayerOverrides(commands: DrawCommand[], overrides: LayerOverrides | undefined): DrawCommand[] {
    if (!overrides || (!overrides.hidden.size && !overrides.flat.size)) return commands;
    const out: DrawCommand[] = [];
    for (const cmd of commands) {
        const key = cmd.layer?.key;
        if (key === undefined) out.push(cmd);
        else if (overrides.hidden.has(key)) continue;
        else if (overrides.flat.has(key)) out.push({ ...cmd, layer: undefined });
        else out.push(cmd);
    }
    return out;
}

export function createRenderStats(): RenderStats {
    const stats = {} as RenderStats;
    resetRenderStats(stats);
    return stats;
}

export function resetRenderStats(stats: RenderStats) {
    stats.buildMs = stats.syncMs = stats.renderMs = stats.labelsMs = 0;
    stats.commands = stats.topShapes = stats.poolTop = stats.layers = stats.layerSlots = 0;
    stats.layerShapes = stats.parkedShapes = 0;
    stats.reorder = false;
    stats.gaussianBlurs = stats.motionBlurs = stats.blurAmount = stats.blurArea = 0;
    stats.masks = stats.clips = 0;
    stats.layerList = [];
    stats.gpuMs = [];
}
