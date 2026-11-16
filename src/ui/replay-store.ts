import { REPLAY_FORMAT, parseReplayError, parseReplay } from '../game/replay';
import { CONFIG_VERSION } from '../game/stages/index';

import type {
    Recorder,
    ReplayData,
    ReplayError,
    ReplayErrorEntry,
    ReplayFile,
} from '../game/replay';

const ERRORS_KEY = 'the-chair-error-log';
export const BROWSER_DATA_KEY = 'the-chair-replay-data';

function store(key: string, value: unknown) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

// Persist errors immediately: a crash may stop the game loop.
export function createErrorLog(max: number): {
    add(
        error: ReplayError,
        stage: number | null,
        replay: ReplayFile | null,
    ): void;
    readonly entries: readonly ReplayErrorEntry[];
} {
    max = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 0;
    let entries: ReplayErrorEntry[] = [];
    try {
        const saved: unknown = JSON.parse(
            localStorage.getItem(ERRORS_KEY) || '[]',
        );
        if (Array.isArray(saved)) {
            for (const value of saved as unknown[]) {
                if (!value || typeof value !== 'object') {
                    continue;
                }
                const entry = value as Record<string, unknown>;
                try {
                    const error = parseReplayError(entry);
                    if (
                        !error ||
                        typeof entry.time !== 'string' ||
                        !Number.isFinite(Date.parse(entry.time))
                    ) {
                        continue;
                    }
                    if (
                        entry.stage !== null &&
                        (typeof entry.stage !== 'number' ||
                            !Number.isInteger(entry.stage) ||
                            entry.stage < 1 ||
                            entry.stage > 5)
                    ) {
                        continue;
                    }
                    const replay =
                        entry.replay === null
                            ? null
                            : parseReplay(JSON.stringify(entry.replay));
                    entries.push({
                        ...error,
                        time: entry.time,
                        stage: entry.stage,
                        replay,
                    });
                } catch {}
            }
            entries = entries.slice(-Math.max(0, max));
            if (max <= 0) {
                entries = [];
            }
        }
    } catch {}
    function persist() {
        for (
            let keepReplays = entries.length;
            keepReplays >= 0;
            keepReplays--
        ) {
            if (
                store(
                    ERRORS_KEY,
                    entries.map((entry, i) =>
                        i < entries.length - keepReplays
                            ? { ...entry, replay: null }
                            : entry,
                    ),
                )
            ) {
                return;
            }
        }
    }
    return {
        add(
            error: ReplayError,
            stage: number | null,
            replay: ReplayFile | null,
        ) {
            entries.push({
                ...error,
                time: new Date().toISOString(),
                stage,
                replay,
            });
            while (entries.length > max) {
                entries.shift();
            }
            persist();
        },
        get entries(): readonly ReplayErrorEntry[] {
            return entries;
        },
    };
}

export type ErrorLog = ReturnType<typeof createErrorLog>;

export function replayData(recorder: Recorder, errorLog: ErrorLog): ReplayData {
    return {
        kind: 'the-chair-replay-data',
        format: REPLAY_FORMAT,
        version: CONFIG_VERSION,
        exportedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        attempts: recorder.attempts(),
        errors: [...errorLog.entries],
    };
}

export function saveBrowserData(data: ReplayData): void {
    if (store(BROWSER_DATA_KEY, data)) {
        return;
    }
    store(BROWSER_DATA_KEY, {
        ...data,
        attempts: data.attempts.slice(0, 1),
        errors: data.errors.map((entry) => ({ ...entry, replay: null })),
    });
}

export function loadBrowserData(): string | null {
    try {
        return localStorage.getItem(BROWSER_DATA_KEY);
    } catch {
        return null;
    }
}

export function downloadJson(name: string, data: unknown): void {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(data)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.append(area);
        area.select();
        const target: Partial<Pick<Document, 'execCommand'>> = document;
        const ok = target.execCommand?.('copy') ?? false;
        area.remove();
        return ok;
    }
}

export function stamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
