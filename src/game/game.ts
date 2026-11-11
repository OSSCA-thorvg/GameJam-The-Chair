import type { StageId } from './stages/building/data';
import { LEVEL, FIXED_STEP } from './level';
import type { Input, DeepReadonly, GameEvent } from './types';
import { clonePlain } from './data';
import { cloneState, createCore, parseState, serializeState, type GameState as CoreState, type Progress } from './state';
import type { Command } from './commands';
import { SIMULATED, applyCommand, stageSolids, stepGame } from './step';
import { STAGES } from './stages/index';
import { focusBlocked } from './systems/focus/decide';
import { applyFocusLoss } from './systems/focus/apply';
import { applyImpact } from './systems/impact/apply';
import { monitorPhase } from './stages/office/monitor/decide';
import { canEnterMeeting } from './stages/building/corridor/decide';

export type { Command } from './commands';
export { stepGame, applyCommand, replayCommands, type CommandLog, type StepResult } from './step';
export { createCore, parseState, type GameState as CoreState } from './state';
export { CONFIG_VERSION } from './stages/index';

export type GameOptions = {
    // Same seed, start and commands always produce the same run. The browser passes a random seed.
    seed?: number;
    progress?: Partial<Pick<Progress, 'deaths' | 'completedStage'>>;
    // Recording hooks. An attempt starts on creation and on every reset, including falls and stage changes
    // inside a step; `state` is the serialized state at that moment. Commands that follow belong to it.
    onAttemptStart?: (state: string) => void;
    onCommand?: (tick: number, command: Command) => void;
    // Called after every fixed step with the new state (read-only) and the events it produced.
    onStep?: (state: Readonly<CoreState>, events: readonly GameEvent[]) => void;
    // Called when a step or command throws. The game keeps its previous state and rethrows.
    onError?: (error: GameError) => void;
};

export type GameError = { tick: number; at: 'step' | 'command'; message: string; stack?: string; command?: Command };

function describe(error: unknown) {
    return error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
}

// Imperative shell around the deterministic core: holds the current state, turns real frame time into
// fixed steps, records commands and buffers events for the presentation layer. Each step or command
// produces a new state object; the shell only swaps which one it holds.
export function createGame(options: GameOptions = {}) {
    let s: CoreState = createCore({ seed: options.seed ?? 0, deaths: options.progress?.deaths, completedStage: options.progress?.completedStage });
    // Real frame time waiting to become fixed steps. Shell-only: it never reaches game state.
    let acc = 0;
    const pending: GameEvent[] = [];

    function emit(events: readonly GameEvent[]) {
        pending.push(...events);
        if (events.some(event => event.type === 'reset')) options.onAttemptStart?.(serializeState(s));
    }

    function send(command: Command) {
        // Record before applying so a reset's new attempt starts after the command that caused it.
        options.onCommand?.(s.tick, command);
        let result;
        try {
            result = applyCommand(s, command);
        } catch (error) {
            options.onError?.({ tick: s.tick, at: 'command', command, ...describe(error) });
            throw error;
        }
        s = result.state;
        if (command.type === 'pause' || command.type === 'reset' || command.type === 'restart' || command.type === 'startStage') acc = 0;
        emit(result.events);
    }

    function setKeys(keys: Input[]) {
        if (keys.length === s.keys.length && keys.every((key, i) => key === s.keys[i])) return;
        send({ type: 'keys', keys });
    }

    function tick() {
        let result;
        try {
            result = stepGame(s);
        } catch (error) {
            options.onError?.({ tick: s.tick, at: 'step', ...describe(error) });
            throw error;
        }
        s = result.state;
        emit(result.events);
        options.onStep?.(s, result.events);
    }

    // Preview-only scrubbing at arbitrary frame times. Never used by real play or replays.
    function preview(run: (next: CoreState, out: GameEvent[]) => void) {
        const next = cloneState(s);
        const out: GameEvent[] = [];
        run(next, out);
        s = next;
        emit(out);
    }

    // Every call returns a copy the caller owns (UI and tests may edit it). States are never modified
    // after a step, so a shared read-only view would be safe for the core, but it would change this contract.
    function getSnapshot() {
        return viewState(s);
    }
    function advance(dt: number) {
        if (!Number.isFinite(dt) || dt < 0) return;
        if (!SIMULATED.includes(s.mode)) {
            acc = 0;
            return;
        }
        acc += dt;
        while (acc >= FIXED_STEP) {
            const mode = s.mode;
            tick();
            acc -= FIXED_STEP;
            // A new mode starts counting from the next frame, as before fixed ticks.
            if (s.mode !== mode) {
                acc = 0;
                break;
            }
        }
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
            if (s.mode === 'play' && !s.keys.includes(input)) setKeys([...s.keys, input]);
        },
        release(input: Input) {
            if (s.keys.includes(input)) setKeys(s.keys.filter(key => key !== input));
        },
        clearInput: () => setKeys([]),
        /** One fixed step (1/120 s). The argument is ignored and kept for older callers. */
        step: (_dt?: number) => tick(),
        advance,
        // Preview-only scrubbing at arbitrary frame times. Never used by real play or replays.
        advanceImpact: (dt: number) => preview((next, out) => applyImpact(next, out, dt)),
        advanceFocusLoss: (dt: number) => preview((next, out) => applyFocusLoss(next, out, dt)),
        /** Full game state as JSON. Restoring it into any game continues the run exactly. */
        serialize: () => serializeState(s),
        restore(json: string) {
            s = parseState(json);
            acc = 0;
        },
        getSnapshot: getSnapshot as () => DeepReadonly<ReturnType<typeof viewState>>,
        drainEvents() {
            return pending.splice(0);
        },
    };
}

