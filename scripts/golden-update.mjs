#!/usr/bin/env node
// Re-runs the gameplay fingerprint scenarios and rewrites EXPECTED in tests/golden.test.mjs.
// Use only for an intended gameplay change, and say why in the PR.
// Usage: npm run golden:update            (write new values)
//        npm run golden:update -- --check (only report differences; exit 1 if any)
import { readFileSync, writeFileSync } from 'node:fs';
import { GOLDEN_SCENARIOS } from '../tests/golden.mjs';

const TEST = new URL('../tests/golden.test.mjs', import.meta.url);
const check = process.argv.includes('--check');
let source = readFileSync(TEST, 'utf8');
const changed = [];
for (const [name, run] of Object.entries(GOLDEN_SCENARIOS)) {
    const value = run();
    const pattern = new RegExp(`('${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}': )'([0-9a-f]+)'`);
    const match = source.match(pattern);
    if (!match) throw new Error(`No EXPECTED entry for "${name}" in tests/golden.test.mjs`);
    if (match[2] !== value) changed.push(`${name}: ${match[2]} → ${value}`);
    source = source.replace(pattern, `$1'${value}'`);
}
if (!changed.length) {
    console.log('Fingerprints unchanged.');
} else if (check) {
    console.log(`Fingerprints differ:\n  ${changed.join('\n  ')}`);
    process.exit(1);
} else {
    writeFileSync(TEST, source);
    console.log(`Updated tests/golden.test.mjs:\n  ${changed.join('\n  ')}\nExplain the gameplay change in the PR (and in the comment above EXPECTED).`);
}
