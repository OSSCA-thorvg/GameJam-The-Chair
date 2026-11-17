import { parseCommand } from './commands';
import { clonePlain, configHash, deepFreeze } from './data';
import { CONFIG_VERSION } from './stages/index';
import { SIMULATED, applyCommand, stepGame } from './step';
import { assertGameState } from './validation';

import type { Command } from './commands';
import type { CoreState } from './state';
import type { GameEvent } from './types';
export const REPLAY_FORMAT = 5;
export type ReplaySettings = {
    enabled: boolean;
    hashInterval: number;
    keyframeInterval: number;
    maxCommands: number;
    keepAttempts: number;
    maxErrors: number;
    playbackSpeed: number;
    warmupSeconds: number;
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
const RANGES: Record<
    Exclude<keyof ReplaySettings, 'enabled'>,
    readonly [number, number, boolean]
> = {
    hashInterval: [10, 1200, true],
    keyframeInterval: [30, 1200, true],
    maxCommands: [100, 200000, true],
    keepAttempts: [0, 10, true],
    maxErrors: [1, 50, true],
    playbackSpeed: [0.25, 4, false],
    warmupSeconds: [0, 5, false],
};
export const REPLAY_SETTING_RANGES = RANGES;
// Bound synchronous timeline construction to avoid blocking the browser.
export const REPLAY_FILE_LIMITS = deepFreeze({
    characters: 5000000,
    commands: REPLAY_DEFAULTS.maxCommands,
    ticks: 120 * 60 * 2,
    hashes: (120 * 60 * 2) / RANGES.hashInterval[0],
    sources: 50,
});
export function normalizeReplaySettings(input: unknown): ReplaySettings {
    const source = (input && typeof input === 'object' ? input : {}) as Record<
        string,
        unknown
    >;
    const settings: ReplaySettings = { ...REPLAY_DEFAULTS };
    if (typeof source.enabled === 'boolean') {
        settings.enabled = source.enabled;
    }
    for (const key of Object.keys(RANGES) as Array<keyof typeof RANGES>) {
        const value = Number(source[key]);
        if (
            source[key] === undefined ||
            source[key] === '' ||
            !Number.isFinite(value)
        ) {
            continue;
        }
        const [min, max, integer] = RANGES[key];
        settings[key] = Math.min(
            max,
            Math.max(min, integer ? Math.round(value) : value),
        );
    }
    return settings;
}
export type ReplayError = {
    tick: number;
    at: 'step' | 'command' | 'window';
    message: string;
    stack?: string;
    command?: Command;
};
export type ReplayFile = {
    format: typeof REPLAY_FORMAT;
    version: string;
    seed: number | null;
    start: CoreState;
    commands: Array<[tick: number, command: Command]>;
    hashes: Array<[tick: number, hash: string]>;
    endTick: number;
    truncated: boolean;
    error: ReplayError | null;
};
export function hashState(state: Readonly<CoreState>): string {
    return configHash(state);
}
export function replayLength(file: Readonly<ReplayFile>): number {
    return file.endTick - file.start.tick;
}
function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
function isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
}
export function parseReplayError(value: unknown): ReplayError | null {
    if (value === undefined || value === null) {
        return null;
    }
    return parseReplayErrorRecord(value);
}
function parseReplayErrorRecord(value: unknown): ReplayError {
    if (
        !isRecord(value) ||
        typeof value.tick !== 'number' ||
        !Number.isSafeInteger(value.tick) ||
        (value.at !== 'step' &&
            value.at !== 'command' &&
            value.at !== 'window') ||
        typeof value.message !== 'string' ||
        value.message.length > 1000 ||
        (value.stack !== undefined &&
            (typeof value.stack !== 'string' || value.stack.length > 20000))
    ) {
        throw new Error('bad replay error');
    }
    const command =
        value.command === undefined ? undefined : parseCommand(value.command);
    return {
        tick: value.tick,
        at: value.at,
        message: value.message,
        ...(typeof value.stack === 'string' ? { stack: value.stack } : {}),
        ...(command === undefined ? {} : { command }),
    };
}
export function parseReplay(text: string): ReplayFile {
    if (text.length > REPLAY_FILE_LIMITS.characters) {
        throw new Error('replay file is too large');
    }
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('not JSON');
    }
    if (!isRecord(data) || data.format !== REPLAY_FORMAT) {
        throw new Error('unknown format');
    }
    const start = parseReplayStart(data.start);
    const endTick = parseReplayEndTick(data.endTick, start.tick);
    const commands = parseReplayCommands(data.commands, start.tick, endTick);
    const hashes = parseReplayHashes(data.hashes, start.tick, endTick);
    return {
        format: REPLAY_FORMAT,
        start,
        endTick,
        commands,
        hashes,
        ...parseReplayMetadata(data),
        error: parseReplayError(data.error),
    };
}
function parseReplayStart(value: unknown): CoreState {
    try {
        assertGameState(value, 'start state');
    } catch (error) {
        throw new Error(
            `bad start state: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
    return value;
}
function parseReplayEndTick(value: unknown, startTick: number): number {
    if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < startTick
    ) {
        throw new Error('bad end tick');
    }
    if (value - startTick > REPLAY_FILE_LIMITS.ticks) {
        throw new Error('replay is too long');
    }
    return value;
}
function parseReplayCommands(
    value: unknown,
    startTick: number,
    endTick: number,
): ReplayFile['commands'] {
    if (!isArray(value)) {
        throw new Error('missing commands');
    }
    if (value.length > REPLAY_FILE_LIMITS.commands) {
        throw new Error('too many commands');
    }
    const commands: ReplayFile['commands'] = [];
    let last = startTick;
    for (const [index, entry] of value.entries()) {
        if (
            !isArray(entry) ||
            entry.length !== 2 ||
            typeof entry[0] !== 'number' ||
            !Number.isSafeInteger(entry[0]) ||
            entry[0] < last ||
            entry[0] > endTick
        ) {
            throw new Error(`bad command at ${index}`);
        }
        commands.push([entry[0], parseCommand(entry[1])]);
        last = entry[0];
    }
    return commands;
}
function parseReplayHashes(
    value: unknown,
    startTick: number,
    endTick: number,
): ReplayFile['hashes'] {
    if (!isArray(value)) {
        throw new Error('missing hashes');
    }
    if (value.length > REPLAY_FILE_LIMITS.hashes) {
        throw new Error('too many hashes');
    }
    const hashes: ReplayFile['hashes'] = [];
    let last = startTick;
    for (const [index, entry] of value.entries()) {
        if (
            !isArray(entry) ||
            entry.length !== 2 ||
            typeof entry[0] !== 'number' ||
            !Number.isSafeInteger(entry[0]) ||
            entry[0] < last ||
            entry[0] > endTick ||
            typeof entry[1] !== 'string' ||
            entry[1].length > 128
        ) {
            throw new Error(`bad hash at ${index}`);
        }
        hashes.push([entry[0], entry[1]]);
        last = entry[0];
    }
    return hashes;
}
function parseReplayMetadata(
    data: Record<string, unknown>,
): Pick<ReplayFile, 'version' | 'seed' | 'truncated'> {
    const seed =
        data.seed === undefined || data.seed === null ? null : data.seed;
    if (
        seed !== null &&
        (typeof seed !== 'number' ||
            !Number.isSafeInteger(seed) ||
            seed < 0 ||
            seed > 0xffffffff)
    ) {
        throw new Error('bad seed');
    }
    const version = data.version === undefined ? '' : data.version;
    if (typeof version !== 'string' || version.length > 128) {
        throw new Error('bad version');
    }
    const truncated = data.truncated === undefined ? false : data.truncated;
    if (typeof truncated !== 'boolean') {
        throw new Error('bad truncated flag');
    }
    return { seed, version, truncated };
}
export function createRecorder(
    getSettings: () => ReplaySettings,
    seed: number | null = null,
): {
    onAttemptStart(json: string): void;
    onCommand(tick: number, command: Command): void;
    onStep(state: Readonly<CoreState>): void;
    onError(error: ReplayError): void;
    readonly recording: boolean;
    attempts(): ReplayFile[];
    latest(minTicks?: number): ReplayFile | null;
} {
    return new RecorderRuntime(getSettings, seed).api();
}
export type Recorder = ReturnType<typeof createRecorder>;
export type MarkerKind =
    'checkpoint' | 'death' | 'reset' | 'clear' | 'error' | 'diverged';
export type Marker = { tick: number; kind: MarkerKind };
type Keyframe = { state: CoreState; index: number };
export type Timeline = {
    file: ReplayFile;
    startTick: number;
    endTick: number;
    keyframes: Keyframe[];
    markers: Marker[];
    divergedAt: number | null;
    error: ReplayError | null;
    versionMismatch: boolean;
};
export function createCursor(
    file: Readonly<ReplayFile>,
    from: Keyframe = { state: file.start, index: 0 },
): {
    readonly state: CoreState;
    readonly index: number;
    pending(): 'command' | 'step' | 'end';
    next(): GameEvent[] | null;
    keyframe(): Keyframe;
} {
    let state = from.state;
    let index = from.index;
    const commands = file.commands;
    return {
        get state() {
            return state;
        },
        get index() {
            return index;
        },
        pending(): 'command' | 'step' | 'end' {
            if (index < commands.length && commands[index][0] <= state.tick) {
                return 'command';
            }
            if (state.tick >= file.endTick || !SIMULATED.includes(state.mode)) {
                return 'end';
            }
            return 'step';
        },
        next(): GameEvent[] | null {
            const kind = this.pending();
            if (kind === 'end') {
                return null;
            }
            const result =
                kind === 'command'
                    ? applyCommand(state, commands[index][1])
                    : stepGame(state);
            if (kind === 'command') {
                index++;
            }
            state = result.state;
            return result.events;
        },
        keyframe(): Keyframe {
            return { state, index };
        },
    };
}
export function buildTimeline(
    input: Readonly<ReplayFile>,
    keyframeInterval: number = REPLAY_DEFAULTS.keyframeInterval,
): Timeline {
    validateTimelineSize(input);
    const file = clonePlain(input) as ReplayFile;
    const cursor = createCursor(file);
    const keyframes: Keyframe[] = [cursor.keyframe()];
    const markers: Marker[] = [];
    const hashes = new Map(file.hashes);
    let divergedAt: number | null = null;
    let error: ReplayError | null = null;
    for (;;) {
        const before = cursor.state;
        if (
            before.tick % keyframeInterval === 0 &&
            keyframes.at(-1)!.state.tick !== before.tick
        ) {
            keyframes.push(cursor.keyframe());
        }
        const kind = cursor.pending();
        let events: GameEvent[] | null;
        try {
            events = cursor.next();
        } catch (e) {
            error = {
                tick: before.tick,
                at: kind === 'command' ? 'command' : 'step',
                message: e instanceof Error ? e.message : String(e),
            };
            markers.push({ tick: before.tick, kind: 'error' });
            break;
        }
        if (!events) {
            break;
        }
        const after = cursor.state;
        if (after.deaths > before.deaths) {
            markers.push({ tick: after.tick, kind: 'death' });
        }
        addTimelineMarkers(events, markers, after.tick);
        if (
            kind === 'step' &&
            divergedAt === null &&
            hashes.has(after.tick) &&
            hashes.get(after.tick) !== hashState(after)
        ) {
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
// Position after the step reaching `tick`, before commands at that tick.
export function seekTimeline(
    timeline: Readonly<Timeline>,
    tick: number,
): {
    readonly state: CoreState;
    readonly index: number;
    pending(): 'command' | 'step' | 'end';
    next(): GameEvent[] | null;
    keyframe(): Keyframe;
} {
    const target = Math.max(
        timeline.startTick,
        Math.min(timeline.endTick, tick),
    );
    let keyframe = timeline.keyframes[0];
    for (const candidate of timeline.keyframes) {
        if (candidate.state.tick <= target) {
            keyframe = candidate;
        } else {
            break;
        }
    }
    const cursor = createCursor(timeline.file, keyframe);
    while (cursor.state.tick < target && cursor.pending() !== 'end') {
        cursor.next();
    }
    return cursor;
}
export type ReplayCursor = ReturnType<typeof createCursor>;
export type ReplayErrorEntry = ReplayError & {
    time: string;
    stage: number | null;
    replay: ReplayFile | null;
};
export type ReplayData = {
    kind: 'the-chair-replay-data';
    format: typeof REPLAY_FORMAT;
    version: string;
    exportedAt: string;
    userAgent: string;
    attempts: ReplayFile[];
    errors: ReplayErrorEntry[];
};
export type ReplaySource = {
    label: string;
    kind: 'attempt' | 'error' | 'file';
    file: ReplayFile;
    error: ReplayErrorEntry | null;
};
export function readReplaySources(text: string): {
    sources: ReplaySource[];
    data: Record<string, unknown> | null;
} {
    const raw = readReplayJson(text);
    const seconds = (file: ReplayFile) =>
        (replayLength(file) / 120).toFixed(1) + 's';
    const sources: ReplaySource[] = [];
    if (
        isRecord(raw) &&
        (raw.kind === 'the-chair-replay-data' ||
            raw.kind === 'the-chair-error-log')
    ) {
        const attempts = raw.attempts === undefined ? [] : raw.attempts;
        const errors = raw.errors ?? raw.entries ?? [];
        if (!isArray(attempts)) {
            throw new Error('replay attempts must be an array');
        }
        if (!isArray(errors)) {
            throw new Error('replay errors must be an array');
        }
        if (attempts.length + errors.length > REPLAY_FILE_LIMITS.sources) {
            throw new Error('too many replays inside');
        }
        attempts.forEach((attempt, i) => {
            try {
                const serialized = JSON.stringify(attempt);
                const file = parseReplay(serialized);
                sources.push({
                    label: `#${i + 1} · stage ${file.start.stage} · ${seconds(file)}${file.error ? ' · error' : ''}`,
                    kind: 'attempt',
                    file,
                    error: null,
                });
            } catch {}
        });
        errors.forEach((value) => {
            if (
                !isRecord(value) ||
                value.replay === undefined ||
                value.replay === null
            ) {
                return;
            }
            try {
                const serialized = JSON.stringify(value.replay);
                const file = parseReplay(serialized);
                const parsed = parseReplayError(value);
                if (!parsed) {
                    return;
                }
                const time =
                    typeof value.time === 'string' && value.time.length <= 200
                        ? value.time
                        : '';
                const stage =
                    typeof value.stage === 'number' &&
                    Number.isSafeInteger(value.stage)
                        ? value.stage
                        : null;
                const entry: ReplayErrorEntry = {
                    ...parsed,
                    time,
                    stage,
                    replay: file,
                };
                sources.push({
                    label: `error · ${entry.message} · stage ${file.start.stage}`,
                    kind: 'error',
                    file,
                    error: entry,
                });
            } catch {}
        });
        if (!attempts.length && !errors.length) {
            throw new Error('no replays inside');
        }
        if (!sources.length) {
            throw new Error('no usable replay inside');
        }
        return { sources, data: raw };
    }
    const file = parseReplay(text);
    return {
        sources: [
            {
                label: `stage ${file.start.stage} · ${seconds(file)}`,
                kind: 'file',
                file,
                error: null,
            },
        ],
        data: null,
    };
}
class RecorderRuntime {
    private getSettings!: () => ReplaySettings;
    private seed!: number | null;
    private current!: ReplayFile | null;
    private finished!: ReplayFile[];
    constructor(getSettings: () => ReplaySettings, seed: number | null) {
        this.getSettings = getSettings;
        this.seed = seed;
        this.current = null;
        this.finished = [];
    }
    private finish = () => {
        if (!this.current) {
            return;
        }
        const file = this.current;
        this.current = null;
        // A retry or stage change ends an attempt; drop those trailing commands
        // so the replay ends on the attempt itself.
        while (
            file.commands.length &&
            file.commands.at(-1)![0] >= file.endTick &&
            ['reset', 'restart', 'startStage'].includes(
                file.commands.at(-1)![1].type,
            )
        ) {
            file.commands.pop();
        }
        if (replayLength(file) <= 0 && !file.error) {
            return;
        }
        this.finished.push(file);
        const keep = this.getSettings().keepAttempts;
        while (this.finished.length > keep) {
            this.finished.shift();
        }
    };
    api(): {
        onAttemptStart(json: string): void;
        onCommand(tick: number, command: Command): void;
        onStep(state: Readonly<CoreState>): void;
        onError(error: ReplayError): void;
        readonly recording: boolean;
        attempts(): ReplayFile[];
        latest(minTicks?: number): ReplayFile | null;
    } {
        const readRecording = () => {
            return !!this.current;
        };
        return {
            onAttemptStart: this.apiOnAttemptStart,
            onCommand: this.apiOnCommand,
            onStep: this.apiOnStep,
            onError: this.apiOnError,
            get recording() {
                return readRecording();
            },
            attempts: this.apiAttempts,
            latest: this.apiLatest,
        };
    }
    private apiOnAttemptStart = (json: string) => {
        this.finish();
        if (!this.getSettings().enabled) {
            return;
        }
        const start = JSON.parse(json) as CoreState;
        this.current = {
            format: REPLAY_FORMAT,
            version: CONFIG_VERSION,
            seed: this.seed,
            start,
            commands: [],
            hashes: [],
            endTick: start.tick,
            truncated: false,
            error: null,
        };
    };
    private apiOnCommand = (tick: number, command: Command) => {
        if (!this.current || this.current.truncated) {
            return;
        }
        if (
            this.current.commands.length >=
            Math.min(
                this.getSettings().maxCommands,
                REPLAY_FILE_LIMITS.commands,
            )
        ) {
            this.current.truncated = true;
            return;
        }
        this.current.commands.push([tick, clonePlain(command)]);
    };
    private apiOnStep = (state: Readonly<CoreState>) => {
        if (!this.current || this.current.truncated || this.current.error) {
            return;
        }
        const lastTick = this.current.start.tick + REPLAY_FILE_LIMITS.ticks;
        if (state.tick > lastTick) {
            this.current.endTick = lastTick;
            this.current.truncated = true;
            return;
        }
        this.current.endTick = state.tick;
        if (state.tick % this.getSettings().hashInterval === 0) {
            this.current.hashes.push([state.tick, hashState(state)]);
        }
    };
    private apiOnError = (error: ReplayError) => {
        if (!this.current || this.current.error) {
            return;
        }
        this.current.error = clonePlain(error);
        // A failing step happens on the next tick: simulate up to it so
        // playback reproduces the error.
        if (error.at === 'step') {
            this.current.endTick = error.tick + 1;
        }
    };
    private apiAttempts = (): ReplayFile[] => {
        return [this.current, ...this.finished.slice().reverse()]
            .filter((file): file is ReplayFile => !!file)
            .map((file) => clonePlain(file));
    };
    private apiLatest = (
        minTicks: number | undefined = 60,
    ): ReplayFile | null => {
        const file = [this.current, ...this.finished.slice().reverse()].find(
            (file) => file && (replayLength(file) >= minTicks || !!file.error),
        );
        return file ? clonePlain(file) : null;
    };
}

function validateTimelineSize(input: Readonly<ReplayFile>) {
    if (input.endTick - input.start.tick > REPLAY_FILE_LIMITS.ticks) {
        throw new Error('replay is too long');
    }
    if (input.commands.length > REPLAY_FILE_LIMITS.commands) {
        throw new Error('too many commands');
    }
    if (input.hashes.length > REPLAY_FILE_LIMITS.hashes) {
        throw new Error('too many hashes');
    }
}
function addTimelineMarkers(
    events: GameEvent[],
    markers: Marker[],
    tick: number,
) {
    for (const event of events) {
        if (event.type === 'reset') {
            markers.push({ tick, kind: 'reset' });
        }
        if (event.type === 'cue' && event.id === 'checkpoint') {
            markers.push({ tick, kind: 'checkpoint' });
        }
        if (event.type === 'cue' && event.id === 'stage-clear') {
            markers.push({ tick, kind: 'clear' });
        }
    }
}

function readReplayJson(text: string): unknown {
    if (text.length > REPLAY_FILE_LIMITS.characters) {
        throw new Error('replay file is too large');
    }
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        throw new Error('not JSON');
    }

    return raw;
}
