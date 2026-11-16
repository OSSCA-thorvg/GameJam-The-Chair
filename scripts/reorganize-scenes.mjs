import { execFileSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    renameSync,
    writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const scene = 'src/render/scene';
const groups = {
    office: [
        'world',
        'cleaning',
        'water',
        'monitor',
        'urgent-copier',
        'window-view',
        'skyline',
    ],
    building: [
        'building',
        'building-bubble',
        'building-workers',
        'dispatch-room',
        'employee-board',
        'express',
        'meeting-doors',
        'meeting-room',
        'orientation',
    ],
    rooftop: [
        'rooftop',
        'rooftop-art',
        'rooftop-duct',
        'rooftop-graph',
        'graph-target',
    ],
    sky: [
        'sky',
        'clouds',
        'sky-camera',
        'sky-course-art',
        'sky-course-decor',
        'sky-departure',
        'sky-ending-art',
        'sky-gear',
        'sky-office-workers',
        'sky-player-glasses',
        'sky-player-hair',
        'sky-promotion-cake',
        'sky-reveal',
        'sky-robot-parrot',
        'sky-wind-response',
        'sky-wind',
    ],
    orbit: [
        'orbit',
        'orbit-atmosphere',
        'orbit-earth',
        'orbit-ending',
        'orbit-flight',
        'orbit-heights',
        'orbit-reaction',
        'orbit-robot-bird',
        'orbit-satellite-light',
        'orbit-shot',
        'orbit-viewfinder',
        'orbit-watch',
    ],
    player: ['player', 'player-art', 'player-chair', 'player-stains'],
    'personal-box': ['personal-box', 'personal-box-badge'],
    shared: [
        'attendance-bubble',
        'cctv-models',
        'ceiling-cctv',
        'control-hints',
        'decor',
        'keycap',
        'talk',
        'title',
    ],
    effects: ['death-burst', 'focus-vignette', 'spray'],
};
const moves = new Map();
for (const [group, names] of Object.entries(groups)) {
    for (const name of names) {
        const basename =
            name === group
                ? 'index'
                : name.replace(new RegExp(`^${group}-`), '');
        moves.set(`${scene}/${name}.ts`, `${scene}/${group}/${basename}.ts`);
    }
}
moves.set(`${scene}/sky-projection.ts`, `${scene}/shared/projection.ts`);
moves.set(`${scene}/cloud-art.ts`, `${scene}/shared/cloud-art.ts`);
for (const [source, destination] of moves) {
    if (
        !existsSync(resolve(root, source)) &&
        !existsSync(resolve(root, destination))
    ) {
        throw new Error(`Missing both ${source} and ${destination}.`);
    }
}
const pending = [...moves].filter(([source]) =>
    existsSync(resolve(root, source)),
);
if (!pending.length) {
    console.log('Scene files are already organized.');
    process.exit(0);
}
for (const [source, destination] of pending) {
    if (existsSync(resolve(root, destination))) {
        throw new Error(
            `Both ${source} and ${destination} exist; refusing to overwrite.`,
        );
    }
}
const tracked = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
})
    .split('\0')
    .filter(Boolean);
const modulePath = (file) => file.replace(/\.ts$/, '').replace(/\/index$/, '');
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let rewritten = 0;
for (const file of tracked) {
    if (
        file === 'scripts/reorganize-scenes.mjs' ||
        !/\.(ts|mjs|js|md|json)$/.test(file)
    ) {
        continue;
    }
    const absolute = resolve(root, file);
    if (!existsSync(absolute)) continue;
    const destination = moves.get(file) ?? file;
    const original = readFileSync(absolute, 'utf8');
    let source = original.replace(
        /(['"])(\.{1,2}\/[^'"\r\n]+)\1/g,
        (match, quote, specifier) => {
            const target = resolve(dirname(absolute), specifier);
            const oldTarget = [
                target,
                `${target}.ts`,
                `${target}/index.ts`,
                `${target}.mjs`,
            ].find(existsSync);
            if (!oldTarget) return match;
            const targetFile = relative(root, oldTarget);
            const newTarget = moves.get(targetFile) ?? targetFile;
            if (destination === file && newTarget === targetFile) return match;
            let newSpecifier = relative(
                dirname(resolve(root, destination)),
                resolve(root, newTarget),
            );
            if (!specifier.endsWith('.ts')) {
                newSpecifier = modulePath(newSpecifier);
            }
            if (!newSpecifier.startsWith('.')) {
                newSpecifier = `./${newSpecifier}`;
            }
            return `${quote}${newSpecifier}${quote}`;
        },
    );
    for (const [oldFile, newFile] of moves) {
        source = source.replaceAll(oldFile, newFile);
        const pattern = new RegExp(
            `${escape(oldFile.replace(/\.ts$/, ''))}(?=$|[.'\"\x60\\s)])`,
            'g',
        );
        source = source.replace(pattern, modulePath(newFile));
    }
    if (source !== original) {
        writeFileSync(absolute, source);
        rewritten++;
    }
}
for (const [source, destination] of pending) {
    mkdirSync(dirname(resolve(root, destination)), { recursive: true });
    renameSync(resolve(root, source), resolve(root, destination));
}
console.log(
    `Moved ${pending.length} scene files and updated ${rewritten} files.`,
);
