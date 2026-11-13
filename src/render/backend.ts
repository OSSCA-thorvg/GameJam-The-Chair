/** ThorVG backends this game uses. 이 게임이 쓰는 ThorVG 백엔드. */
export type ThorvgRenderer = 'gl' | 'sw';

/**
 * Picks the ThorVG backend. The GPU renderer (WebGL2) is several times faster than the single-threaded
 * software rasterizer, whose cost grows with every screen pixel, so `gl` is used whenever the browser
 * has hardware-backed WebGL2. `?renderer=sw|gl` forces one for debugging and comparisons.
 *
 * ThorVG 백엔드 선택. 하드웨어 WebGL2가 있으면 GPU 렌더러(gl), 없으면 소프트웨어 렌더러(sw).
 */
/** WebGL implementations that run on the CPU (no usable GPU, or a blocklisted one). */
const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|software|basic render driver|microsoft basic/i;

/** Whether a WebGL renderer string names a CPU implementation rather than a GPU. */
export function isSoftwareGl(rendererName: string) {
    return SOFTWARE_GL.test(rendererName);
}

export function chooseRenderer(hasWebGL2: boolean, requested: string | null): ThorvgRenderer {
    if (requested === 'sw') return 'sw';
    if (requested === 'gl') return 'gl';
    return hasWebGL2 ? 'gl' : 'sw';
}
