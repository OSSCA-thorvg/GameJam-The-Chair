#!/usr/bin/env node
// Re-plans the stage four sky route that tests replay and rewrites tests/replays/stage4-route.json.
// Run after an intended gameplay change that makes the recorded launches miss.
// Usage: npm run route:update            (write the new route)
//        npm run route:update -- --check (only report whether it changed; exit 1 if it did)
import { readFileSync, writeFileSync } from 'node:fs';
import { planStageFour, STAGE_FOUR_RECORDING } from '../tests/support/stage4-route.mjs';

const check = process.argv.includes('--check');
const next = `${JSON.stringify(planStageFour(), null, 1)}\n`;
let previous = '';
try { previous = readFileSync(STAGE_FOUR_RECORDING, 'utf8'); } catch { /* first recording */ }
if (next === previous) {
    console.log('Stage four route unchanged.');
} else if (check) {
    console.log('Stage four route differs. Run: npm run route:update');
    process.exit(1);
} else {
    writeFileSync(STAGE_FOUR_RECORDING, next);
    console.log(`Updated ${STAGE_FOUR_RECORDING.pathname.split('/').slice(-3).join('/')}.`);
}
