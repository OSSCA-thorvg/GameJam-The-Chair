import { runCommand, spray } from './commands';
import { FIXED_STEP, PHYSICS } from './level';
import * as Det from './math';
import { collide, drivePlayer, fellOffFloor } from './physics';
import { stageHooks } from './stages/hooks';
import { PRACTICE_PILE, STAGES, inCheckpointArea } from './stages/index';
import { cloneState, resetAttempt, setPlayer, snapshot } from './state';
import { applyFocusLoss } from './systems/focus/apply';
import { applyFocusRecovery } from './systems/focus/recovery';
import { applyHeadHit, applyImpact } from './systems/impact/apply';

import type { Command } from './commands';
import type { CoreState } from './state';
import type { DeepReadonly, GameEvent, Mode, Point } from './types';

export const SIMULATED: readonly Mode[] = ['play', 'impact', 'focuslost'];

export type StepResult = { state: CoreState; events: GameEvent[] };

export function stepGame(
    state: Readonly<CoreState>,
    commands: readonly Command[] = [],
): StepResult {
    const s = cloneState(state);
    const events: GameEvent[] = [];
    for (const command of commands) {
        runCommand(s, command, events);
    }
    advanceMode(s, events);
    return { state: s, events };
}

export function applyCommand(
    state: Readonly<CoreState>,
    command: Command,
): StepResult {
    const s = cloneState(state);
    const events: GameEvent[] = [];
    runCommand(s, command, events);
    return { state: s, events };
}

function advanceMode(s: CoreState, out: GameEvent[]) {
    switch (s.mode) {
        case 'play':
            s.tick++;
            playStep(s, out, FIXED_STEP);
            return;
        case 'impact':
            s.tick++;
            applyImpact(s, out, FIXED_STEP);
            return;
        case 'focuslost':
            s.tick++;
            applyFocusLoss(s, out, FIXED_STEP);
            return;
        case 'intro':
        case 'pause':
        case 'dead':
        case 'won':
            return;
    }
}

export type CommandLog = ReadonlyArray<
    readonly [tick: number, command: Command]
>;

// The command log must start at the tick of the saved state.
export function replayCommands(
    start: Readonly<CoreState>,
    log: CommandLog,
    endTick: number,
): StepResult {
    const s = cloneState(start);
    const events: GameEvent[] = [];
    const advanceTo = (tick: number) => {
        while (s.tick < tick && SIMULATED.includes(s.mode)) {
            advanceMode(s, events);
        }
    };
    for (const [tick, command] of log) {
        if (tick < s.tick) {
            throw new Error(
                `Command at tick ${tick} precedes the saved state at tick ${s.tick}.`,
            );
        }
        advanceTo(tick);
        runCommand(s, command, events);
    }
    advanceTo(endTick);
    return { state: s, events };
}

