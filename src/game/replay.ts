// Replays: record an attempt as (start state, commands by tick), check it with state hashes, and play it
// back with seekable keyframes. Pure core module: no DOM, storage or clock; the UI supplies those.
import { parseCommand, type Command } from './commands';
import { CONFIG_VERSION } from './stages/index';
import { clonePlain, configHash, deepFreeze } from './data';
import { SIMULATED, applyCommand, stepGame } from './step';
import type { GameState } from './state';
import type { GameEvent } from './types';
import { assertGameState } from './validation';

// 2: stage values grouped under state.office / building / rooftop / sky.
export const REPLAY_FORMAT = 2;

// Tunable from the pause menu. Ticks are fixed 1/120 s steps.
export type ReplaySettings = {
    enabled: boolean;         // record attempts while playing
    hashInterval: number;     // ticks between recorded state hashes (divergence check)
    keyframeInterval: number; // ticks between seek points built when a replay is opened
    maxCommands: number;      // commands kept per attempt; longer attempts are cut off
    keepAttempts: number;     // finished attempts kept in memory besides the current one
    maxErrors: number;        // entries kept in the error log
    playbackSpeed: number;    // default playback speed
    warmupSeconds: number;    // simulated time run before a seek target so effects settle
};

export const REPLAY_DEFAULTS: Readonly<ReplaySettings> = deepFreeze({
    enabled: true,
    hashInterval: 120,
    keyframeInterval: 120,
    maxCommands: 20000,
    keepAttempts: 3,
    maxErrors: 20,
    playbackSpeed: 1,
    warmupSeconds: 2,
});

const RANGES: Record<Exclude<keyof ReplaySettings, 'enabled'>, readonly [number, number, boolean]> = {
    hashInterval: [10, 1200, true],
    keyframeInterval: [30, 1200, true],
    maxCommands: [100, 200000, true],
    keepAttempts: [0, 10, true],
    maxErrors: [1, 50, true],
    playbackSpeed: [.25, 4, false],
    warmupSeconds: [0, 5, false],
};

export const REPLAY_SETTING_RANGES = RANGES;

// Timeline construction is synchronous. Keep imported and locally recorded attempts small enough
// to validate and index without letting one file monopolize the browser's main thread.
export const REPLAY_FILE_LIMITS = deepFreeze({
    characters: 5_000_000,
    commands: REPLAY_DEFAULTS.maxCommands,
    ticks: 120 * 60 * 2,
    hashes: 120 * 60 * 2 / RANGES.hashInterval[0],
    sources: 50,
});

/** Accepts anything (saved JSON, form values) and returns valid settings, falling back to defaults. */
export function normalizeReplaySettings(input: unknown): ReplaySettings {
    const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const settings: ReplaySettings = { ...REPLAY_DEFAULTS };
    if (typeof source.enabled === 'boolean') settings.enabled = source.enabled;
    for (const key of Object.keys(RANGES) as (keyof typeof RANGES)[]) {
        const value = Number(source[key]);
        if (source[key] === undefined || source[key] === '' || !Number.isFinite(value)) continue;
        const [min, max, integer] = RANGES[key];
        settings[key] = Math.min(max, Math.max(min, integer ? Math.round(value) : value));
    }
    return settings;
}

export type ReplayError = { tick: number; at: 'step' | 'command' | 'window'; message: string; stack?: string; command?: Command };

export type ReplayFile = {
    format: typeof REPLAY_FORMAT;
    version: string;                  // CONFIG_VERSION of the build that recorded it
    seed: number | null;
    start: GameState;                 // state when the attempt began
    commands: [tick: number, command: Command][];
    hashes: [tick: number, hash: string][];
    endTick: number;                  // last tick to simulate
    truncated: boolean;               // stopped recording at maxCommands
    error: ReplayError | null;        // first error in the attempt, if any
};

export function hashState(state: Readonly<GameState>): string {
    return configHash(state);
}

export function replayLength(file: Readonly<ReplayFile>) {
    return file.endTick - file.start.tick;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
}

function parseReplayError(value: unknown): ReplayError | null {
    if (value === undefined || value === null) return null;
    if (!isRecord(value) || typeof value.tick !== 'number' || !Number.isSafeInteger(value.tick)
        || (value.at !== 'step' && value.at !== 'command' && value.at !== 'window')
        || typeof value.message !== 'string' || value.message.length > 1000
        || (value.stack !== undefined && (typeof value.stack !== 'string' || value.stack.length > 20_000))) throw new Error('bad replay error');
    const command = value.command === undefined ? undefined : parseCommand(value.command);
    return {
        tick: value.tick,
        at: value.at,
        message: value.message,
        ...(value.stack === undefined ? {} : { stack: value.stack }),
        ...(command === undefined ? {} : { command }),
    };
}

