import { load } from './load.mjs';
const { STAGE_THREE, ventPhase } = await load(
    'src/game/stages/rooftop/data.ts',
);
const LIMIT = STAGE_THREE.airSprayLimit;
function quietFor(vent, time) {
    const phase = ventPhase(vent, time);
    if (phase.kind !== 'idle') {
        return 0;
    }
    return vent.period - vent.warn - vent.blow - phase.age;
}
const ventQuiet = (index, seconds) => (state) =>
    quietFor(STAGE_THREE.vents[index], state.time) >= seconds;
const ductJustGusted = (state) =>
    state.ductReaction.kind === 'done' && state.ductReaction.rest < 0.4;
const ductQuietFor = (seconds) => (state) =>
    state.ductReaction.kind === 'done' &&
    state.ductReaction.rest < STAGE_THREE.duct.gustPeriod - seconds;
const FLOOR = 368;
const R1 = 248;
const L1 = 78;
const R2 = -92;
const L2 = -262;
const UPPER = -172;
const ROUTE = [
    { how: 'start' },
    { how: 'pickup' },
    { how: 'rise', x: 1030, y: 210 },
    { how: 'roll', x: 1120 },
    { how: 'roll', x: 1370 },
    { how: 'wait', x: 1370 },
    {
        how: 'hop',
        level: FLOOR,
        takeoff: 1460,
        to: [1600, R1],
        apex: 200,
        ready: ductQuietFor(2),
    },
    {
        how: 'hop',
        level: R1,
        takeoff: 1655,
        to: [1330, L1],
        apex: 50,
        ready: ductQuietFor(1.3),
    },
    {
        how: 'hop',
        level: L1,
        takeoff: 1372,
        to: [1690, R2],
        apex: -120,
        ups: 1,
        ready: ventQuiet(0, 1.4),
    },
    {
        how: 'hop',
        level: R2,
        takeoff: 1660,
        to: [1330, L2],
        apex: -290,
        ready: ventQuiet(1, 1.4),
    },
    {
        how: 'leap',
        level: L2,
        start: 1262,
        takeoff: 1505,
        to: [1880, UPPER],
        apex: -420,
        ready: (state) => ventQuiet(2, 1.45)(state) && ventQuiet(1, 1.2)(state),
    },
    { how: 'board' },
];
export const ROUTE_STEPS = ROUTE.length;
function retryFrom(y) {
    let best = -1;
    for (let i = 0; i < ROUTE.length; i++) {
        if (ROUTE[i].level !== undefined && Math.abs(ROUTE[i].level - y) < 20) {
            best = i;
            break;
        }
    }
    return best;
}
export function driveStageThree(
    game,
    stop = (state) => state.stage === 4 || state.mode !== 'play',
    observe = (state, phase) => {},
) {
    const driver = new StageThreeRoute(game);
    for (let i = 0; i < 120 * 150; i++) {
        const state = game.getSnapshot();
        observe(state, driver.phase);
        if (stop(state)) {
            return state;
        }
        driver.update(state);
        game.step(1 / 120);
        game.drainEvents();
    }
    const step = ROUTE[driver.phase];
    throw new Error(
        `Stage-three route timed out at phase ${driver.phase} (${step.how}${step.to ? ` to ${step.to}` : step.x ? ` ${step.x}` : ''}, ${driver.sub})`,
    );
}
class StageThreeRoute {
    phase = 0;
    sub = 'go';
    tx = 0;
    ty = 0;
    constructor(game) {
        this.game = game;
    }
    update(state) {
        this.state = state;
        this.p = state.player;
        this.step = ROUTE[this.phase];
        if (this.step.how === 'start') {
            this.controlStart();
        } else if (this.step.how === 'pickup') {
            this.controlPickup();
        } else if (this.step.how === 'rise') {
            this.controlRise();
        } else if (this.step.how === 'roll') {
            this.controlRoll();
        } else if (this.step.how === 'wait') {
            this.controlWait();
        } else if (this.step.how === 'hop' || this.step.how === 'leap') {
            this.controlHop();
        } else if (this.step.how === 'board') {
            this.controlBoard();
        }
    }
    toward(x) {
        const error = x - this.p.x - this.p.vx * 0.32;
        return error > 12 ? ['right'] : error < -12 ? ['left'] : [];
    }
    onLevel(y) {
        return this.state.ground && Math.abs(this.p.y - y) < 20;
    }
    controlStart() {
        this.game.setInput('right');
        if (this.p.x > 210 && this.state.ground) {
            this.game.jump();
            this.phase++;
        }
    }
    controlPickup() {
        this.game.setInput('right');
        if (
            this.state.ground &&
            ((this.p.x > 205 && this.p.x < 330) ||
                (this.p.x > 370 && this.p.x < 450))
        ) {
            this.game.jump();
        }
        if (this.state.hasExtinguisher) {
            this.phase++;
        }
    }
    controlRise() {
        const keys = this.toward(this.step.x);
        if (this.p.y + this.p.vy * 0.2 > this.step.y) {
            keys.push('spray');
        }
        this.game.setInput(...keys);
        if (
            Math.abs(this.p.x - this.step.x) < 40 &&
            this.p.y < this.step.y + 15
        ) {
            this.phase++;
        }
    }
    controlRoll() {
        this.game.setInput(...this.toward(this.step.x));
        if (Math.abs(this.p.x - this.step.x) < 40 && this.state.ground) {
            this.phase++;
        }
    }
    controlWait() {
        this.game.setInput(
            ...(this.state.ground ? this.toward(this.step.x) : []),
        );
        if (ductJustGusted(this.state) && this.state.ground) {
            this.phase++;
            this.sub = 'go';
        }
    }
    settleTarget() {
        this.sub = 'settle';
        this.game.setInput(...this.toward(this.tx));
        if (Math.abs(this.p.vx) < 60) {
            this.phase++;
            this.sub = 'go';
        }
    }
    holdTarget() {
        this.game.setInput(...this.toward(this.tx));
    }
    retryLanding() {
        const retry = retryFrom(this.p.y);
        if (retry >= 0) {
            this.phase = retry;
            this.sub = 'go';
        }
        this.game.setInput();
    }
    prepareLaunch() {
        const runUp =
            this.step.how === 'leap' && this.sub === 'go'
                ? this.step.start
                : this.step.takeoff;
        if (this.sub === 'go') {
            this.game.setInput(...this.toward(runUp));
            if (Math.abs(this.p.x - runUp) < 20 && Math.abs(this.p.vx) < 40) {
                this.sub = 'ready';
            }
        } else if (this.sub === 'ready') {
            this.game.setInput(...this.toward(runUp));
            if (this.step.ready(this.state)) {
                this.sub = this.step.how === 'leap' ? 'run' : 'launch';
            }
        } else if (this.sub === 'run') {
            this.game.setInput('right');
            if (this.p.x >= this.step.takeoff) {
                this.sub = 'launch';
            }
        }
        if (this.sub === 'launch') {
            this.game.setInput(
                ...(this.step.how === 'leap' ? ['right', 'spray'] : ['spray']),
            );
            this.sub = 'air';
        }
    }
    settleLanding() {
        this.game.setInput(...(this.p.vy < 120 ? this.toward(this.tx) : []));
    }
    canClimb(high, left) {
        return !high && left > 1 && this.state.airSprays < (this.step.ups ?? 2);
    }
    controlAirborne() {
        this.sub = this.state.ground ? this.sub : 'air';
        const keys = [];
        const high = this.p.y + this.p.vy * 0.25 <= this.step.apex;
        const left = LIMIT - this.state.airSprays;
        if (this.step.how === 'leap' && this.p.x > 1810) {
            keys.push(...this.toward(this.tx));
        } else if (this.step.how === 'leap') {
            keys.push('right');
            if (!high && left > 0) {
                keys.push('spray');
            }
        } else if (this.canClimb(high, left)) {
            keys.push('spray');
        } else if (
            left > 0 &&
            Math.abs(this.tx - this.p.x) > 90 &&
            this.p.vy > -160
        ) {
            keys.push(this.tx > this.p.x ? 'right' : 'left', 'spray');
        } else if (this.p.vy < 120) {
            keys.push(...this.toward(this.tx));
        }
        this.game.setInput(...keys);
        if (this.state.ground) {
            this.sub = 'go';
        }
    }
    controlHop() {
        [this.tx, this.ty] = this.step.to;
        if (
            this.state.ground &&
            (this.sub === 'air' ||
                (this.sub === 'settle' && !this.onLevel(this.ty)))
        ) {
            this.sub = 'go';
        }
        if (
            this.onLevel(this.ty) &&
            Math.abs(this.p.x - this.tx) < (this.step.how === 'leap' ? 60 : 150)
        ) {
            this.settleTarget();
        } else if (this.onLevel(this.ty)) {
            this.holdTarget();
        } else if (this.state.ground && !this.onLevel(this.step.level)) {
            this.retryLanding();
        } else if (this.state.ground && this.sub !== 'air') {
            this.prepareLaunch();
        } else if (this.sub === 'settle') {
            this.settleLanding();
        } else {
            this.controlAirborne();
        }
    }
    controlBoard() {
        this.game.setInput('right');
    }
}
