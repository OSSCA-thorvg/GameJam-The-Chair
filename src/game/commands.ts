import { resetAttempt, startStage, type GameState } from './state';
import type { StageId } from './stage2';
import type { GameEvent, Input } from './types';
import { applyRooftopSpray } from './apply';
import { interactMeeting, leaveMeeting } from './systems/corridor';

// Every way the outside world changes the game. Recorded with the tick it arrived on.
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

// Commands take effect immediately, between fixed steps, even while paused.
export function applyCommand(s: GameState, command: Command, out: GameEvent[]) {
    switch (command.type) {
        case 'keys': s.keys = [...command.keys]; return;
        case 'jump': jump(s); return;
        case 'spray': spray(s, out); return;
        case 'interact': interactMeeting(s); return;
        case 'leaveMeeting': if (s.mode === 'play') leaveMeeting(s); return;
        case 'pause': pause(s); return;
        case 'reset': resetAttempt(s, out); return;
        case 'restart':
            if (s.mode === 'play') s.deaths++;
            resetAttempt(s, out);
            return;
        case 'startStage': startStage(s, command.id, out); return;
    }
}

function jump(s: GameState) {
    if (s.mode !== 'play' || s.corridor.room.kind === 'meeting' || s.rooftopEntrance.kind === 'opening') return;
    s.jumpQ = .14;
}

export function spray(s: GameState, out: GameEvent[]) {
    if (s.mode !== 'play' || !s.hasExtinguisher || s.stage === 4 || s.firstFlight.kind === 'flight' || s.sprayCooldown > 0) return;
    const dx = (s.keys.includes('right') ? 1 : 0) - (s.keys.includes('left') ? 1 : 0);
    const len = Math.hypot(dx, 1);
    s.sprayDir = { x: -dx / len, y: 1 / len };
    s.p.vx += dx * 150;
    s.p.vy = Math.max(-500, Math.min(0, s.p.vy) - (dx ? 430 : 470));
    s.ground = false;
    s.coyote = 0;
    s.sprayCooldown = .24;
    s.sprayBurst = .24;
    out.push({ type: 'cue', id: 'spray' });
    applyRooftopSpray(s, dx);
}

function pause(s: GameState) {
    if (s.mode !== 'play' && s.mode !== 'pause') return;
    s.mode = s.mode === 'play' ? 'pause' : 'play';
    s.keys = [];
}
