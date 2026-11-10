// All player controls live here: key bindings, on-screen labels, keyboard and touch handlers.
// To change a key, edit CONTROLS; labels in the menu and in the world update automatically.
import type { Game } from '../game/game';
import type { Input } from '../game/types';

export type Action = 'left' | 'right' | 'leanLeft' | 'leanRight' | 'jump' | 'spray' | 'meeting' | 'pause' | 'restart';

interface Control {
    /** KeyboardEvent.key values (letters are matched case-insensitively). */
    keys: readonly string[];
    /** Text shown in the controls list and world pictograms. */
    label: string;
    /** Stages where this control is active; omitted means every stage. */
    stages?: (stage: number) => boolean;
}

export const CONTROLS: Readonly<Record<Action, Control>> = {
    left:      { keys: ['ArrowLeft', 'a'], label: '← / A' },
    right:     { keys: ['ArrowRight', 'd'], label: '→ / D' },
    leanLeft:  { keys: ['q'], label: 'Q' },
    leanRight: { keys: ['e'], label: 'E' },
    // Space is reserved for the extinguisher, so jumping is Up-only in every stage.
    jump:      { keys: ['ArrowUp'], label: '↑' },
    spray:     { keys: [' ', 'f'], label: 'Space / F', stages: stage => stage >= 3 },
    meeting:   { keys: ['ArrowDown'], label: '↓', stages: stage => stage === 2 },
    pause:     { keys: ['p', 'Escape'], label: 'P / Esc' },
    restart:   { keys: ['r'], label: 'R' },
};

/** Short key name used by in-world pictograms (e.g. the extinguisher pickup). */
export const SPRAY_KEY = 'Space';
export const MOVE_LABEL = '← → / A D';

/** Held actions map onto the game's continuous inputs. */
const HELD: Partial<Record<Action, Input>> = { left: 'left', right: 'right', leanLeft: 'q', leanRight: 'e', spray: 'spray' };

const normalize = (key: string) => key.length === 1 ? key.toLowerCase() : key;

export function actionForKey(key: string, stage: number): Action | null {
    const k = normalize(key);
    for (const [action, control] of Object.entries(CONTROLS) as [Action, Control][]) {
        if (control.keys.includes(k) && (!control.stages || control.stages(stage))) return action;
    }
    return null;
}

/** Fill `[data-control-label="action"]` elements with their key label. */
export function applyControlLabels(root: ParentNode) {
    root.querySelectorAll?.<HTMLElement>('[data-control-label]').forEach(el => {
        const action = el.dataset.controlLabel;
        el.textContent = action === 'move' ? MOVE_LABEL : CONTROLS[action as Action]?.label ?? el.textContent;
    });
}

interface ControlHooks {
    /** Return false to ignore gameplay keys (e.g. while the splash is visible). */
    accepting: (e: KeyboardEvent) => boolean;
    togglePause: () => void;
    afterRestart: () => void;
}

export function bindControls(root: HTMLElement, game: Game, hooks: ControlHooks, signal: AbortSignal) {
    const options = { signal };
    applyControlLabels(root);

    window.addEventListener('keydown', e => {
        if (!hooks.accepting(e)) return;
        const state = game.getSnapshot();
        const action = actionForKey(e.key, state.stage);
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

    // Touch buttons.
    const hold = (el: HTMLElement | null, input: Input) => {
        el?.addEventListener('pointerdown', e => {
            e.preventDefault();
            game.press(input);
            el.setPointerCapture?.(e.pointerId);
        }, options);
        for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) el?.addEventListener(event, () => game.release(input), options);
    };
    const tap = (el: HTMLElement | null, action: () => void) =>
        el?.addEventListener('pointerdown', e => { e.preventDefault(); action(); }, options);

    root.querySelectorAll<HTMLElement>('[data-key]').forEach(button => {
        const key = button.dataset.key;
        if (key === 'left' || key === 'right' || key === 'q' || key === 'e') hold(button, key);
    });
    hold(root.querySelector<HTMLElement>('[data-spray]'), 'spray');
    tap(root.querySelector<HTMLElement>('[data-jump]'), game.jump);
    tap(root.querySelector<HTMLElement>('[data-interact]'), game.interact);
}
