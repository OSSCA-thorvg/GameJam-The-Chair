import type { StageId } from './stage2';
import { LEVEL, FIXED_STEP } from './level';
import type { Input, DeepReadonly, GameEvent } from './types';
import { createCore, serializeState, restoreState, type Progress } from './state';
import { applyCommand, type Command } from './commands';
import { SIMULATED, stageSolids, stepGame } from './step';
import { STAGES } from './stages';
import { focusBlocked, advanceFocusLoss } from './systems/focus';
import { monitorPhase } from './systems/monitor';
import { impactStep } from './systems/impact';
import { canEnterMeeting } from './systems/corridor';

export type { Command } from './commands';
export { stepGame, replayCommands, type CommandLog } from './step';
export { CONFIG_VERSION } from './stages';

export type GameOptions = {
    // Same seed, start and commands always produce the same run. The browser passes a random seed.
    seed?: number;
    progress?: Partial<Pick<Progress, 'deaths' | 'completedStage'>>;
    // Recording hooks. An attempt starts on creation and on every reset, including falls and stage changes
    // inside a step; `state` is the serialized state at that moment. Commands that follow belong to it.
    onAttemptStart?: (state: string) => void;
    onCommand?: (tick: number, command: Command) => void;
};

// Imperative shell around the deterministic core: holds the state, turns real frame time into fixed
// steps, records commands and buffers events for the presentation layer.
export function createGame(options: GameOptions = {}) {
    const s = createCore({ seed: options.seed ?? 0, deaths: options.progress?.deaths, completedStage: options.progress?.completedStage });
    // Real frame time waiting to become fixed steps. Shell-only: it never reaches game state.
    let acc = 0;
    const pending: GameEvent[] = [];

    function emit(events: readonly GameEvent[]) {
        pending.push(...events);
        if (events.some(event => event.type === 'reset')) options.onAttemptStart?.(serializeState(s));
    }

    function send(command: Command) {
        const out: GameEvent[] = [];
        // Record before applying so a reset's new attempt starts after the command that caused it.
        options.onCommand?.(s.tick, command);
        applyCommand(s, command, out);
        if (command.type === 'pause' || command.type === 'reset' || command.type === 'restart' || command.type === 'startStage') acc = 0;
        emit(out);
    }

    function setKeys(keys: Input[]) {
        if (keys.length === s.keys.length && keys.every((key, i) => key === s.keys[i])) return;
        send({ type: 'keys', keys });
    }

    function tick() {
        emit(stepGame(s));
    }

    function getSnapshot() {
        return structuredClone({
            game: STAGES[s.stage].name,
            spray: { burst: s.sprayBurst, cooldown: s.sprayCooldown, dir: s.sprayDir },
            lessons: s.lessons,
            officeCheckpoint: s.stage === 1 && s.checkpoint > 0,
            skylineSeed: s.skylineSeed,
            actualSpeed: s.mode === 'play' ? s.actualSpeed : 0,
            tutorialAssist: s.mode === 'play' && s.p.x < 300,
            stage: s.stage,
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
        advanceImpact: (dt: number) => emit(withEvents(out => impactStep(s, out, dt))),
        advanceFocusLoss: (dt: number) => emit(withEvents(out => advanceFocusLoss(s, out, dt))),
        /** Full game state as JSON. Restoring it into any game continues the run exactly. */
        serialize: () => serializeState(s),
        restore(json: string) {
            restoreState(s, json);
            acc = 0;
        },
        getSnapshot: getSnapshot as () => DeepReadonly<ReturnType<typeof getSnapshot>>,
        drainEvents() {
            return pending.splice(0);
        },
    };
}

function withEvents(run: (out: GameEvent[]) => void) {
    const out: GameEvent[] = [];
    run(out);
    return out;
}

export type Game = ReturnType<typeof createGame>;
export type GameState = ReturnType<Game['getSnapshot']>;
