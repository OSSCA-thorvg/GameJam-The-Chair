import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { ESLint } from 'eslint';

test('size and complexity limits are errors, and warnings fail the CLI', async (t) => {
    const directory = await mkdtemp(path.resolve('src/game/lint-budget-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const invalid = path.join(directory, 'invalid.ts');
    const valid = path.join(directory, 'valid.ts');
    const branches = Array.from(
        { length: 15 },
        (_, i) => `if (value > ${i}) { return ${i}; }`,
    ).join('\n');
    const statements = Array.from({ length: 105 }, () => 'value += 1;').join(
        '\n',
    );
    await writeFile(
        invalid,
        `
export function wide(a: number, b: number, c: number, d: number, e: number, f: number): number {
    return a + b + c + d + e + f;
}
export function complex(value: number): number {
${branches}
    return 0;
}
export function long(): number {
    let value = 0;
${statements}
    return value;
}
export function deep(value: number): number {
    if (value > 0) { if (value > 1) { if (value > 2) { if (value > 3) { if (value > 4) { return value; } } } } }
    return 0;
}
`,
    );
    await writeFile(
        valid,
        'export function sum(a: number, b: number): number { return a + b; }\n',
    );
    const results = await new ESLint().lintFiles([invalid, valid]);
    const rejected = results.find((result) => result.filePath === invalid);
    for (const rule of [
        'complexity',
        'max-lines-per-function',
        'max-depth',
        'max-params',
    ]) {
        assert.ok(
            rejected.messages.some(
                (message) => message.ruleId === rule && message.severity === 2,
            ),
            rule,
        );
    }
    assert.deepEqual(
        results.find((result) => result.filePath === valid).messages,
        [],
    );
    await writeFile(
        valid,
        '// TODO: warning fixture\nexport const score = 1;\n',
    );
    const cli = spawnSync(
        process.execPath,
        [
            path.resolve('node_modules/eslint/bin/eslint.js'),
            valid,
            '--rule',
            'no-warning-comments:warn',
            '--max-warnings',
            '0',
            '--format',
            'json',
        ],
        { encoding: 'utf8' },
    );
    assert.equal(cli.status, 1);
    const [warning] = JSON.parse(cli.stdout);
    assert.equal(warning.errorCount, 0);
    assert.equal(warning.warningCount, 1);
});
