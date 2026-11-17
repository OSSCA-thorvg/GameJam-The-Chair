import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

export default defineConfig({
    resolve: {
        alias: [
            {
                find: /^@thorvg-wasm(?=\?|$)/,
                replacement: fileURLToPath(
                    new URL(
                        './thorvg.wasm',
                        import.meta.resolve('@thorvg/webcanvas'),
                    ),
                ),
            },
        ],
    },
    build: {
        rollupOptions: {
            input: ['index.html', 'preview.html', 'replay.html'],
        },
    },
});