/** The presentation view of a core state, as a detached copy. Used by the shell and the replay player. */
export function viewState(s: Readonly<CoreState>) {
    return clonePlain({
        game: STAGES[s.stage].name,
        spray: { burst: s.sprayBurst, cooldown: s.sprayCooldown, dir: s.sprayDir },
        lessons: s.lessons,
        officeCheckpoint: s.stage === 1 && s.checkpoint > 0,
        skylineSeed: s.skylineSeed,
        actualSpeed: s.mode === 'play' ? s.actualSpeed : 0,
        tutorialAssist: s.mode === 'play' && s.p.x < 300,
        stage: s.stage,
        sky: s.sky,
        completedStage: s.completedStage,
        hasExtinguisher: s.hasExtinguisher,
        firstFlight: s.firstFlight,
        rooftopEntrance: s.rooftopEntrance,
        ductReaction: s.ductReaction,
        checkpoint: s.checkpoint,
        furniture: s.furniture,
        corridor: s.corridor,
        canEnterMeeting: canEnterMeeting(s),
        level: { length: STAGES[s.stage].length, goal: STAGES[s.stage].goal },
        mode: s.mode,
        focus: s.focus,
        focusClock: s.focusClock,
        focusLossTime: s.focusLossTime,
        focusNotice: s.focusNotice,
        lossReason: s.lossReason,
        player: s.p,
        ground: s.ground,
        slip: s.slip,
        dirty: s.dirty,
        inBin: s.inBin,
        binAge: s.binAge,
        time: s.time,
        deaths: s.deaths,
        bursts: s.bursts,
        paperHits: s.paperHits,
        binFalls: s.binFalls,
        dirtyWaterExperienced: s.wetSeen,
        cleaningSpilled: s.cleaning.spilled,
        soaked: s.soakedOnSpill > 0,
        bucketAge: s.bucket.age,
        paperPenaltyRemaining: s.paperPenaltyRemaining,
        lightPenaltyRemaining: s.lightPenaltyRemaining,
        cleaning: s.cleaning,
        lightHits: s.lightHits,
        doorHits: s.doorHits,
        monitors: LEVEL.monitors.map(monitor => ({ ...monitor, ...monitorPhase(monitor, s.time) })),
        papers: s.papers,
        people: s.people,
        solids: stageSolids(s).map(p => ({ p })),
        copier: s.copier,
        bin: LEVEL.bin,
        focusBlocked: focusBlocked(s),
    });
}

export type Game = ReturnType<typeof createGame>;
export type GameState = ReturnType<Game['getSnapshot']>;
