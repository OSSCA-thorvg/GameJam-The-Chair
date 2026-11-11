// Browser-side storage for the replay data: the error log survives reloads, and the latest data bundle is
// kept so the replay tool (/replay.html) can open it from the same browser. Plus download/copy helpers.
import { CONFIG_VERSION } from '../game/stages/index';
import type { Recorder, ReplayData, ReplayError, ReplayErrorEntry, ReplayFile } from '../game/replay';

const ERRORS_KEY = 'the-chair-error-log';
export const BROWSER_DATA_KEY = 'the-chair-replay-data';

function store(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

// Errors keep the replay of the attempt that failed. A crash may stop the game loop, so they are stored at once.
export function createErrorLog(max: number) {
    let entries: ReplayErrorEntry[] = [];
    try {
        const saved = JSON.parse(localStorage.getItem(ERRORS_KEY) || '[]');
        if (Array.isArray(saved)) entries = saved;
    } catch {}
    function persist() {
        // Drop replays from the oldest entries first if storage is full.
        for (let keepReplays = entries.length; keepReplays >= 0; keepReplays--) {
            if (store(ERRORS_KEY, entries.map((entry, i) => i < entries.length - keepReplays ? { ...entry, replay: null } : entry))) return;
        }
    }
    return {
        add(error: ReplayError, stage: number | null, replay: ReplayFile | null) {
            entries.push({ ...error, time: new Date().toISOString(), stage, replay });
            while (entries.length > max) entries.shift();
            persist();
        },
        get entries(): readonly ReplayErrorEntry[] { return entries; },
    };
}

export type ErrorLog = ReturnType<typeof createErrorLog>;

export function replayData(recorder: Recorder, errorLog: ErrorLog): ReplayData {
    return {
        kind: 'the-chair-replay-data',
        format: 1,
        version: CONFIG_VERSION,
        exportedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        attempts: recorder.attempts(),
        errors: [...errorLog.entries],
    };
}

/** Keeps the newest data bundle in this browser for the replay tool. Replays are dropped if storage is full. */
export function saveBrowserData(data: ReplayData) {
    if (store(BROWSER_DATA_KEY, data)) return;
    store(BROWSER_DATA_KEY, { ...data, attempts: data.attempts.slice(0, 1), errors: data.errors.map(entry => ({ ...entry, replay: null })) });
}

export function loadBrowserData(): string | null {
    try { return localStorage.getItem(BROWSER_DATA_KEY); } catch { return null; }
}

export function downloadJson(name: string, data: unknown) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Fallback for pages without clipboard permission.
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.append(area);
        area.select();
        const ok = document.execCommand?.('copy') ?? false;
        area.remove();
        return ok;
    }
}

export function stamp() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
