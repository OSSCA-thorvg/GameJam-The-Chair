import { PHYSICS } from './level';
import * as Det from './math';
import { stageHooks } from './stages/hooks';
import { resetAttempt, setActivity, startStage } from './state';

import type { CoreState } from './state';
import type { StageId, GameEvent, Input } from './types';
export type Command =
    | { type: 'keys'; keys: Input[] }
    | { type: 'jump' }
    | { type: 'spray' }
    | { type: 'interact' }
    | { type: 'leaveMeeting' }
    | { type: 'pause' }
    | { type: 'reset' }
    | { type: 'restart' }
    | { type: 'startStage'; id: StageId };
function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
function isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
}
function isInput(value: unknown): value is Input {
    return (
        value === 'left' ||
        value === 'right' ||
        value === 'q' ||
        value === 'e' ||
        value === 'spray' ||
        value === 'forward' ||
        value === 'back' ||
        value === 'brake'
    );
}
function isStageId(value: unknown): value is StageId {
    return (
        value === 1 || value === 2 || value === 3 || value === 4 || value === 5
    );
}
export function parseCommand(value: unknown): Command {
    if (!isRecord(value) || typeof value.type !== 'string') {
        throw new Error('bad command');
    }
    return parseCommandRecord(value);
}
function parseCommandRecord(value: Record<string, unknown>): Command {
    switch (value.type) {
        case 'keys': {
            return { type: 'keys', keys: parseInputKeys(value.keys) };
        }
        case 'startStage':
            if (!isStageId(value.id)) {
                throw new Error('bad command stage');
            }
            return { type: 'startStage', id: value.id };
        case 'jump':
        case 'spray':
        case 'interact':
        case 'leaveMeeting':
        case 'pause':
        case 'reset':
        case 'restart':
            return { type: value.type };
        default:
            throw new Error('bad command type');
    }
}
export function runCommand(
    s: CoreState,
    command: Command,
    out: GameEvent[],
): void {
    switch (command.type) {
        case 'keys':
            s.keys = [...command.keys];
            return;
        case 'jump':
            jump(s);
            return;
        case 'spray':
            spray(s, out);
            return;
        case 'interact':
            if (s.mode === 'play') {
                stageHooks(s.stage).interact?.(s);
            }
            return;
        case 'leaveMeeting':
            stageHooks(s.stage).leave?.(s);
            return;
        case 'pause':
            pause(s);
            return;
        case 'reset':
            resetAttempt(s, out);
            return;
        case 'restart':
            if (s.mode === 'play') {
                s.deaths++;
            }
            resetAttempt(s, out);
            return;
        case 'startStage':
            startStage(s, command.id, out);
            return;
    }
}
function jump(s: CoreState) {
    if (s.mode !== 'play' || stageHooks(s.stage).canJump?.(s) === false) {
        return;
    }
    s.jumpQ = PHYSICS.jump.buffer;
}
export function spray(s: CoreState, out: GameEvent[]): void {
    const hooks = stageHooks(s.stage);
    if (
        s.mode !== 'play' ||
        !s.extinguisher.owned ||
        hooks.canSpray?.(s) === false ||
        s.extinguisher.cooldown > 0
    ) {
        return;
    }
    const dx =
        (s.keys.includes('right') ? 1 : 0) - (s.keys.includes('left') ? 1 : 0);
    const len = Det.hypot(dx, 1);
    s.extinguisher.direction = { x: -dx / len, y: 1 / len };
    s.p.vx += dx * 150;
    s.p.vy = Math.max(-500, Math.min(0, s.p.vy) - (dx ? 430 : 470));
    s.ground = false;
    s.coyote = 0;
    s.extinguisher.cooldown = 0.24;
    s.extinguisher.burst = 0.24;
    out.push({ type: 'cue', id: 'spray' });
    hooks.onSpray?.(s, dx);
}
function pause(s: CoreState) {
    if (s.mode !== 'play' && s.mode !== 'pause') {
        return;
    }
    setActivity(s, {
        mode: s.mode === 'play' ? 'pause' : 'play',
        lossReason: null,
        impact: null,
    });
    s.keys = [];
}
function parseInputKeys(value: unknown): Input[] {
    if (!isArray(value) || value.length > 8 || !value.every(isInput)) {
        throw new Error('bad command keys');
    }
    return [...new Set(value)];
}
