export type ThorvgRenderer = 'gl' | 'sw';

const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|software|basic render driver|microsoft basic/i;

export function isSoftwareGl(rendererName: string) {
    return SOFTWARE_GL.test(rendererName);
}

export function chooseRenderer(hasWebGL2: boolean, requested: string | null): ThorvgRenderer {
    if (requested === 'sw') return 'sw';
    if (requested === 'gl') return 'gl';
    return hasWebGL2 ? 'gl' : 'sw';
}
