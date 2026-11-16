import { FIXED_STEP } from './level';
import { viewState } from './snapshot';
import { cloneState, createCore, parseState, serializeState } from './state';
import { SIMULATED, applyCommand, stepGame } from './step';
import { applyFocusLoss } from './systems/focus/apply';
import { applyImpact } from './systems/impact/apply';

import type { Command } from './commands';
import type { GameSnapshot } from './snapshot';
import type { SkyState } from './stages/sky/data';
import type { CoreState, Progress } from './state';
import type { Input, GameEvent, Mode, StageId } from './types';
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
export function createGame(options: GameOptions = {}): Game {
    return new GameRuntime(options).api();
}
export type Game = {
    send: (command: Command) => void;
    reset: () => void;
    restart: () => void;
    startStage: (id: StageId) => void;
    jump: () => void;
    spray: () => void;
    interact: () => void;
    leaveMeeting: () => void;
    pause: () => void;
    setInput: (...input: Input[]) => void;
    press(input: Input): void;
    release(input: Input): void;
    clearInput: () => void;
    step: (_dt?: number) => void;
    advance: (dt: number) => AdvanceResult;
    advanceImpact: (dt: number) => void;
    advanceFocusLoss: (dt: number) => void;
    serialize: () => string;
    restore(json: string): void;
    status: () => GameStatus;
    getSnapshot: () => GameSnapshot;
    drainEvents(): GameEvent[];
};
class GameRuntime {
    private options!: GameOptions;
    private s!: CoreState;
    private acc!: number;
    private pending!: GameEvent[];
    constructor(options: GameOptions) {
        this.options = options;
        this.s = createCore({
            seed: this.options.seed ?? 0,
            deaths: this.options.progress?.deaths,
            completedStage: this.options.progress?.completedStage,
        });
        this.acc = 0;
        this.pending = [];
        this.options.onAttemptStart?.(serializeState(this.s));
    }
    private emit = (events: readonly GameEvent[]) => {
        this.pending.push(...events);
        if (events.some((event) => event.type === 'reset')) {
            this.options.onAttemptStart?.(serializeState(this.s));
        }
    };
    private send = (command: Command) => {
        // Record before applying so a reset's new attempt starts after the
        // command that caused it.
        this.options.onCommand?.(this.s.tick, command);
        let result;
        try {
            result = applyCommand(this.s, command);
        } catch (error) {
            this.options.onError?.(
                {
                    tick: this.s.tick,
                    at: 'command',
                    command,
                    ...describe(error),
                },
                error,
            );
            throw error;
        }
        this.s = result.state;
        if (
            command.type === 'pause' ||
            command.type === 'reset' ||
            command.type === 'restart' ||
            command.type === 'startStage'
        ) {
            this.acc = 0;
        }
        this.emit(result.events);
    };
    private setKeys = (keys: Input[]) => {
        if (
            keys.length === this.s.keys.length &&
            keys.every((key, i) => key === this.s.keys[i])
        ) {
            return;
        }
        this.send({ type: 'keys', keys });
    };
    private tick = () => {
        let result;
        try {
            result = stepGame(this.s);
        } catch (error) {
            this.options.onError?.(
                { tick: this.s.tick, at: 'step', ...describe(error) },
                error,
            );
            throw error;
        }
        this.s = result.state;
        this.emit(result.events);
        this.options.onStep?.(this.s, result.events);
    };
    private preview = (run: (next: CoreState, out: GameEvent[]) => void) => {
        const next = cloneState(this.s);
        const out: GameEvent[] = [];
        run(next, out);
        this.s = next;
        this.emit(out);
    };
    private status = (): GameStatus => {
        return {
            mode: this.s.mode,
            stage: this.s.stage,
            completedStage: this.s.completedStage,
            skyPhase: this.s.sky.phase,
        };
    };
    private getSnapshot = (): GameSnapshot => {
        return viewState(this.s);
    };
    private advance = (dt: number): AdvanceResult => {
        if (!Number.isFinite(dt) || dt < 0) {
            return { ticks: 0, dropped: 0 };
        }
        if (!SIMULATED.includes(this.s.mode)) {
            const dropped = this.acc;
            this.acc = 0;
            return { ticks: 0, dropped };
        }
        const discarded = Math.max(0, dt - 0.25);
        this.acc += Math.min(dt, 0.25);
        let ticks = 0;
        let dropped = discarded;
        while (this.acc >= FIXED_STEP) {
            const mode = this.s.mode;
            this.tick();
            ticks++;
            this.acc -= FIXED_STEP;
            if (this.s.mode !== mode) {
                dropped += this.acc;
                this.acc = 0;
                break;
            }
        }
        return { ticks, dropped };
    };
    api(): Game {
        return {
            send: this.send,
            reset: this.apiReset,
            restart: this.apiRestart,
            startStage: this.apiStartStage,
            jump: this.apiJump,
            spray: this.apiSpray,
            interact: this.apiInteract,
            leaveMeeting: this.apiLeaveMeeting,
            pause: this.apiPause,
            setInput: this.apiSetInput,
            press: this.apiPress,
            release: this.apiRelease,
            clearInput: this.apiClearInput,
            step: this.apiStep,
            advance: this.advance,
            advanceImpact: this.apiAdvanceImpact,
            advanceFocusLoss: this.apiAdvanceFocusLoss,
            serialize: this.apiSerialize,
            restore: this.apiRestore,
            status: this.status,
            getSnapshot: this.getSnapshot,
            drainEvents: this.apiDrainEvents,
        };
    }
    private apiReset = () => {
        return this.send({ type: 'reset' });
    };
    private apiRestart = () => {
        return this.send({ type: 'restart' });
    };
    private apiStartStage = (id: StageId) => {
        return this.send({ type: 'startStage', id });
    };
    private apiJump = () => {
        return this.send({ type: 'jump' });
    };
    private apiSpray = () => {
        return this.send({ type: 'spray' });
    };
    private apiInteract = () => {
        return this.send({ type: 'interact' });
    };
    private apiLeaveMeeting = () => {
        return this.send({ type: 'leaveMeeting' });
    };
    private apiPause = () => {
        return this.send({ type: 'pause' });
    };
    private apiSetInput = (...input: Input[]) => {
        return this.setKeys([...new Set(input)]);
    };
    private apiPress = (input: Input) => {
        if (this.s.mode === 'play' && !this.s.keys.includes(input)) {
            this.setKeys([...this.s.keys, input]);
        }
    };
    private apiRelease = (input: Input) => {
        if (this.s.keys.includes(input)) {
            this.setKeys(this.s.keys.filter((key) => key !== input));
        }
    };
    private apiClearInput = () => {
        return this.setKeys([]);
    };
    private apiStep = (_dt?: number) => {
        return this.tick();
    };
    private apiAdvanceImpact = (dt: number) => {
        return this.preview((next, out) => applyImpact(next, out, dt));
    };
    private apiAdvanceFocusLoss = (dt: number) => {
        return this.preview((next, out) => applyFocusLoss(next, out, dt));
    };
    private apiSerialize = () => {
        return serializeState(this.s);
    };
    private apiRestore = (json: string) => {
        this.s = parseState(json);
        this.acc = 0;
    };
    private apiDrainEvents = () => {
        return this.pending.splice(0);
    };
}
