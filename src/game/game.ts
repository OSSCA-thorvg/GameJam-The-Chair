import { FIXED_STEP } from './level';
import type { Input, GameEvent, Mode, StageId } from './types';
import type { SkyState } from './stages/sky/data';
import {
    cloneState,
    createCore,
    parseState,
    serializeState,
    type CoreState,
    type Progress,
} from './state';
import type { Command } from './commands';
import { SIMULATED, applyCommand, stepGame } from './step';
import { applyFocusLoss } from './systems/focus/apply';
import { applyImpact } from './systems/impact/apply';
import { viewState, type GameSnapshot } from './snapshot';

export type { GameSnapshot } from './snapshot';

export { viewState } from './snapshot';

export type { Command } from './commands';
export {
    stepGame,
    applyCommand,
    replayCommands,
    type CommandLog,
    type StepResult,
} from './step';
export { createCore, parseState, type CoreState } from './state';
export { CONFIG_VERSION } from './stages/index';

export type GameOptions = {
    seed?: number;
    progress?: Partial<Pick<Progress, 'deaths' | 'completedStage'>>;
    onAttemptStart?: (state: string) => void;
    onCommand?: (tick: number, command: Command) => void;
    onStep?: (state: Readonly<CoreState>, events: readonly GameEvent[]) => void;
    onError?: (error: GameError, cause: unknown) => void;
};

export type GameStatus = {
    mode: Mode;
    stage: StageId;
    completedStage: 0 | StageId;
    skyPhase: SkyState['phase'];
};

export type AdvanceResult = { ticks: number; dropped: number };

export type GameError = {
    tick: number;
    at: 'step' | 'command';
    message: string;
    stack?: string;
    command?: Command;
};

function describe(error: unknown) {
    return error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { message: String(error) };
}

export function createGame(options: GameOptions = {}) {
    let s: CoreState = createCore({
        seed: options.seed ?? 0,
        deaths: options.progress?.deaths,
        completedStage: options.progress?.completedStage,
    });
    let acc = 0;
    const pending: GameEvent[] = [];

    function emit(events: readonly GameEvent[]) {
        pending.push(...events);
        if (events.some((event) => event.type === 'reset')) {
            options.onAttemptStart?.(serializeState(s));
        }
    }

    function send(command: Command) {
        // Record before applying so a reset's new attempt starts after the
        // command that caused it.
        options.onCommand?.(s.tick, command);
        let result;
        try {
            result = applyCommand(s, command);
        } catch (error) {
            options.onError?.(
                { tick: s.tick, at: 'command', command, ...describe(error) },
                error,
            );
            throw error;
        }
        s = result.state;
        if (
            command.type === 'pause' ||
            command.type === 'reset' ||
            command.type === 'restart' ||
            command.type === 'startStage'
        ) {
            acc = 0;
        }
        emit(result.events);
    }

    function setKeys(keys: Input[]) {
        if (
            keys.length === s.keys.length &&
            keys.every((key, i) => key === s.keys[i])
        ) {
            return;
        }
        send({ type: 'keys', keys });
    }

    function tick() {
        let result;
        try {
            result = stepGame(s);
        } catch (error) {
            options.onError?.(
                { tick: s.tick, at: 'step', ...describe(error) },
                error,
            );
            throw error;
        }
        s = result.state;
        emit(result.events);
        options.onStep?.(s, result.events);
    }

    function preview(run: (next: CoreState, out: GameEvent[]) => void) {
        const next = cloneState(s);
        const out: GameEvent[] = [];
        run(next, out);
        s = next;
        emit(out);
    }

    function status(): GameStatus {
        return {
            mode: s.mode,
            stage: s.stage,
            completedStage: s.completedStage,
            skyPhase: s.sky.phase,
        };
    }

    // Returns a detached presentation snapshot.
    function getSnapshot(): GameSnapshot {
        return viewState(s);
    }
    function advance(dt: number): AdvanceResult {
        if (!Number.isFinite(dt) || dt < 0) return { ticks: 0, dropped: 0 };
        if (!SIMULATED.includes(s.mode)) {
            const dropped = acc;
            acc = 0;
            return { ticks: 0, dropped };
        }
        const discarded = Math.max(0, dt - 0.25);
        acc += Math.min(dt, 0.25);
        let ticks = 0;
        let dropped = discarded;
        while (acc >= FIXED_STEP) {
            const mode = s.mode;
            tick();
            ticks++;
            acc -= FIXED_STEP;
            if (s.mode !== mode) {
                dropped += acc;
                acc = 0;
                break;
            }
        }
        return { ticks, dropped };
    }

    options.onAttemptStart?.(serializeState(s));

    return {
        send,
        reset: () => send({ type: 'reset' }),
        restart: () => send({ type: 'restart' }),
        startStage: (id: StageId) => send({ type: 'startStage', id }),
        jump: () => send({ type: 'jump' }),
        spray: () => send({ type: 'spray' }),
        interact: () => send({ type: 'interact' }),
        leaveMeeting: () => send({ type: 'leaveMeeting' }),
        pause: () => send({ type: 'pause' }),
        setInput: (...input: Input[]) => setKeys([...new Set(input)]),
        press(input: Input) {
            if (s.mode === 'play' && !s.keys.includes(input)) {
                setKeys([...s.keys, input]);
            }
        },
        release(input: Input) {
            if (s.keys.includes(input)) {
                setKeys(s.keys.filter((key) => key !== input));
            }
        },
        clearInput: () => setKeys([]),
        step: (_dt?: number) => tick(),
        advance,
        advanceImpact: (dt: number) =>
            preview((next, out) => applyImpact(next, out, dt)),
        advanceFocusLoss: (dt: number) =>
            preview((next, out) => applyFocusLoss(next, out, dt)),
        serialize: () => serializeState(s),
        restore(json: string) {
            s = parseState(json);
            acc = 0;
        },
        status,
        getSnapshot,
        drainEvents() {
            return pending.splice(0);
        },
    };
}

export type Game = ReturnType<typeof createGame>;
