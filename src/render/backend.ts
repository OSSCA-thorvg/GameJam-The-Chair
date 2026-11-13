/** ThorVG backends this game uses. */
export type ThorvgRenderer = 'gl' | 'sw';

/** WebGL implementations that run on the CPU (no usable GPU, or a blocklisted one). */
const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|software|basic render driver|microsoft basic/i;

/** Whether a WebGL renderer string names a CPU implementation rather than a GPU. */
export function isSoftwareGl(rendererName: string) {
    return SOFTWARE_GL.test(rendererName);
}

/**
 * Picks the ThorVG backend. The GPU renderer (WebGL2) is several times faster than the single-threaded
 * software rasterizer, whose cost grows with every screen pixel, so `gl` is used whenever the browser
 * has hardware-backed WebGL2. `?renderer=sw|gl` forces one for debugging and comparisons.
 */
export function chooseRenderer(hasWebGL2: boolean, requested: string | null): ThorvgRenderer {
    if (requested === 'sw') return 'sw';
    if (requested === 'gl') return 'gl';
    return hasWebGL2 ? 'gl' : 'sw';
}
