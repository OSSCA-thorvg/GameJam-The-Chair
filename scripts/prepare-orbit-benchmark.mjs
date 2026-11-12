// Build a pure rendering baseline from Git; no baseline game code is added to the application.
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

const ref = process.argv[2] ?? 'e0fa593';
const checkout = await mkdtemp(join(tmpdir(), 'chair-render-baseline-'));
const archive = execFileSync('git', ['archive', '--format=tar', ref, 'src'], { maxBuffer: 16*1024*1024 });
execFileSync('tar', ['-x', '-C', checkout], { input: archive });
const output = new URL('.benchmark/', import.meta.url);
await mkdir(output, { recursive: true });
const entry = resolve(checkout, 'src/render/scene/orbit.ts');
const result = await build({ stdin: { contents: `export { drawOrbit } from ${JSON.stringify(entry)};`, resolveDir: checkout },
    bundle: true, write: false, format: 'esm', platform: 'browser' });
await writeFile(new URL('baseline.mjs', output), result.outputFiles[0].text);
console.log(`Baseline ${ref} ready. Open /scripts/orbit-render-benchmark.html through Vite.`);
