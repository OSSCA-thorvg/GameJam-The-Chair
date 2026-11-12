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
};

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
}
