// Bundles TypeScript sources with esbuild and imports them in Node tests.
// bundled(options): any esbuild options (entryPoints or stdin); load(path): one source file.
// Results are cached per test process, so files that load the same module build it once.
import { build } from 'esbuild';

const cache = new Map();
const DEFAULTS = { bundle: true, write: false, platform: 'node', format: 'esm' };

export function bundled(options) {
    const key = JSON.stringify(options);
    if (!cache.has(key)) {
        cache.set(key, build({ ...DEFAULTS, ...options })
            .then(result => import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)));
    }
    return cache.get(key);
}

export const load = path => bundled({ entryPoints: [path] });

/** Re-exports the given lines (e.g. "export { createGame } from './src/game/game';") as one bundle. */
export const loadSource = contents => bundled({ stdin: { contents, resolveDir: process.cwd() } });
