// Browser-side storage for replay settings and the error log, plus file download and clipboard helpers.
import { CONFIG_VERSION } from '../game/stages';
import { normalizeReplaySettings, type ReplayError, type ReplayFile, type ReplaySettings } from '../game/replay';

const SETTINGS_KEY = 'the-chair-replay-settings';
const ERRORS_KEY = 'the-chair-error-log';

export function loadReplaySettings(): ReplaySettings {
    try { return normalizeReplaySettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')); } catch { return normalizeReplaySettings(null); }
}

export function saveReplaySettings(settings: ReplaySettings) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
}

export type ErrorLogEntry = ReplayError & { time: string; stage: number | null; replay: ReplayFile | null };
export type ErrorLogFile = { kind: 'the-chair-error-log'; format: 1; version: string; userAgent: string; exportedAt: string; entries: ErrorLogEntry[] };

// Errors survive reloads (a crash may stop the game loop) and keep the replay of the attempt that failed.
export function createErrorLog(getMax: () => number) {
    let entries: ErrorLogEntry[] = [];
    try {
        const saved = JSON.parse(localStorage.getItem(ERRORS_KEY) || '[]');
        if (Array.isArray(saved)) entries = saved;
    } catch {}
    const listeners = new Set<() => void>();
    function persist() {
        // Drop replays from the oldest entries first if storage is full.
        for (let keepReplays = entries.length; keepReplays >= 0; keepReplays--) {
            const stored = entries.map((entry, i) => i < entries.length - keepReplays ? { ...entry, replay: null } : entry);
            try { localStorage.setItem(ERRORS_KEY, JSON.stringify(stored)); return; } catch {}
        }
    }
    function changed() {
        persist();
        for (const listener of listeners) listener();
    }
    return {
        add(error: ReplayError, stage: number | null, replay: ReplayFile | null) {
            entries.push({ ...error, time: new Date().toISOString(), stage, replay });
            while (entries.length > getMax()) entries.shift();
            changed();
        },
        clear() {
            entries = [];
            changed();
        },
        get size() { return entries.length; },
        file(): ErrorLogFile {
            return { kind: 'the-chair-error-log', format: 1, version: CONFIG_VERSION, userAgent: navigator.userAgent, exportedAt: new Date().toISOString(), entries };
        },
        onChange(listener: () => void) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}

export type ErrorLog = ReturnType<typeof createErrorLog>;

export function downloadJson(name: string, data: unknown) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyJson(data: unknown) {
    const text = JSON.stringify(data);
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