/** Parses and checks a replay file. Throws an Error with a short reason when it is not one. */
export function parseReplay(text: string): ReplayFile {
    if (text.length > REPLAY_FILE_LIMITS.characters) throw new Error('replay file is too large');
    let data: unknown;
    try { data = JSON.parse(text); } catch { throw new Error('not JSON'); }
    if (!isRecord(data)) throw new Error('unknown format');
    if (data.format !== REPLAY_FORMAT) throw new Error('unknown format');
    try { assertGameState(data.start, 'start state'); } catch (error) { throw new Error(`bad start state: ${error instanceof Error ? error.message : error}`); }
    const start = data.start;
    if (!Number.isSafeInteger(data.endTick) || typeof data.endTick !== 'number' || data.endTick < start.tick) throw new Error('bad end tick');
    if (data.endTick - start.tick > REPLAY_FILE_LIMITS.ticks) throw new Error('replay is too long');
    if (!isArray(data.commands)) throw new Error('missing commands');
    if (data.commands.length > REPLAY_FILE_LIMITS.commands) throw new Error('too many commands');
    const commands: ReplayFile['commands'] = [];
    let last = start.tick;
    for (const [index, entry] of data.commands.entries()) {
        if (!isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'number' || !Number.isSafeInteger(entry[0])
            || entry[0] < last || entry[0] > data.endTick) {
            throw new Error(`bad command at ${index}`);
        }
        commands.push([entry[0], parseCommand(entry[1])]);
        last = entry[0];
    }
    if (!isArray(data.hashes)) throw new Error('missing hashes');
    if (data.hashes.length > REPLAY_FILE_LIMITS.hashes) throw new Error('too many hashes');
    const hashes: ReplayFile['hashes'] = [];
    let lastHash = start.tick;
    for (const [index, entry] of data.hashes.entries()) {
        if (!isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'number' || !Number.isSafeInteger(entry[0]) || entry[0] < lastHash || entry[0] > data.endTick
            || typeof entry[1] !== 'string' || entry[1].length > 128) throw new Error(`bad hash at ${index}`);
        hashes.push([entry[0], entry[1]]);
        lastHash = entry[0];
    }
    const seed = data.seed === undefined || data.seed === null ? null : data.seed;
    if (seed !== null && (!Number.isSafeInteger(seed) || typeof seed !== 'number' || seed < 0 || seed > 0xffffffff)) throw new Error('bad seed');
    const version = data.version === undefined ? '' : data.version;
    if (typeof version !== 'string' || version.length > 128) throw new Error('bad version');
    const truncated = data.truncated === undefined ? false : data.truncated;
    if (typeof truncated !== 'boolean') throw new Error('bad truncated flag');
    const error = parseReplayError(data.error);
    return { format: REPLAY_FORMAT, version, seed, start, commands, hashes, endTick: data.endTick, truncated, error };
}

/**
 * Collects the current attempt from the createGame hooks. Pass the returned hooks to createGame.
 * `getSettings` is read on every call, so settings changes apply immediately.
 */
export function createRecorder(getSettings: () => ReplaySettings, seed: number | null = null) {
    let current: ReplayFile | null = null;
    const finished: ReplayFile[] = [];

    function finish() {
        if (!current) return;
        const file = current;
        current = null;
        // A retry or stage change ends an attempt; drop those trailing commands so the replay ends on the attempt itself.
        while (file.commands.length && file.commands.at(-1)![0] >= file.endTick && ['reset', 'restart', 'startStage'].includes(file.commands.at(-1)![1].type)) file.commands.pop();
        if (replayLength(file) <= 0 && !file.error) return;
        finished.push(file);
        const keep = getSettings().keepAttempts;
        while (finished.length > keep) finished.shift();
    }

    return {
        onAttemptStart(json: string) {
            finish();
            if (!getSettings().enabled) return;
            const start = JSON.parse(json) as GameState;
            current = { format: REPLAY_FORMAT, version: CONFIG_VERSION, seed, start, commands: [], hashes: [], endTick: start.tick, truncated: false, error: null };
        },
        onCommand(tick: number, command: Command) {
            if (!current || current.truncated) return;
            if (current.commands.length >= Math.min(getSettings().maxCommands, REPLAY_FILE_LIMITS.commands)) {
                current.truncated = true;
                return;
            }
            current.commands.push([tick, clonePlain(command)]);
        },
        onStep(state: Readonly<GameState>) {
            if (!current || current.truncated || current.error) return;
            const lastTick = current.start.tick + REPLAY_FILE_LIMITS.ticks;
            if (state.tick > lastTick) {
                current.endTick = lastTick;
                current.truncated = true;
                return;
            }
            current.endTick = state.tick;
            if (state.tick % getSettings().hashInterval === 0) current.hashes.push([state.tick, hashState(state)]);
        },
        onError(error: ReplayError) {
            if (!current || current.error) return;
            current.error = clonePlain(error);
            // A failing step happens on the next tick: simulate up to it so playback reproduces the error.
            if (error.at === 'step') current.endTick = error.tick + 1;
        },
        /** The attempt in progress and the finished ones kept, newest first, as detached copies. */
        attempts(): ReplayFile[] {
            return [current, ...finished.slice().reverse()].filter((file): file is ReplayFile => !!file).map(file => clonePlain(file));
        },
        /** The newest attempt worth watching: at least half a second long, or one that ended in an error. */
        latest(minTicks = 60): ReplayFile | null {
            return this.attempts().find(file => replayLength(file) >= minTicks || !!file.error) ?? null;
        },
    };
}

