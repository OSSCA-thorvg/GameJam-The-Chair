#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import {
    planStageFour,
    STAGE_FOUR_RECORDING,
} from '../tests/support/stage4-route.mjs';

const check = process.argv.includes('--check');
const next = `${JSON.stringify(planStageFour(), null, 1)}\n`;
let previous = '';
try {
    previous = readFileSync(STAGE_FOUR_RECORDING, 'utf8');
} catch {}
if (next === previous) {
    console.log('Stage four route unchanged.');
} else if (check) {
    console.log('Stage four route differs. Run: npm run route:update');
    process.exit(1);
} else {
    writeFileSync(STAGE_FOUR_RECORDING, next);
    console.log(
        `Updated ${STAGE_FOUR_RECORDING.pathname.split('/').slice(-3).join('/')}.`,
    );
}
