#!/usr/bin/env node
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const SLOW = new Set(['golden.test.mjs', 'determinism.test.mjs', 'determinism-routes.test.mjs', 'replay.test.mjs', 'replay-stage3.test.mjs']);
const files = readdirSync('tests').filter(name => name.endsWith('.test.mjs') && !SLOW.has(name)).map(name => `tests/${name}`);
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
