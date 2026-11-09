import { init } from '@thorvg/webcanvas';
import wasmUrl from '../../node_modules/@thorvg/webcanvas/dist/thorvg.wasm?url';

let engine: ReturnType<typeof init> | null = null;

export function loadThorvg() {
    engine ??= init({ renderer: 'sw', locateFile: () => wasmUrl });
    return engine;
}
