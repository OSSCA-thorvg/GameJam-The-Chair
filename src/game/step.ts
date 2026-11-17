import { runCommand, spray } from './commands';
import { FIXED_STEP, PHYSICS } from './level';
import * as Det from './math';
import { collide, drivePlayer, fellOffFloor } from './physics';
import { stageHooks } from './stages/hooks';
import { PRACTICE_PILE, STAGES, inCheckpointArea } from './stages/index';
import {
    cloneState,
    resetAttempt,
    setActivity,
    setPlayer,
    snapshot,
} from './state';
import { applyFocusLoss } from './systems/focus/apply';
import { applyFocusRecovery } from './systems/focus/recovery';
import { applyHeadHit, applyImpact } from './systems/impact/apply';

import type { Command } from './commands';
import type { Collision, Drive } from './physics';
import type { StageHooks, Area } from './stages/types';
import type { CoreState } from './state';
import type {
    Player,
    StageId,
    DeepReadonly,
    GameEvent,
    Mode,
    Point,
} from './types';
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
    return new PlayTick(s, out, dt).run();
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
class PlayTick {
    private s!: CoreState;
    private out!: GameEvent[];
    private dt!: number;
    private hooks!: StageHooks;
    private stage!: {
        readonly id: StageId;
        readonly name:
            | 'office-stage-one'
            | 'building-stage-two'
            | 'rooftop-stage-three'
            | 'cloud-stage-four'
            | 'orbit-stage-five';
        readonly length: number;
        readonly goal: number;
        readonly terrain: ReadonlyArray<
            ReadonlyArray<{
                readonly x: number;
                readonly y: number;
            }>
        >;
        readonly checkpoints: ReadonlyArray<{
            readonly x: number;
            readonly y: number;
            readonly area: Area;
        }>;
        readonly checkpointRule: 'pass' | 'land';
        readonly people: ReadonlyArray<{
            readonly id: 'manager' | 'cleaner' | 'admin';
            readonly x: number;
            readonly said: boolean;
        }>;
        readonly practicePile: boolean;
        readonly alwaysUpright: boolean;
        readonly finishAtGoal: boolean;
        readonly newSkylineEachAttempt: boolean;
    };
    private p!: Player;
    private was!: boolean;
    private inputDir!: number;
    private prev!: number;
    private tweak!: Partial<
        Pick<Drive, 'dir' | 'slip' | 'convoyJump' | 'expressJump'>
    >;
    private dir!: number;
    private convoyJump!: boolean;
    private expressJump!: boolean;
    private slip!: boolean;
    private balancing!: boolean;
    private tilt!: number;
    private hit!: Collision;
    constructor(s: CoreState, out: GameEvent[], dt: number) {
        this.s = s;
        this.out = out;
        this.dt = dt;
    }
    run() {
        this.hooks = stageHooks(this.s.stage);
        this.stage = STAGES[this.s.stage];
        this.beginTick();
        if (this.hooks.takeover?.(this.s, this.out, this.dt)) {
            return;
        }
        if (
            this.hooks.hazards &&
            !this.hooks.hazards(this.s, this.out, this.dt)
        ) {
            return;
        }
        this.p = this.s.p;
        this.was = this.s.ground;
        this.applyDrive();
        if (this.hooks.afterMove?.(this.s, this.out, this.dt, this.prev)) {
            return;
        }
        this.hit = collide(this.p, stageSolids(this.s));
        setPlayer(this.s, this.hit.p);
        this.s.ground = this.hit.ground;
        if (this.hit.headHit) {
            applyHeadHit(this.s, this.out, this.hit.headHit);
            return;
        }
        this.hooks.afterCollide?.(this.s, this.out, this.dt, this.prev);
        if (this.s.mode !== 'play') {
            return;
        }
        if (this.hooks.checkpointsOpen?.(this.s) ?? true) {
            reachCheckpoints(this.s, this.out);
        }
        applyFocusRecovery(
            this.s,
            this.dt,
            this.hooks.focusBlocked?.(this.s) ?? false,
        );
        this.updateReverseFeedback();
        this.finishMovement();
    }
    private beginTick() {
        this.s.history.push(snapshot(this.s));
        if (this.s.history.length > 60) {
            this.s.history.shift();
        }
        this.s.time += this.dt;
        this.s.rollCooldown = Math.max(0, this.s.rollCooldown - this.dt);
        this.s.reverseCooldown = Math.max(0, this.s.reverseCooldown - this.dt);
        this.s.extinguisher.cooldown = Math.max(
            0,
            this.s.extinguisher.cooldown - this.dt,
        );
        this.s.extinguisher.burst = Math.max(
            0,
            this.s.extinguisher.burst - this.dt,
        );
        this.hooks.timers?.(this.s, this.dt);
        if (this.s.keys.includes('spray')) {
            spray(this.s, this.out);
        }
        this.out.push({ type: 'tick', dt: this.dt });
    }
    private updateReverseFeedback() {
        this.keepPlayerInBounds();
        if (
            this.s.people.length > 0 &&
            this.p.vx < -60 &&
            this.s.reverseCooldown === 0
        ) {
            const n = this.s.people.reduce((a, b) =>
                Math.abs(a.x - this.p.x) < Math.abs(b.x - this.p.x) ? a : b,
            );
            if (Math.abs(n.x - this.p.x) < 300) {
                this.out.push({
                    type: 'cue',
                    id: 'reverse-comment',
                    person: { ...n },
                });
                this.s.reverseCooldown = 7;
            }
        }
    }
    private keepPlayerInBounds() {
        if (this.s.ground) {
            this.p.w -= Det.sin(this.p.a) * this.dt;
        }
        if (this.p.x < 40) {
            this.p.x = 40;
            this.p.vx = Math.max(0, this.p.vx);
        }
        this.s.lessons.moved ||= this.p.x > 140;
        if (
            this.stage.practicePile &&
            !this.s.lessons.jumped &&
            this.s.practiceJump &&
            this.s.ground &&
            this.p.x < 330
        ) {
            this.s.lessons.jumped = true;
            this.out.push({ type: 'cue', id: 'practice-cleared' });
        }
        this.s.actualSpeed +=
            (Math.abs(this.p.x - this.prev) / this.dt - this.s.actualSpeed) *
            (1 - Det.exp(-this.dt / 0.12));
        if (
            this.s.ground &&
            this.dir &&
            Math.abs(this.p.vx) > 95 &&
            this.s.rollCooldown === 0
        ) {
            this.out.push({ type: 'cue', id: 'rolling' });
            this.s.rollCooldown = 9;
        }
    }
    private applyDrive() {
        this.inputDir =
            (this.s.keys.includes('right') ? 1 : 0) -
            (this.s.keys.includes('left') ? 1 : 0);
        this.updateJump();
    }
    private updateJump() {
        this.prev = this.p.x;
        this.s.coyote = this.s.ground
            ? PHYSICS.jump.coyote
            : Math.max(0, this.s.coyote - this.dt);
        this.s.jumpQ = Math.max(0, this.s.jumpQ - this.dt);
        this.hooks.beforeDrive?.(this.s, this.out, this.was);
        if (this.s.jumpQ > 0 && this.s.coyote > 0) {
            if (this.p.x < PHYSICS.upright.tutorialUntilX) {
                this.s.practiceJump = true;
            }
            this.p.vy = -PHYSICS.jump.speed;
            this.p.w -= this.inputDir * PHYSICS.jump.spin;
            this.s.ground = false;
            this.hooks.onJump?.(this.s);
            this.s.coyote = 0;
            this.s.jumpQ = 0;
        }
        this.resolveDriveInput();
    }
    private resolveDriveInput() {
        this.tweak = this.hooks.drive?.(this.s, this.inputDir) ?? {};
        this.dir = this.tweak.dir ?? this.inputDir;
        this.convoyJump = this.tweak.convoyJump ?? false;
        this.expressJump = this.tweak.expressJump ?? false;
        this.slip = this.tweak.slip ?? false;
        this.balancing = this.s.keys.includes('q') || this.s.keys.includes('e');
        this.tilt =
            (this.s.keys.includes('e') ? 1 : 0) -
            (this.s.keys.includes('q') ? 1 : 0) +
            (this.was || this.balancing ? 0 : this.inputDir);
        setPlayer(
            this.s,
            drivePlayer(
                this.p,
                {
                    grounded: this.was,
                    slip: this.slip,
                    dir: this.dir,
                    tilt: this.tilt,
                    upright:
                        this.p.x < PHYSICS.upright.tutorialUntilX ||
                        this.stage.alwaysUpright,
                    convoyJump: this.convoyJump,
                    expressJump: this.expressJump,
                },
                this.dt,
            ),
        );
    }
    private finishMovement() {
        for (const n of this.s.people) {
            if (
                !n.said &&
                Math.min(Math.abs(this.p.x - n.x), Math.abs(this.prev - n.x)) <
                    100
            ) {
                n.said = true;
                this.out.push({
                    type: 'cue',
                    id: 'person-comment',
                    person: { ...n },
                });
            }
        }
        this.hooks.afterScore?.(this.s, this.out, this.dt);
        if (fellOffFloor(this.p)) {
            if (this.hooks.onFall) {
                this.hooks.onFall(this.s, this.out);
            } else {
                this.s.deaths++;
                resetAttempt(this.s, this.out);
            }
            return;
        }
        if (this.stage.finishAtGoal && this.p.x > this.stage.goal) {
            if (this.s.stage > this.s.completedStage) {
                this.s.completedStage = this.s.stage;
            }
            setActivity(this.s, {
                mode: 'won',
                lossReason: null,
                impact: null,
            });
            this.s.keys = [];
            this.out.push({ type: 'cue', id: 'stage-clear' });
        }
    }
}
