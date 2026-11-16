import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { ESLint } from 'eslint';

test('lint rejects unsafe data, constant conditions, cycles, and nondeterministic core APIs', async (t) => {
    const directory = await mkdtemp(path.resolve('src/game/lint-contract-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const unsafe = path.join(directory, 'unsafe.ts');
    const safe = path.join(directory, 'safe.ts');
    const a = path.join(directory, 'a.ts');
    const b = path.join(directory, 'b.ts');
    await Promise.all([
        writeFile(
            unsafe,
            `
export const value = JSON.parse('null');
export const member = value.score;
export const called = value();
export function forward() { return value; }
export const rounded = Math.round(value);
export const always = 'active' || 'done';
export function check(items: string[]) { return items ? 1 : 0; }
export const random = Math.random();
`,
        ),
        writeFile(
            safe,
            `
export function score(value: unknown): number {
    if (typeof value !== 'number') throw new Error('Expected a number');
    return value;
}
`,
        ),
        writeFile(
            a,
            "import { b } from './b'; export function a(): string { return b(); }",
        ),
        writeFile(
            b,
            "import { a } from './a'; export function b(): string { return a(); }",
        ),
    ]);
    const eslint = new ESLint();
    const results = await eslint.lintFiles([unsafe, safe, a, b]);
    const failures = results.flatMap((result) => result.messages);
    assert.deepEqual(
        failures.filter((message) => message.fatal),
        [],
    );
    const rules = new Set(failures.map((message) => message.ruleId));
    for (const rule of [
        '@typescript-eslint/no-unsafe-assignment',
        '@typescript-eslint/no-unsafe-argument',
        '@typescript-eslint/no-unsafe-return',
        '@typescript-eslint/no-unsafe-call',
        '@typescript-eslint/no-unsafe-member-access',
        '@typescript-eslint/no-unnecessary-condition',
        'no-constant-binary-expression',
        'no-restricted-properties',
        'import/no-cycle',
    ]) {
        assert.ok(rules.has(rule), `${rule} must reject its fixture`);
    }
    assert.deepEqual(
        results.find((result) => result.filePath === safe).messages,
        [],
    );
});
