import { STAGE_PRESENTATION } from '../presentation/stages';

import type { Game, GameStatus } from '../game/game';
import type { Input } from '../game/types';
export type Action =
    | 'up'
    | 'down'
    | 'left'
    | 'right'
    | 'jump'
    | 'spray'
    | 'meeting'
    | 'pause'
    | 'restart';
type Control = {
    keys: readonly string[];
    label: string;
    when?: (status: GameStatus) => boolean;
};
export const CONTROLS: Readonly<Record<Action, Control>> = {
    up: {
        keys: ['ArrowUp', 'w'],
        label: '↑ / W',
        when: (s) => STAGE_PRESENTATION[s.stage].controls.flight,
    },
    down: {
        keys: ['ArrowDown', 's'],
        label: '↓ / S',
        when: (s) => STAGE_PRESENTATION[s.stage].controls.flight,
    },
    left: { keys: ['ArrowLeft'], label: '←' },
    right: { keys: ['ArrowRight'], label: '→' },
    jump: { keys: ['ArrowUp'], label: '↑' },
    spray: {
        keys: [' '],
        label: 'Space',
        when: (s) => STAGE_PRESENTATION[s.stage].controls.spray,
    },
    meeting: {
        keys: ['ArrowDown'],
        label: '↓',
        when: (s) => STAGE_PRESENTATION[s.stage].controls.meeting,
    },
    pause: { keys: ['p', 'Escape'], label: 'P / Esc' },
    restart: { keys: ['r'], label: 'R' },
};
export const SPRAY_KEY = 'Space';
export const MOVE_LABEL = '← →';
const HELD: Partial<Record<Action, Input>> = {
    up: 'forward',
    down: 'back',
    left: 'left',
    right: 'right',
    spray: 'spray',
};
const normalize = (key: string) => (key.length === 1 ? key.toLowerCase() : key);
export function actionForKey(key: string, state: GameStatus): Action | null {
    const k = normalize(key);
    for (const [action, control] of Object.entries(CONTROLS) as Array<
        [Action, Control]
    >) {
        if (
            control.keys.includes(k) &&
            (!control.when || control.when(state))
        ) {
            return action;
        }
    }
    return null;
}
export function applyControlLabels(root: ParentNode): void {
    root.querySelectorAll<HTMLElement>('[data-control-label]').forEach((el) => {
        const action = el.dataset.controlLabel;
        el.textContent =
            action === 'move'
                ? MOVE_LABEL
                : ((action && action in CONTROLS
                      ? CONTROLS[action as Action].label
                      : undefined) ?? el.textContent);
    });
}
type ControlHooks = {
    accepting: (e: KeyboardEvent) => boolean;
    togglePause: () => void;
    afterRestart: () => void;
};
export function bindControls(
    root: HTMLElement,
    game: Game,
    hooks: ControlHooks,
    signal: AbortSignal,
): void {
    return new ControlBinding(root, game, hooks, signal).api();
}
class ControlBinding {
    private root!: HTMLElement;
    private game!: Game;
    private hooks!: ControlHooks;
    private signal!: AbortSignal;
    private options!: {
        signal: AbortSignal;
    };
    private hold: (el: HTMLElement | null, input: Input) => void = (
        el: HTMLElement | null,
        input: Input,
    ) => {
        el?.addEventListener(
            'pointerdown',
            (e) => {
                e.preventDefault();
                this.game.press(input);
                el.setPointerCapture(e.pointerId);
            },
            this.options,
        );
        for (const event of [
            'pointerup',
            'pointercancel',
            'lostpointercapture',
        ]) {
            el?.addEventListener(
                event,
                () => this.game.release(input),
                this.options,
            );
        }
    };
    private tap: (selector: string, action: () => void) => void = (
        selector: string,
        action: () => void,
    ) => {
        this.root.querySelector<HTMLElement>(selector)?.addEventListener(
            'pointerdown',
            (e) => {
                e.preventDefault();
                action();
            },
            this.options,
        );
    };
    constructor(
        root: HTMLElement,
        game: Game,
        hooks: ControlHooks,
        signal: AbortSignal,
    ) {
        this.root = root;
        this.game = game;
        this.hooks = hooks;
        this.signal = signal;
        this.options = { signal: this.signal };
        applyControlLabels(this.root);
        window.addEventListener(
            'keydown',
            (e) => {
                if (!this.hooks.accepting(e)) {
                    return;
                }
                const state = this.game.status();
                const action = actionForKey(e.key, state);
                if (!action) {
                    return;
                }
                if (action === 'pause') {
                    if (
                        !e.repeat &&
                        (state.mode === 'play' || state.mode === 'pause')
                    ) {
                        e.preventDefault();
                        this.hooks.togglePause();
                    }
                    return;
                }
                if (action === 'restart') {
                    if (!e.repeat && state.mode !== 'intro') {
                        e.preventDefault();
                        this.game.restart();
                        this.hooks.afterRestart();
                    }
                    return;
                }
                if (state.mode !== 'play') {
                    return;
                }
                this.applyKeyboardAction(e, action);
            },
            this.options,
        );
        window.addEventListener(
            'keyup',
            (e) => {
                // Release regardless of stage so a key held across a stage change
                // never sticks.
                const k = normalize(e.key);
                for (const [action, input] of Object.entries(HELD) as Array<
                    [Action, Input]
                >) {
                    if (CONTROLS[action].keys.includes(k)) {
                        this.game.release(input);
                    }
                }
            },
            this.options,
        );
        window.addEventListener('blur', this.game.clearInput, this.options);
        this.root
            .querySelectorAll<HTMLElement>('[data-key]')
            .forEach((button) => {
                const key = button.dataset.key;
                if (
                    key === 'left' ||
                    key === 'right' ||
                    key === 'forward' ||
                    key === 'back' ||
                    key === 'brake'
                ) {
                    this.hold(button, key);
                }
            });
        this.root
            .querySelectorAll<HTMLElement>('[data-lean]')
            .forEach((button) => {
                const side = button.dataset.lean;
                if (side === 'left' || side === 'right') {
                    this.hold(button, side === 'left' ? 'q' : 'e');
                }
            });
        this.hold(
            this.root.querySelector<HTMLElement>('[data-spray]'),
            'spray',
        );
        this.tap('[data-jump]', this.game.jump);
        this.tap('[data-interact]', this.game.interact);
    }
    private applyKeyboardAction(e: KeyboardEvent, action: Action) {
        e.preventDefault();
        const held = HELD[action];
        if (held) {
            this.game.press(held);
        } else if (!e.repeat && action === 'jump') {
            this.game.jump();
        } else if (!e.repeat && action === 'meeting') {
            this.game.interact();
        }
    }
    api(): void {}
}
