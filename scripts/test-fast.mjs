#!/usr/bin/env node
// Runs every test file except the long simulation suites (gameplay fingerprints, determinism and
// real-time replay). CI and `npm test` still run everything.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const SLOW = new Set(['golden.test.mjs', 'determinism.test.mjs', 'determinism-routes.test.mjs', 'replay.test.mjs']);
const files = readdirSync('tests').filter(name => name.endsWith('.test.mjs') && !SLOW.has(name)).map(name => `tests/${name}`);
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
