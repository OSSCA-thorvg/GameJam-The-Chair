import { bindControls } from './controls';
import { isStageUnlocked } from '../game/progression';

import type { Game } from '../game/game';
export function bindInput(
    root: HTMLElement,
    game: Game,
    {
        blocked = () => false,
        onStart,
    }: {
        blocked?: () => boolean;
        onStart?: () => void;
    } = {},
): (() => void) & {
    sync: () => void;
} {
    return new InputBinding(root, game, blocked, onStart).api();
}
class InputBinding {
    private root!: HTMLElement;
    private game!: Game;
    private blocked!: () => boolean;
    private onStart!: (() => void) | undefined;
    private controller!: AbortController;
    private options!: {
        signal: AbortSignal;
    };
    private menu!: HTMLElement | null;
    private pauseButton!: HTMLButtonElement | null;
    private panel!: HTMLElement | null;
    private menuOpen!: boolean;
    private panelOpen!: boolean;
    private returnFocus!: HTMLElement | null;
    private accepting: () => boolean = () => {
        return (
            this.root.isConnected &&
            !this.blocked() &&
            !document.querySelector('.startup-splash')
        );
    };
    private observer!: MutationObserver;
    constructor(
        root: HTMLElement,
        game: Game,
        blocked: () => boolean,
        onStart: (() => void) | undefined,
    ) {
        this.root = root;
        this.game = game;
        this.blocked = blocked;
        this.onStart = onStart;
        this.controller = new AbortController();
        this.options = { signal: this.controller.signal };
        this.menu = this.root.querySelector<HTMLElement>('[data-pause-menu]');
        this.pauseButton =
            this.root.querySelector<HTMLButtonElement>('[data-pause]');
        this.panel = this.root.querySelector<HTMLElement>('[data-overlay]');
        this.menuOpen = false;
        this.panelOpen = false;
        this.returnFocus = null;
        this.button('[data-start]', () => {
            const state = this.game.status();
            if (state.mode === 'won' && state.stage === 1) {
                this.game.startStage(2);
            } else if (state.mode === 'won' && state.stage === 2) {
                this.game.startStage(3);
            } else {
                this.game.reset();
                if (state.mode === 'intro') {
                    this.onStart?.();
                }
            }
        });
        this.bindStageButtons();
        bindControls(
            this.root,
            this.game,
            {
                accepting: (e) =>
                    this.accepting() &&
                    !(
                        e.target instanceof Element &&
                        /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)
                    ),
                togglePause: this.togglePause,
                afterRestart: this.syncMenu,
            },
            this.controller.signal,
        );
        document.addEventListener(
            'visibilitychange',
            () => {
                if (document.hidden && this.game.status().mode === 'play') {
                    this.togglePause();
                }
            },
            this.options,
        );
        this.observer = new MutationObserver(() => {
            if (
                (this.game.status().mode === 'pause' && !this.blocked()) !==
                    this.menuOpen ||
                (!!this.panel && !this.panel.hidden) !== this.panelOpen
            ) {
                this.syncMenu();
            }
        });
        this.observer.observe(this.root, {
            subtree: true,
            attributes: true,
            attributeFilter: ['hidden'],
        });
        queueMicrotask(this.syncMenu);
    }
    private focusable = (container: HTMLElement) => {
        return [
            ...container.querySelectorAll<HTMLElement>(
                'button:not([disabled]), summary, [tabindex="0"]',
            ),
        ].filter((el) => el.getClientRects().length > 0);
    };
    private syncMenu = () => {
        const visiblePanel = this.updateOverlayFocus();
        this.panelOpen = visiblePanel;
    };
    private togglePause = () => {
        if (this.blocked()) {
            return;
        }
        if (this.game.status().mode === 'play') {
            this.returnFocus =
                document.activeElement instanceof HTMLElement
                    ? document.activeElement
                    : this.pauseButton;
        }
        this.game.pause();
        this.syncMenu();
    };
    private button = (selector: string, action: () => void) => {
        this.root.querySelector<HTMLElement>(selector)?.addEventListener(
            'click',
            () => {
                if (this.blocked()) {
                    return;
                }
                action();
                this.syncMenu();
            },
            this.options,
        );
    };
    private updateOverlayFocus() {
        const visiblePanel = this.updatePauseMenu();
        return visiblePanel;
    }
    private updatePauseMenu() {
        const paused = this.game.status().mode === 'pause' && !this.blocked();
        if (this.menu) {
            this.menu.hidden = !paused;
        }
        this.pauseButton?.setAttribute('aria-expanded', String(paused));
        if (paused && !this.menuOpen) {
            this.menuOpen = true;
            this.menu
                ?.querySelector<HTMLButtonElement>('[data-resume]')
                ?.focus();
        } else if (!paused && this.menuOpen) {
            this.menuOpen = false;
            this.restorePauseFocus();
        }
        const visiblePanel = !!this.panel && !this.panel.hidden;
        return this.focusVisiblePanel(visiblePanel, paused);
    }
    private restorePauseFocus() {
        if (this.menu?.contains(document.activeElement)) {
            (this.returnFocus?.isConnected &&
            this.returnFocus !== document.body &&
            !this.returnFocus.hidden
                ? this.returnFocus
                : this.pauseButton
            )?.focus();
        }
    }
    private focusVisiblePanel(visiblePanel: boolean, paused: boolean) {
        if (
            visiblePanel &&
            !this.panelOpen &&
            !paused &&
            !this.blocked() &&
            !document.querySelector('.startup-splash')
        ) {
            this.panel
                ?.querySelector<HTMLButtonElement>('[data-start]')
                ?.focus();
        }
        if (
            !visiblePanel &&
            this.panelOpen &&
            this.panel?.contains(document.activeElement)
        ) {
            this.pauseButton?.focus();
        }
        return visiblePanel;
    }
    private bindStageButtons() {
        for (const stage of [1, 2, 3, 4, 5] as const) {
            this.button(`[data-stage="${stage}"]`, () => {
                if (isStageUnlocked(stage, this.game.status().completedStage)) {
                    this.game.startStage(stage);
                }
            });
        }
        this.button('[data-reset]', this.game.restart);
        this.button('[data-pause]', this.togglePause);
        this.button('[data-resume]', this.togglePause);
        window.addEventListener(
            'keydown',
            (e) => {
                if (e.key !== 'Tab' || !this.accepting()) {
                    return;
                }
                const state = this.game.status();
                const dialog =
                    state.mode === 'pause'
                        ? this.menu
                        : this.panel && !this.panel.hidden
                          ? this.panel
                          : null;
                if (!dialog) {
                    return;
                }
                const targets = this.focusable(dialog);
                const first = targets.at(0);
                const last = targets.at(-1);
                if (
                    e.shiftKey &&
                    (document.activeElement === first ||
                        !dialog.contains(document.activeElement))
                ) {
                    e.preventDefault();
                    last?.focus();
                } else if (
                    !e.shiftKey &&
                    (document.activeElement === last ||
                        !dialog.contains(document.activeElement))
                ) {
                    e.preventDefault();
                    first?.focus();
                }
            },
            this.options,
        );
    }
    api(): (() => void) & {
        sync: () => void;
    } {
        return Object.assign(
            () => {
                this.controller.abort();
                this.observer.disconnect();
            },
            { sync: this.syncMenu },
        );
    }
}