export type Recorder = ReturnType<typeof createRecorder>;

export type MarkerKind = 'checkpoint' | 'death' | 'reset' | 'clear' | 'error' | 'diverged';
export type Marker = { tick: number; kind: MarkerKind };
type Keyframe = { state: GameState; index: number };

export type Timeline = {
    file: ReplayFile;
    startTick: number;
    endTick: number;
    keyframes: Keyframe[];
    markers: Marker[];
    divergedAt: number | null;      // first tick whose state hash differs from the recording
    error: ReplayError | null;      // error reproduced while building the timeline
    versionMismatch: boolean;
};

/** A position in a replay. `next()` advances by one command or one fixed step. */
export function createCursor(file: Readonly<ReplayFile>, from: Keyframe = { state: file.start, index: 0 }) {
    let state = from.state;
    let index = from.index;
    const commands = file.commands;
    return {
        get state() { return state; },
        get index() { return index; },
        /** The next thing that would happen: a command at this tick, a step, or the end. */
        pending(): 'command' | 'step' | 'end' {
            if (index < commands.length && commands[index][0] <= state.tick) return 'command';
            if (state.tick >= file.endTick || !SIMULATED.includes(state.mode)) return 'end';
            return 'step';
        },
        next(): GameEvent[] | null {
            const kind = this.pending();
            if (kind === 'end') return null;
            const result = kind === 'command' ? applyCommand(state, commands[index][1]) : stepGame(state);
            if (kind === 'command') index++;
            state = result.state;
            return result.events;
        },
        keyframe(): Keyframe { return { state, index }; },
    };
}

/** Runs the whole replay once, collecting seek keyframes, markers and the hash check. */
export function buildTimeline(input: Readonly<ReplayFile>, keyframeInterval: number = REPLAY_DEFAULTS.keyframeInterval): Timeline {
    if (input.endTick - input.start.tick > REPLAY_FILE_LIMITS.ticks) throw new Error('replay is too long');
    if (input.commands.length > REPLAY_FILE_LIMITS.commands) throw new Error('too many commands');
    if (input.hashes.length > REPLAY_FILE_LIMITS.hashes) throw new Error('too many hashes');
    const file = clonePlain(input) as ReplayFile;
    const cursor = createCursor(file);
    const keyframes: Keyframe[] = [cursor.keyframe()];
    const markers: Marker[] = [];
    const hashes = new Map(file.hashes);
    let divergedAt: number | null = null;
    let error: ReplayError | null = null;
    for (;;) {
        const before = cursor.state;
        if (before.tick % keyframeInterval === 0 && keyframes.at(-1)!.state.tick !== before.tick) keyframes.push(cursor.keyframe());
        const kind = cursor.pending();
        let events: GameEvent[] | null;
        try {
            events = cursor.next();
        } catch (e) {
            error = { tick: before.tick, at: kind === 'command' ? 'command' : 'step', message: e instanceof Error ? e.message : String(e) };
            markers.push({ tick: before.tick, kind: 'error' });
            break;
        }
        if (!events) break;
        const after = cursor.state;
        if (after.deaths > before.deaths) markers.push({ tick: after.tick, kind: 'death' });
        for (const event of events) {
            if (event.type === 'reset') markers.push({ tick: after.tick, kind: 'reset' });
            if (event.type === 'cue' && event.id === 'checkpoint') markers.push({ tick: after.tick, kind: 'checkpoint' });
            if (event.type === 'cue' && event.id === 'stage-clear') markers.push({ tick: after.tick, kind: 'clear' });
        }
        if (kind === 'step' && divergedAt === null && hashes.has(after.tick) && hashes.get(after.tick) !== hashState(after)) {
            divergedAt = after.tick;
            markers.push({ tick: after.tick, kind: 'diverged' });
        }
    }
    return {
        file,
        startTick: file.start.tick,
        endTick: Math.max(file.start.tick, cursor.state.tick),
        keyframes,
        markers,
        divergedAt,
        error,
        versionMismatch: file.version !== CONFIG_VERSION,
    };
}

