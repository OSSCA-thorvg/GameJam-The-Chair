import { init } from '@thorvg/webcanvas';
import wasmUrl from '@thorvg-wasm?url';
import signFontUrl from '../assets/fonts/BlackHanSans-sign.ttf?url';
import labelFontUrl from '../assets/fonts/DoHyeon-label.ttf?url';
import speechFontUrl from '../assets/fonts/Jua-speech.ttf?url';
import { chooseRenderer, isSoftwareGl, type ThorvgRenderer } from './backend';
import { LABEL_FONT, SIGN_FONT, SPEECH_FONT } from './fonts';

export type { ThorvgRenderer } from './backend';

let engine: ReturnType<typeof init> | null = null;
let chosen: ThorvgRenderer | null = null;

// Chromium may return SwiftShader even with failIfMajorPerformanceCaveat; reject software WebGL.
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

export function thorvgRenderer(): ThorvgRenderer {
    chosen ??= chooseRenderer(hardwareWebGL2(), requestedRenderer());
    return chosen;
}

const FONTS = [[SIGN_FONT, signFontUrl], [LABEL_FONT, labelFontUrl], [SPEECH_FONT, speechFontUrl]] as const;

async function loadFont(TVG: Awaited<ReturnType<typeof init>>, name: string, url: string) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${name} ${res.status}`);
        const data = new Uint8Array(await res.arrayBuffer());
        TVG.Font.load(name, data, { type: 'ttf' });
        const face = new FontFace(name, data.slice().buffer);
        document.fonts.add(await face.load());
    } catch (e) {
        console.warn('font unavailable', name, e);
    }
}

export function loadThorvg() {
    engine ??= init({ renderer: thorvgRenderer(), locateFile: () => wasmUrl }).then(async TVG => {
        await Promise.all(FONTS.map(([name, url]) => loadFont(TVG, name, url)));
        return TVG;
    }).catch(error => {
        engine = null;
        throw error;
    });
    return engine;
}
