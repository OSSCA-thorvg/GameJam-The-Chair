#!/usr/bin/env node
// Rebuilds the subset TTFs in src/assets/fonts that ThorVG Text draws with.
// Keeps printable ASCII plus every character of the i18n messages and of the Korean literals in src/render.
// Needs fontTools (`pip install fonttools`) for pyftsubset. Run after changing in-game copy:
//   node scripts/subset-fonts.mjs
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { loadSource } from '../tests/support/load.mjs';

const FONTS = [
    { file: 'BlackHanSans-sign.ttf', source: 'blackhansans/BlackHanSans-Regular.ttf' },
    { file: 'DoHyeon-label.ttf', source: 'dohyeon/DoHyeon-Regular.ttf' },
    { file: 'Jua-speech.ttf', source: 'jua/Jua-Regular.ttf' },
];
const ORIGIN = 'https://github.com/google/fonts/raw/main/ofl/';

const { allMessageText } = await loadSource(`
    import { messageTexts } from './src/i18n';
    export const allMessageText = () => messageTexts().join('');
`);

function walk(dir) {
    return readdirSync(dir).flatMap(name => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : [];
    });
}
const literals = walk('src/render').map(path => readFileSync(path, 'utf8').match(/[ㄱ-ㆎ가-힣]/g)?.join('') ?? '').join('');
let ascii = '';
for (let c = 0x20; c < 0x7f; c++) ascii += String.fromCharCode(c);
const text = [...new Set(ascii + allMessageText() + literals)].filter(c => c.trim()).join('') + ' ';

const work = mkdtempSync(join(tmpdir(), 'chair-fonts-'));
const textFile = join(work, 'text.txt');
writeFileSync(textFile, text);
for (const font of FONTS) {
    const source = join(work, font.file);
    const res = await fetch(ORIGIN + font.source);
    if (!res.ok) throw new Error(`${font.source}: ${res.status}`);
    writeFileSync(source, new Uint8Array(await res.arrayBuffer()));
    const out = join('src/assets/fonts', font.file);
    const run = spawnSync('pyftsubset', [source, `--text-file=${textFile}`, `--output-file=${out}`, '--no-hinting', '--layout-features=kern'], { stdio: 'inherit' });
    if (run.status !== 0) throw new Error(`pyftsubset failed for ${font.file}`);
    console.log(`${out}: ${statSync(out).size} bytes`);
}
