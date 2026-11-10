#!/usr/bin/env node
// Re-runs replay files in Node: reports state-hash divergence and reproduced errors.
// Usage: node scripts/replay-check.mjs <replay.json|error-log.json>... [--expect-error]
// Error logs are expanded into the replays attached to each entry.
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: [new URL('../src/game/replay.ts', import.meta.url).pathname], bundle: true, write: false, platform: 'node', format: 'esm' });
const replay = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

export function checkReplay(text, label = 'replay') {
    const file = replay.parseReplay(text);
    const timeline = replay.buildTimeline(file);
    const ticks = timeline.endTick - timeline.startTick;
    return {
        label,
        stage: file.start.stage,
        seconds: +(ticks / 120).toFixed(2),
        reachedEnd: timeline.endTick === file.endTick,
        hashes: file.hashes.length,
        divergedAt: timeline.divergedAt,
        error: timeline.error,
        versionMismatch: timeline.versionMismatch,
        markers: timeline.markers.length,
    };
}

function replaysIn(path) {
    const text = readFileSync(path, 'utf8');
    const data = JSON.parse(text);
    if (data?.kind === 'the-chair-error-log') {
        return data.entries.filter(entry => entry.replay).map((entry, i) => [`${path}#${i} (${entry.message})`, JSON.stringify(entry.replay)]);
    }
    return [[path, text]];
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    const expectError = args.includes('--expect-error');
    const paths = args.filter(arg => !arg.startsWith('--'));
    if (!paths.length) {
        console.error('Usage: node scripts/replay-check.mjs <replay.json|error-log.json>... [--expect-error]');
        process.exit(2);
    }
    let failed = false;
    for (const path of paths) {
        for (const [label, text] of replaysIn(path)) {
            const result = checkReplay(text, label);
            const ok = result.divergedAt === null && result.reachedEnd !== false && (expectError ? !!result.error : !result.error);
            failed ||= !ok;
            console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: stage ${result.stage}, ${result.seconds}s, ${result.hashes} hashes`
                + (result.divergedAt !== null ? `, diverged at tick ${result.divergedAt}` : '')
                + (result.error ? `, error at tick ${result.error.tick}: ${result.error.message}` : '')
                + (result.versionMismatch ? ', recorded with other rules' : ''));
        }
    }
    process.exit(failed ? 1 : 0);
}
