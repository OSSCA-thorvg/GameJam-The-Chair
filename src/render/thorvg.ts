import { init } from '@thorvg/webcanvas';
import wasmUrl from '../../node_modules/@thorvg/webcanvas/dist/thorvg.wasm?url';
import { chooseRenderer, isSoftwareGl, type ThorvgRenderer } from './backend';

export type { ThorvgRenderer } from './backend';

let engine: ReturnType<typeof init> | null = null;
let chosen: ThorvgRenderer | null = null;

/**
 * Whether WebGL2 runs on the GPU. Without a usable GPU, browsers emulate WebGL on the CPU (SwiftShader,
 * llvmpipe), which is far slower than ThorVG's own software renderer, so that counts as unavailable.
 * `failIfMajorPerformanceCaveat` alone is not enough: Chromium still hands out SwiftShader contexts.
 */
function hardwareWebGL2() {
    try {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
        if (!gl) return false;
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return !isSoftwareGl(name);
    } catch {
        return false;
    }
}

function requestedRenderer() {
    try {
        return new URLSearchParams(location.search).get('renderer');
    } catch {
        return null;
    }
}

/** The backend ThorVG was (or will be) started with. */
export function thorvgRenderer(): ThorvgRenderer {
    chosen ??= chooseRenderer(hardwareWebGL2(), requestedRenderer());
    return chosen;
}

export function loadThorvg() {
    engine ??= init({ renderer: thorvgRenderer(), locateFile: () => wasmUrl });
    return engine;
}