/** A cursor positioned at `tick` (after the step that reached it, before its commands). */
export function seekTimeline(timeline: Readonly<Timeline>, tick: number) {
    const target = Math.max(timeline.startTick, Math.min(timeline.endTick, tick));
    let keyframe = timeline.keyframes[0];
    for (const candidate of timeline.keyframes) {
        if (candidate.state.tick <= target) keyframe = candidate;
        else break;
    }
    const cursor = createCursor(timeline.file, keyframe);
    while (cursor.state.tick < target && cursor.pending() !== 'end') cursor.next();
    return cursor;
}

export type ReplayCursor = ReturnType<typeof createCursor>;

// Everything the game exports for developers: recent attempts and the error log, each error with the
// replay of the attempt that failed. Read-only for players; opened in the replay tool (/replay.html).
export type ReplayErrorEntry = ReplayError & { time: string; stage: number | null; replay: ReplayFile | null };
export type ReplayData = {
    kind: 'the-chair-replay-data';
    format: typeof REPLAY_FORMAT;
    version: string;
    exportedAt: string;
    userAgent: string;
    attempts: ReplayFile[];
    errors: ReplayErrorEntry[];
};

export type ReplaySource = { label: string; kind: 'attempt' | 'error' | 'file'; file: ReplayFile; error: ReplayErrorEntry | null };

/**
 * Accepts a replay data bundle, a single replay file, or an older error log, and lists the replays inside.
 * Entries without a usable replay are skipped. Throws when nothing in the text is a replay.
 */
export function readReplaySources(text: string): { sources: ReplaySource[]; data: Record<string, unknown> | null } {
    if (text.length > REPLAY_FILE_LIMITS.characters) throw new Error('replay file is too large');
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { throw new Error('not JSON'); }
    const seconds = (file: ReplayFile) => (replayLength(file) / 120).toFixed(1) + 's';
    const sources: ReplaySource[] = [];
    if (isRecord(raw) && (raw.kind === 'the-chair-replay-data' || raw.kind === 'the-chair-error-log')) {
        const attempts = raw.attempts === undefined ? [] : raw.attempts;
        const errors = raw.errors ?? raw.entries ?? [];
        if (!isArray(attempts)) throw new Error('replay attempts must be an array');
        if (!isArray(errors)) throw new Error('replay errors must be an array');
        if (attempts.length + errors.length > REPLAY_FILE_LIMITS.sources) throw new Error('too many replays inside');
        attempts.forEach((attempt, i) => {
            try {
                const serialized = JSON.stringify(attempt);
                if (serialized === undefined) return;
                const file = parseReplay(serialized);
                sources.push({ label: `#${i + 1} · stage ${file.start.stage} · ${seconds(file)}${file.error ? ' · error' : ''}`, kind: 'attempt', file, error: null });
            } catch {}
        });
        errors.forEach(value => {
            if (!isRecord(value) || value.replay === undefined || value.replay === null) return;
            try {
                const serialized = JSON.stringify(value.replay);
                if (serialized === undefined) return;
                const file = parseReplay(serialized);
                const parsed = parseReplayError(value);
                if (!parsed) return;
                const time = typeof value.time === 'string' && value.time.length <= 200 ? value.time : '';
                const stage = typeof value.stage === 'number' && Number.isSafeInteger(value.stage) ? value.stage : null;
                const entry: ReplayErrorEntry = { ...parsed, time, stage, replay: file };
                sources.push({ label: `error · ${entry.message} · stage ${file.start.stage}`, kind: 'error', file, error: entry });
            } catch {}
        });
        if (!attempts.length && !errors.length) throw new Error('no replays inside');
        if (!sources.length) throw new Error('no usable replay inside');
        return { sources, data: raw };
    }
    const file = parseReplay(text);
    return { sources: [{ label: `stage ${file.start.stage} · ${seconds(file)}`, kind: 'file', file, error: null }], data: null };
}