function playStep(s: CoreState, out: GameEvent[], dt: number) {
    const hooks = stageHooks(s.stage);
    const stage = STAGES[s.stage];
    s.history.push(snapshot(s));
    if (s.history.length > 60) {
        s.history.shift();
    }
    s.time += dt;
    s.rollCooldown = Math.max(0, s.rollCooldown - dt);
    s.reverseCooldown = Math.max(0, s.reverseCooldown - dt);
    s.extinguisher.cooldown = Math.max(0, s.extinguisher.cooldown - dt);
    s.extinguisher.burst = Math.max(0, s.extinguisher.burst - dt);
    hooks.timers?.(s, dt);
    if (s.keys.includes('spray')) {
        spray(s, out);
    }
    out.push({ type: 'tick', dt });
    if (hooks.takeover?.(s, out, dt)) {
        return;
    }
    if (hooks.hazards && !hooks.hazards(s, out, dt)) {
        return;
    }

    const p = s.p;
    const was = s.ground;
    const inputDir =
        (s.keys.includes('right') ? 1 : 0) - (s.keys.includes('left') ? 1 : 0);
    const prev = p.x;
    s.coyote = s.ground ? PHYSICS.jump.coyote : Math.max(0, s.coyote - dt);
    s.jumpQ = Math.max(0, s.jumpQ - dt);
    hooks.beforeDrive?.(s, out, was);
    if (s.jumpQ > 0 && s.coyote > 0) {
        if (p.x < PHYSICS.upright.tutorialUntilX) {
            s.practiceJump = true;
        }
        p.vy = -PHYSICS.jump.speed;
        p.w -= inputDir * PHYSICS.jump.spin;
        s.ground = false;
        hooks.onJump?.(s);
        s.coyote = 0;
        s.jumpQ = 0;
    }
    const tweak = hooks.drive?.(s, inputDir) ?? {};
    const dir = tweak.dir ?? inputDir;
    const convoyJump = tweak.convoyJump ?? false;
    const expressJump = tweak.expressJump ?? false;
    const slip = tweak.slip ?? false;
    const balancing = s.keys.includes('q') || s.keys.includes('e');
    const tilt =
        (s.keys.includes('e') ? 1 : 0) -
        (s.keys.includes('q') ? 1 : 0) +
        (was || balancing ? 0 : inputDir);
    setPlayer(
        s,
        drivePlayer(
            p,
            {
                grounded: was,
                slip,
                dir,
                tilt,
                upright:
                    p.x < PHYSICS.upright.tutorialUntilX || stage.alwaysUpright,
                convoyJump,
                expressJump,
            },
            dt,
        ),
    );
    if (hooks.afterMove?.(s, out, dt, prev)) {
        return;
    }
    const hit = collide(p, stageSolids(s));
    setPlayer(s, hit.p);
    s.ground = hit.ground;
    if (hit.headHit) {
        applyHeadHit(s, out, hit.headHit);
        return;
    }
    hooks.afterCollide?.(s, out, dt, prev);
    if (s.mode !== 'play') {
        return;
    }
    if (hooks.checkpointsOpen?.(s) ?? true) {
        reachCheckpoints(s, out);
    }
    applyFocusRecovery(s, dt, hooks.focusBlocked?.(s) ?? false);
    if (s.ground) {
        p.w -= Det.sin(p.a) * dt;
    }
    if (p.x < 40) {
        p.x = 40;
        p.vx = Math.max(0, p.vx);
    }
    s.lessons.moved ||= p.x > 140;
    if (
        stage.practicePile &&
        !s.lessons.jumped &&
        s.practiceJump &&
        s.ground &&
        p.x < 330
    ) {
        s.lessons.jumped = true;
        out.push({ type: 'cue', id: 'practice-cleared' });
    }
    s.actualSpeed +=
        (Math.abs(p.x - prev) / dt - s.actualSpeed) * (1 - Det.exp(-dt / 0.12));
    if (s.ground && dir && Math.abs(p.vx) > 95 && s.rollCooldown === 0) {
        out.push({ type: 'cue', id: 'rolling' });
        s.rollCooldown = 9;
    }
    if (s.people.length > 0 && p.vx < -60 && s.reverseCooldown === 0) {
        const n = s.people.reduce((a, b) =>
            Math.abs(a.x - p.x) < Math.abs(b.x - p.x) ? a : b,
        );
        if (Math.abs(n.x - p.x) < 300) {
            out.push({ type: 'cue', id: 'reverse-comment', person: { ...n } });
            s.reverseCooldown = 7;
        }
    }
    for (const n of s.people) {
        if (
            !n.said &&
            Math.min(Math.abs(p.x - n.x), Math.abs(prev - n.x)) < 100
        ) {
            n.said = true;
            out.push({ type: 'cue', id: 'person-comment', person: { ...n } });
        }
    }
    hooks.afterScore?.(s, out, dt);
    if (fellOffFloor(p)) {
        if (hooks.onFall) {
            hooks.onFall(s, out);
        } else {
            s.deaths++;
            resetAttempt(s, out);
        }
        return;
    }
    if (stage.finishAtGoal && p.x > stage.goal) {
        if (s.stage > s.completedStage) {
            s.completedStage = s.stage;
        }
        s.mode = 'won';
        s.keys = [];
        out.push({ type: 'cue', id: 'stage-clear' });
    }
}
export function stageSolids(
    s: CoreState,
): ReadonlyArray<DeepReadonly<Point[]>> {
    const terrain = STAGES[s.stage].terrain;
    return STAGES[s.stage].practicePile && !s.lessons.jumped
        ? [...terrain, PRACTICE_PILE]
        : terrain;
}

function reachCheckpoints(s: CoreState, out: GameEvent[]) {
    const stage = STAGES[s.stage];
    if (stage.checkpointRule === 'land' && !s.ground) {
        return;
    }
    for (let i = s.checkpoint + 1; i < stage.checkpoints.length; i++) {
        if (!inCheckpointArea(stage.checkpoints[i], s.p)) {
            continue;
        }
        s.checkpoint = i;
        s.focus.value = 100;
        s.focus.recoveryClock = 0;
        out.push({ type: 'cue', id: 'checkpoint' });
    }
}
