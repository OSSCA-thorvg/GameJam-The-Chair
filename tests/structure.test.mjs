import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';

// Keeps stage work independent: people editing different stages should not need to touch the same files.
const STAGES = ['office', 'building', 'rooftop', 'sky', 'orbit'];
const STAGE_ROOT = 'src/game/stages';
// Files that list every stage once (one line or one case per stage).
const STAGE_INDEXES = ['src/game/stages/index.ts', 'src/game/stages/hooks.ts', 'src/game/stages/attempt.ts', 'src/game/stages/view.ts'];

function files(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? files(path) : path.endsWith('.ts') ? [path] : [];
    });
}
// Relative imports of a file, with whether each is type-only (erased at build time).
function importsOf(path) {
    const source = readFileSync(path, 'utf8');
    return [...source.matchAll(/^(import|export)\s+(type\s+)?[^;]*?from '(\.[^']+)';/gms)]
        .map(match => ({ target: normalize(join(dirname(path), match[3])), typeOnly: !!match[2] }));
}
const imports = path => importsOf(path).map(entry => entry.target);
const stageOf = path => {
    const rest = relative(STAGE_ROOT, path);
    return rest.startsWith('..') ? null : rest.split('/')[0];
};

test('a stage uses only the data of other stages, never their behaviour', () => {
    for (const path of files(STAGE_ROOT)) {
        const own = stageOf(path);
        if (!STAGES.includes(own)) continue;
        for (const target of imports(path)) {
            const other = stageOf(target);
            if (!STAGES.includes(other) || other === own) continue;
            assert.equal(target, join(STAGE_ROOT, other, 'data'), `${path} imports ${target}`);
        }
    }
});

test('shared game code reaches stage behaviour only through the stage indexes', () => {
    for (const path of files('src/game')) {
        if (stageOf(path) && STAGES.includes(stageOf(path))) continue;
        if (STAGE_INDEXES.includes(path)) continue;
        for (const { target, typeOnly } of importsOf(path)) {
            const stage = stageOf(target);
            if (!STAGES.includes(stage) || typeOnly || /\/data$/.test(target)) continue;
            assert.fail(`${path} imports stage code ${target}; go through stages/hooks.ts or stages/attempt.ts`);
        }
    }
});

test('every stage has its definition, attempt setup and hooks in its own folder', () => {
    for (const stage of STAGES) {
        for (const file of ['definition.ts', 'attempt.ts', 'hooks.ts']) {
            assert.doesNotThrow(() => readFileSync(join(STAGE_ROOT, stage, file)), `${stage}/${file}`);
        }
    }
});
