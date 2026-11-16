import { STAGE_PRESENTATION } from '../presentation/stages';
import type { Game, GameStatus } from '../game/game';
import type { Input } from '../game/types';

export type Action = 'up' | 'down' | 'left' | 'right' | 'jump' | 'spray' | 'meeting' | 'pause' | 'restart';

interface Control {
    keys: readonly string[];
    label: string;
    when?: (status: GameStatus) => boolean;
}

export const CONTROLS: Readonly<Record<Action, Control>> = {
    up:        { keys: ['ArrowUp', 'w'], label: '↑ / W', when: s => STAGE_PRESENTATION[s.stage].controls.flight },
    down:      { keys: ['ArrowDown', 's'], label: '↓ / S', when: s => STAGE_PRESENTATION[s.stage].controls.flight },
    left:      { keys: ['ArrowLeft'], label: '←' },
    right:     { keys: ['ArrowRight'], label: '→' },
    jump:      { keys: ['ArrowUp'], label: '↑' },
    spray:     { keys: [' '], label: 'Space', when: s => STAGE_PRESENTATION[s.stage].controls.spray },
    meeting:   { keys: ['ArrowDown'], label: '↓', when: s => STAGE_PRESENTATION[s.stage].controls.meeting },
    pause:     { keys: ['p', 'Escape'], label: 'P / Esc' },
    restart:   { keys: ['r'], label: 'R' },
};

export const SPRAY_KEY = 'Space';
export const MOVE_LABEL = '← →';

const HELD: Partial<Record<Action, Input>> = { up: 'forward', down: 'back', left: 'left', right: 'right', spray: 'spray' };

const normalize = (key: string) => key.length === 1 ? key.toLowerCase() : key;

export function actionForKey(key: string, state: GameStatus): Action | null {
    const k = normalize(key);
    for (const [action, control] of Object.entries(CONTROLS) as [Action, Control][]) {
        if (control.keys.includes(k) && (!control.when || control.when(state))) return action;
    }
    return null;
}

export function applyControlLabels(root: ParentNode) {
    root.querySelectorAll?.<HTMLElement>('[data-control-label]').forEach(el => {
        const action = el.dataset.controlLabel;
        el.textContent = action === 'move' ? MOVE_LABEL : CONTROLS[action as Action]?.label ?? el.textContent;
    });
}

interface ControlHooks {
    accepting: (e: KeyboardEvent) => boolean;
    togglePause: () => void;
    afterRestart: () => void;
}

export function bindControls(root: HTMLElement, game: Game, hooks: ControlHooks, signal: AbortSignal) {
    const options = { signal };
    applyControlLabels(root);

    window.addEventListener('keydown', e => {
        if (!hooks.accepting(e)) return;
        const state = game.status();
        const action = actionForKey(e.key, state);
        if (!action) return;
        if (action === 'pause') {
            if (!e.repeat && (state.mode === 'play' || state.mode === 'pause')) { e.preventDefault(); hooks.togglePause(); }
            return;
        }
        if (action === 'restart') {
            if (!e.repeat && state.mode !== 'intro') { e.preventDefault(); game.restart(); hooks.afterRestart(); }
            return;
        }
        if (state.mode !== 'play') return;
        e.preventDefault();
        const held = HELD[action];
        if (held) game.press(held);
        else if (!e.repeat && action === 'jump') game.jump();
        else if (!e.repeat && action === 'meeting') game.interact();
    }, options);

    window.addEventListener('keyup', e => {
        // Release regardless of stage so a key held across a stage change never sticks.
        const k = normalize(e.key);
        for (const [action, input] of Object.entries(HELD) as [Action, Input][]) {
            if (CONTROLS[action].keys.includes(k)) game.release(input);
        }
    }, options);
    window.addEventListener('blur', game.clearInput, options);

    const hold = (el: HTMLElement | null, input: Input) => {
        el?.addEventListener('pointerdown', e => {
            e.preventDefault();
            game.press(input);
            el.setPointerCapture?.(e.pointerId);
        }, options);
        for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) el?.addEventListener(event, () => game.release(input), options);
    };

    root.querySelectorAll<HTMLElement>('[data-key]').forEach(button => {
        const key = button.dataset.key;
        if (key === 'left' || key === 'right' || key === 'forward' || key === 'back' || key === 'brake') hold(button, key);
    });
    root.querySelectorAll<HTMLElement>('[data-lean]').forEach(button => {
        const side = button.dataset.lean;
        if (side === 'left' || side === 'right') hold(button, side === 'left' ? 'q' : 'e');
    });
    hold(root.querySelector<HTMLElement>('[data-spray]'), 'spray');
    const tap = (selector: string, action: () => void) => {
        root.querySelector<HTMLElement>(selector)?.addEventListener('pointerdown', e => {
            e.preventDefault();
            action();
        }, options);
    };
    tap('[data-jump]', game.jump);
    tap('[data-interact]', game.interact);
}
